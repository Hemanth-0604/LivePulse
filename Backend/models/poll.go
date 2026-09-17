package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Option struct {
	ID    string `bson:"id" json:"id"`
	Text  string `bson:"text" json:"text"`
	Votes int64  `bson:"votes" json:"votes"`
}

type Poll struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Code        string             `bson:"code" json:"code"`
	Question    string             `bson:"question" json:"question"`
	Options     []Option           `bson:"options" json:"options"`
	DurationSec int                `bson:"duration_sec" json:"durationSec"`
	CreatedBy   string             `bson:"created_by" json:"createdBy"`
	Status      string             `bson:"status" json:"status"` // "live" | "closed"
	CreatedAt   time.Time          `bson:"created_at" json:"createdAt"`
	ClosesAt    time.Time          `bson:"closes_at" json:"closesAt"`
}
