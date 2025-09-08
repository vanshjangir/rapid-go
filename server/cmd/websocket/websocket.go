package main

import (
	"log"
	"os"
	"crypto/tls"

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
	redisAddr := os.Getenv("REDIS_ADDR")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	useTLS := os.Getenv("REDIS_TLS") == "true"

	opts := &redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
	}

	if useTLS {
		opts.Username = "default"
		opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	pubsub.Rdb = redis.NewClient(opts)

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
	r.GET("/spectate/:gameId", middleware.WsAuth, routes.Spectate)

	r.GET("/ispending", middleware.HttpAuth, routes.IsPending)

	if err := godotenv.Load("../../.dev.env"); err != nil {
		log.Println("Error loading env variables: ", err)
	}

	core.Pmap = make(map[string]*core.Game)

	db := database.GetDatabase()
	defer db.Close()

	setupRedis()

	r.Run(":8000")
}
