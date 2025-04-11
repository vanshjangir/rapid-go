package main

import (
    "log"

    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
    "github.com/joho/godotenv"
    _ "github.com/lib/pq"

    "github.com/vanshjangir/rapid-go/server/internal/core"
    "github.com/vanshjangir/rapid-go/server/internal/routes"
    "github.com/vanshjangir/rapid-go/server/internal/database"
    "github.com/vanshjangir/rapid-go/server/internal/middleware"
)

func main(){
    r := gin.Default()

    r.Use(cors.New(cors.Config{
        AllowOrigins:   []string{"*"},
        AllowMethods:   []string{"*"},
        AllowHeaders:   []string{"*"},
    }));

    r.GET("/game", middleware.WsAuth, routes.ConnectPlayer)
    r.GET("/againstbot", middleware.WsAuth, routes.ConnectAgainstBot)
    r.GET("/isPending", routes.IsPending)
    r.GET("/profile", routes.Profile)
    
    r.POST("/login", routes.Login)
    r.POST("/signup", routes.Signup)
    r.POST("/changeusername", middleware.HttpAuth, routes.ChangeUsername)

    if err := godotenv.Load(); err != nil {
        log.Fatal("Error loading env variables: ", err);
        return
    }

    core.Pmap = make(map[string]*core.Game)

    db := database.ConnectDatabase()
    defer db.Close()

    r.Run()
}
