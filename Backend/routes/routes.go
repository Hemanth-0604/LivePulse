package routes

import (
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"livepulse-backend/controllers"
	"livepulse-backend/middleware"
)

func Setup() *gin.Engine {
	r := gin.Default()

	origins := []string{"http://localhost:5173"}
	if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			origins = append(origins, strings.TrimSpace(o))
		}
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		auth.POST("/signup", controllers.Signup)
		auth.POST("/login", controllers.Login)

		polls := api.Group("/polls")
		polls.POST("", middleware.JWTAuth(), controllers.CreatePoll)
		polls.GET("/:code", controllers.GetPoll)
		polls.POST("/:code/vote", controllers.Vote)
	}

	r.GET("/ws/polls/:code", controllers.PollSocket)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	return r
}
