package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"livepulse-backend/config"
)

type VoteEvent struct {
	Type     string           `json:"type"`
	Counts   map[string]int64 `json:"counts"`
	Total    int64            `json:"total"`
	LastVote *LastVote        `json:"last,omitempty"`
}

type LastVote struct {
	OptionID string `json:"optionId"`
	Voter    string `json:"voter"`
}

func votesKey(code string) string     { return fmt.Sprintf("poll:%s:votes", code) }
func voterKey(code, fp string) string { return fmt.Sprintf("poll:%s:voter:%s", code, fp) }
func streamKey(code string) string    { return fmt.Sprintf("poll:%s:stream", code) }

// InitPollVotes seeds the Redis hash so every option starts at 0 when a poll is created.
func InitPollVotes(ctx context.Context, code string, optionIDs []string) error {
	pipe := config.RedisClient.TxPipeline()
	for _, id := range optionIDs {
		pipe.HSetNX(ctx, votesKey(code), id, 0)
	}
	_, err := pipe.Exec(ctx)
	return err
}

// ClaimVote atomically reserves a voter slot with SET NX EX.
// Returns true only if this fingerprint had not voted before (a genuinely new vote).
func ClaimVote(ctx context.Context, code, fingerprint string, ttl time.Duration) (bool, error) {
	return config.RedisClient.SetNX(ctx, voterKey(code, fingerprint), 1, ttl).Result()
}

// CastVote atomically increments the option's counter — this is the operation
// that makes concurrent votes safe without a read-modify-write race.
func CastVote(ctx context.Context, code, optionID string) (int64, error) {
	return config.RedisClient.HIncrBy(ctx, votesKey(code), optionID, 1).Result()
}

// GetTally reads the full current set of counts for a poll.
func GetTally(ctx context.Context, code string) (map[string]int64, error) {
	raw, err := config.RedisClient.HGetAll(ctx, votesKey(code)).Result()
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for k, v := range raw {
		n, _ := strconv.ParseInt(v, 10, 64)
		out[k] = n
	}
	return out, nil
}

// PublishVote broadcasts the updated tally on the poll's Pub/Sub channel.
// Every backend instance's WebSocket hub subscribes to this channel, which is
// what lets votes fan out correctly even if voters and watchers land on
// different server instances behind a load balancer.
func PublishVote(ctx context.Context, code string, counts map[string]int64, last *LastVote) error {
	var total int64
	for _, v := range counts {
		total += v
	}
	evt := VoteEvent{Type: "tally", Counts: counts, Total: total, LastVote: last}
	b, err := json.Marshal(evt)
	if err != nil {
		return err
	}
	return config.RedisClient.Publish(ctx, streamKey(code), b).Err()
}

func Subscribe(ctx context.Context, code string) *redis.PubSub {
	return config.RedisClient.Subscribe(ctx, streamKey(code))
}
