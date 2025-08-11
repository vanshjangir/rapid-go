package routes

import (
	"os"

	"github.com/gin-gonic/gin"
)

func GetWsurl(ctx *gin.Context) {
	ctx.JSON(200, gin.H{"wsurl": os.Getenv("WSURL")})
}
