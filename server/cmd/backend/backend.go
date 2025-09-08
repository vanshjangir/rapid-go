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

	r.GET("/profile", routes.Profile)
	r.GET("/review", routes.Review)
	r.GET("/findgame", middleware.HttpAuth, routes.FindGame)
	r.GET("/getwsurl", middleware.HttpAuth, routes.GetWsurl)

	r.POST("/login", routes.Login)
	r.POST("/signup", routes.Signup)
	r.POST("/changeusername", middleware.HttpAuth, routes.ChangeUsername)

	if err := godotenv.Load("../../.dev.env"); err != nil {
		log.Println("Error loading env variables: ", err)
	}

	routes.Pe = new(routes.PlayerExists)
	routes.Pe.Ch = make(chan routes.GameStarterData)
	routes.Pe.Exists = false

	db := database.GetDatabase()
	defer db.Close()

	setupRedis()

	r.Run()
}
