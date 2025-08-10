package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/vanshjangir/rapid-go/server/internal/database"
	"github.com/vanshjangir/rapid-go/server/internal/middleware"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
	"github.com/vanshjangir/rapid-go/server/internal/routes"
)

func setupRedis() {
	pubsub.Rdb = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
}

func main() {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"*"},
		AllowHeaders: []string{"*"},
	}))

	r.GET("/profile", routes.Profile)
	r.GET("/review", routes.Review)
	r.GET("/findgame", middleware.HttpAuth, routes.FindGame)

	r.POST("/login", routes.Login)
	r.POST("/signup", routes.Signup)
	r.POST("/changeusername", middleware.HttpAuth, routes.ChangeUsername)

	if err := godotenv.Load("../../.env"); err != nil {
		log.Fatal("Error loading env variables: ", err)
		return
	}

	routes.Pe = new(routes.PlayerExists)
	routes.Pe.Ch = make(chan string)
	routes.Pe.Exists = false

	db := database.GetDatabase()
	defer db.Close()

	setupRedis()

	r.Run()
}
