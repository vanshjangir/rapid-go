package routes

import (
	"database/sql"
	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/database"
)

type ReviewReqData struct {
	GameId string `json:"gameid"`
}

func Review(ctx *gin.Context) {
	db := database.GetDatabase()
	gameid := ctx.Query("gameid")

	var moves string
	query := "SELECT moves FROM games WHERE gameid = $1"

	err := db.QueryRow(query, gameid).Scan(&moves)
	if err != nil {
		if err == sql.ErrNoRows {
			ctx.JSON(404, gin.H{"error": "Game not found"})
		} else {
			ctx.JSON(500, gin.H{"error": "Server error"})
		}
		return
	}

	ctx.JSON(200, gin.H{
		"moves": moves,
	})
}
