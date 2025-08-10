package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/core"
)

func IsPending(ctx *gin.Context) {
	usernameItf, exists := ctx.Get("username")
	if !exists {
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	username, ok := usernameItf.(string)
	if !ok {
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	_, ok = core.Pmap[username]
	if ok {
		ctx.JSON(200, gin.H{"status": "present"})
	} else {
		ctx.JSON(200, gin.H{"status": "absent"})
	}
}
