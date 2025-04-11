package routes

import (
    "github.com/gin-gonic/gin"
    "github.com/vanshjangir/rapid-go/server/internal/core"
)

type PendingReqData struct {
    Username string `json:"username"`
}

func IsPending(ctx *gin.Context) {
    var pData PendingReqData
    if err := ctx.ShouldBindHeader(&pData); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid request body"})
        return
    }

    _, ok := core.Pmap[pData.Username]
    if ok {
        ctx.JSON(200, gin.H{"status": "present"});
    } else {
        ctx.JSON(200, gin.H{"status": "absent"});
    }
}
