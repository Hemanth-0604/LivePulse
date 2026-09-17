package config

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

// ConnectRedis dials Redis using REDIS_ADDR (+ optional REDIS_PASSWORD).
func ConnectRedis() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	RedisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	if err := RedisClient.Ping(Ctx).Err(); err != nil {
		log.Fatalf("redis connect error: %v", err)
	}
	log.Println("Redis connected:", addr)
}
