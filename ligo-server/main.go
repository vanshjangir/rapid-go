package main

import (
    "log"

    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
    "github.com/joho/godotenv"
    _ "github.com/lib/pq"

    "github.com/vanshjangir/ligo/ligo-server/internal/routes"
    "github.com/vanshjangir/ligo/ligo-server/internal/database"
    "github.com/vanshjangir/ligo/ligo-server/internal/middleware"
)

func main(){
    r := gin.Default()

    r.Use(cors.New(cors.Config{
        AllowOrigins:   []string{"*"},
        AllowMethods:   []string{"*"},
        AllowHeaders:   []string{"*"},
    }));

    r.GET("/game", middleware.Auth, routes.ConnectPlayer)
    r.POST("/login", routes.Login)
    r.POST("/signup", routes.Signup)

    if err := godotenv.Load(); err != nil {
        log.Fatal("Error loading env variables: ", err);
        return
    }

    db := database.ConnectDatabase()
    defer db.Close()

    r.Run()
}
