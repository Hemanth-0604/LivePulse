package controllers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"livepulse-backend/config"
	"livepulse-backend/models"
	"livepulse-backend/services"
)

const codeChars = "abcdefghjkmnpqrstuvwxyz23456789"

func genCode() string {
	b := make([]byte, 5)
	for i := range b {
		b[i] = codeChars[rand.Intn(len(codeChars))]
	}
	return string(b)
}

type createPollReq struct {
	Question    string   `json:"question" binding:"required,min=3,max=200"`
	Options     []string `json:"options" binding:"required,min=2,max=5,dive,required,min=1,max=80"`
	DurationSec int      `json:"durationSec" binding:"required,min=10,max=14400"`
}

// CreatePoll is JWT-gated: only a logged-in creator can start a poll.
func CreatePoll(c *gin.Context) {
	var req createPollReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")

	opts := make([]models.Option, len(req.Options))
	optIDs := make([]string, len(req.Options))
	for i, text := range req.Options {
		id := "o" + string(rune('1'+i))
		opts[i] = models.Option{ID: id, Text: text, Votes: 0}
		optIDs[i] = id
	}

	now := time.Now()
	poll := models.Poll{
		Code:        genCode(),
		Question:    req.Question,
		Options:     opts,
		DurationSec: req.DurationSec,
		CreatedBy:   userID.(string),
		Status:      "live",
		CreatedAt:   now,
		ClosesAt:    now.Add(time.Duration(req.DurationSec) * time.Second),
	}

	res, err := config.DB.Collection("polls").InsertOne(context.Background(), poll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create poll"})
		return
	}
	poll.ID = res.InsertedID.(primitive.ObjectID)

	if err := services.InitPollVotes(context.Background(), poll.Code, optIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not init vote counters"})
		return
	}
	// Let Redis auto-expire the vote counters shortly after the poll closes —
	// Mongo already has the durable copy by then via the async sync on each vote.
	config.RedisClient.Expire(context.Background(), "poll:"+poll.Code+":votes", time.Duration(req.DurationSec+300)*time.Second)

	c.JSON(http.StatusCreated, poll)
}

func GetPoll(c *gin.Context) {
	code := c.Param("code")
	var poll models.Poll
	err := config.DB.Collection("polls").FindOne(context.Background(), bson.M{"code": code}).Decode(&poll)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}

	if counts, err := services.GetTally(context.Background(), poll.Code); err == nil {
		for i := range poll.Options {
			poll.Options[i].Votes = counts[poll.Options[i].ID]
		}
	}

	if time.Now().After(poll.ClosesAt) && poll.Status == "live" {
		poll.Status = "closed"
	}

	c.JSON(http.StatusOK, poll)
}

type voteReq struct {
	OptionID string `json:"optionId" binding:"required"`
	Voter    string `json:"voter" binding:"max=40"`
}

// sanitizeVoterName trims and caps the client-supplied display name. Never
// trust it blindly — this is the "validate on the backend" checkpoint for
// free-text user input before it reaches storage or gets broadcast to others.
func sanitizeVoterName(raw string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "Anonymous"
	}
	if len(name) > 24 {
		name = name[:24]
	}
	return name
}

// fingerprint derives a stable, non-spoofable-by-relabeling identity for dedup.
// It's a pragmatic choice for an internship project — good enough to stop casual
// double-voting without requiring full account-per-voter auth.
func fingerprint(c *gin.Context) string {
	raw := c.ClientIP() + "|" + c.GetHeader("User-Agent")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Vote both casts a first-time vote AND handles switching an existing vote to
// a different option — both paths go through the same atomic SwitchVote
// script, so "cast" is really just "switch from nothing." Voting is always
// blocked once the poll's closesAt has passed, checked server-side here
// regardless of what the frontend's countdown shows.
func Vote(c *gin.Context) {
	code := c.Param("code")
	var req voteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "optionId is required"})
		return
	}

	ctx := context.Background()

	var poll models.Poll
	if err := config.DB.Collection("polls").FindOne(ctx, bson.M{"code": code}).Decode(&poll); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}
	if time.Now().After(poll.ClosesAt) {
		c.JSON(http.StatusGone, gin.H{"error": "poll has closed"})
		return
	}

	validOption := false
	for _, o := range poll.Options {
		if o.ID == req.OptionID {
			validOption = true
			break
		}
	}
	if !validOption {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid option"})
		return
	}

	fp := fingerprint(c)
	ttl := time.Until(poll.ClosesAt) + time.Hour
	result, err := services.SwitchVote(ctx, code, fp, req.OptionID, ttl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vote failed"})
		return
	}

	counts, _ := services.GetTally(ctx, code)

	// Only broadcast and persist when the vote actually moved — clicking the
	// option you already picked is a no-op, not a fresh event.
	if result.Changed {
		voterName := sanitizeVoterName(req.Voter)
		services.PublishVote(ctx, code, counts, &services.LastVote{OptionID: req.OptionID, Voter: voterName})

		// Best-effort async write to Mongo. Redis stays the source of truth
		// while the poll is live; Mongo is kept in sync so results survive a
		// restart.
		go func(counts map[string]int64) {
			bctx := context.Background()
			for optID, n := range counts {
				config.DB.Collection("polls").UpdateOne(bctx,
					bson.M{"code": code, "options.id": optID},
					bson.M{"$set": bson.M{"options.$.votes": n}},
				)
			}
		}(counts)
	}

	c.JSON(http.StatusOK, gin.H{
		"counts":   counts,
		"yourVote": req.OptionID,
		"changed":  result.Changed,
	})
}
