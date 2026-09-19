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

// switchVoteScript atomically moves a fingerprint's vote to a new option.
//
//   - First-time vote (voter key doesn't exist yet): store the pick with a
//     fresh TTL, increment that option, done.
//   - Same option clicked again: no-op, so a double click can never double-count.
//   - Different option than before: decrement the old pick's count, increment
//     the new one, and overwrite the stored pick — keeping its existing TTL
//     (KEEPTTL) rather than resetting the clock on every switch.
//
// All of this runs as one atomic unit in Redis, so two near-simultaneous
// switch requests for the same voter can never interleave and desync the
// hash from what's actually stored as their current pick.
const switchVoteScript = `
local prev = redis.call('GET', KEYS[1])
if prev == ARGV[1] then
  return {0, prev}
end
if prev then
  redis.call('HINCRBY', KEYS[2], prev, -1)
  redis.call('SET', KEYS[1], ARGV[1], 'KEEPTTL')
else
  redis.call('SETEX', KEYS[1], tonumber(ARGV[2]), ARGV[1])
end
redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
return {1, prev}
`

// SwitchResult reports whether the vote actually moved, and what the voter's
// previous pick was (empty string if this was their first vote on the poll).
type SwitchResult struct {
	Changed  bool
	Previous string
}

// SwitchVote is the single entry point for casting OR changing a vote.
// ttl only applies the first time a fingerprint votes on this poll; on a
// later switch, the original expiry is preserved untouched.
func SwitchVote(ctx context.Context, code, fingerprint, optionID string, ttl time.Duration) (SwitchResult, error) {
	res, err := config.RedisClient.Eval(ctx, switchVoteScript,
		[]string{voterKey(code, fingerprint), votesKey(code)},
		optionID, int64(ttl.Seconds()),
	).Result()
	if err != nil {
		return SwitchResult{}, err
	}

	arr, ok := res.([]interface{})
	if !ok || len(arr) != 2 {
		return SwitchResult{}, fmt.Errorf("unexpected switch-vote script result: %v", res)
	}

	changed := false
	if n, ok := arr[0].(int64); ok {
		changed = n == 1
	}
	prev := ""
	if s, ok := arr[1].(string); ok {
		prev = s
	}
	return SwitchResult{Changed: changed, Previous: prev}, nil
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
