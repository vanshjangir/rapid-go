package routes

import (
	"github.com/gin-gonic/gin"
	"os"
)

func GetWsUrl(ctx *gin.Context) {
	wsuri := os.Getenv("WSURL")
	ctx.JSON(200, gin.H{"url": wsuri})
}
