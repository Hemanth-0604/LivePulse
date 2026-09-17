package config

import (
	"context"
	"crypto/tls"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

// ConnectRedis dials Redis using REDIS_ADDR (+ optional REDIS_PASSWORD).
// Set REDIS_TLS=true when connecting to a managed Redis that requires TLS
// (Upstash, Redis Cloud, etc.) — local Docker Redis doesn't need it.
func ConnectRedis() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	opts := &redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	}
	if os.Getenv("REDIS_TLS") == "true" {
		opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	RedisClient = redis.NewClient(opts)

	if err := RedisClient.Ping(Ctx).Err(); err != nil {
		log.Fatalf("redis connect error: %v", err)
	}
	log.Println("Redis connected:", addr)
}
