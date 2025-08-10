package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"log"
)

type ChangeUsernameType struct {
	Username    string `json:"username"`
	Newusername string `json:"newusername"`
}

func ChangeUsername(ctx *gin.Context) {
	db := database.GetDatabase()

	var cu ChangeUsernameType
	if err := ctx.ShouldBindJSON(&cu); err != nil {
		log.Println("JSON bind error: ", err)
		ctx.JSON(400, gin.H{"error": "Invalid JSON"})
		return
	}

	query := "SELECT * FROM users WHERE username = $1"
	var username string
	db.QueryRow(query).Scan(&username)
	if username != "" {
		ctx.JSON(400, gin.H{"error": "Username already exists"})
		return
	}

	query = "UPDATE users SET username = $1 WHERE username = $2"
	if _, err := db.Exec(query, cu.Newusername, cu.Username); err != nil {
		log.Println("DB query error: ", err)
		ctx.JSON(500, gin.H{"error": "Error updating username in users"})
		return
	}

	query = "UPDATE games SET white = $1 WHERE white = $2"
	if _, err := db.Exec(query, cu.Newusername, cu.Username); err != nil {
		log.Println("DB query error: ", err)
		ctx.JSON(500, gin.H{"error": "Error creating white in games"})
		return
	}

	query = "UPDATE games SET black = $1 WHERE black = $2"
	if _, err := db.Exec(query, cu.Newusername, cu.Username); err != nil {
		log.Println("DB query error: ", err)
		ctx.JSON(500, gin.H{"error": "Error creating black in games"})
		return
	}

	ctx.JSON(200, "Username changed successfully")
}
