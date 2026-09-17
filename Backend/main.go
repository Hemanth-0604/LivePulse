package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"

	"livepulse-backend/config"
	"livepulse-backend/routes"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	config.ConnectMongo()
	config.ConnectRedis()

	r := routes.Setup()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("LivePulse backend listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
