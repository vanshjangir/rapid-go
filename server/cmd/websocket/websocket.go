package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"github.com/vanshjangir/rapid-go/server/internal/middleware"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
	"github.com/vanshjangir/rapid-go/server/internal/routes"
)

func setupRedis() {
	pubsub.Rdb = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	_, err := pubsub.Rdb.Ping(pubsub.RdbCtx).Result()
	if err != nil {
		log.Fatalf("Could not connect to Redis: %v\n", err)
	}
	log.Println("Successfully connected to Redis!")
}

func main() {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"*"},
		AllowHeaders: []string{"*"},
	}))

	r.GET("/game", middleware.WsAuth, routes.ConnectPlayer)
	r.GET("/againstbot", middleware.WsAuth, routes.ConnectAgainstBot)

	r.GET("/ispending", middleware.HttpAuth, routes.IsPending)

	if err := godotenv.Load("../../.env"); err != nil {
		log.Fatal("Error loading env variables: ", err)
		return
	}

	core.Pmap = make(map[string]*core.Game)

	db := database.GetDatabase()
	defer db.Close()

	setupRedis()

	r.Run("localhost:8000")
}
