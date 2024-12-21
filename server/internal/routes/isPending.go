package routes

import (
    "fmt"
    "github.com/gin-gonic/gin"
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

    fmt.Println("USERname", pData.Username);

    _, ok := Pmap[pData.Username]
    if ok {
        ctx.JSON(200, gin.H{"status": "present"});
    } else {
        ctx.JSON(200, gin.H{"status": "absent"});
    }
}
