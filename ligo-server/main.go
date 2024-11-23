package main

import (
    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
    "github.com/vanshjangir/ligo/ligo-server/internal/routes"
)

func main(){
    r := gin.Default()

    r.Use(cors.New(cors.Config{
        AllowOrigins:   []string{"*"},
        AllowMethods:   []string{"*"},
        AllowHeaders:   []string{"*"},
    }));

    r.GET("/game", routes.ConnectPlayer)
    r.Run()
}
