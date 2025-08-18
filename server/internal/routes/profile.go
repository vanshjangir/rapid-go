package routes

import (
	"database/sql"
	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"log"
)

type RecentGame struct {
	GameId    string `json:"gameid"`
	Opponent  string `json:"opponent"`
	Result    string `json:"result"`
	CreatedAt string `json:"created_at"`
}

type UserProfileData struct {
	Name          string       `json:"name"`
	Rating        int          `json:"rating"`
	GamesPlayed   int          `json:"gamesPlayed"`
	Wins          int          `json:"wins"`
	Losses        int          `json:"losses"`
	HighestRating int          `json:"highestRating"`
	RecentGames   []RecentGame `json:"recentGames"`
}

func Profile(ctx *gin.Context) {
	db := database.GetDatabase()
	username := ctx.Query("username")

	var query string
	var data UserProfileData
	data.Name = username

	query = `
	SELECT
	(SELECT rating FROM users WHERE username = $1) AS user_rating,
	(SELECT highestrating FROM users WHERE username = $1) AS highest_rating,
	(SELECT COUNT(*) FROM games WHERE (white = $1 AND winner = 0)
	OR
	(black = $1 AND winner = 1)) AS games_won,
	(SELECT COUNT(*) FROM games WHERE white = $1 OR black = $1) AS games_played;
	`

	if err := db.QueryRow(query, username).Scan(
		&data.Rating, &data.HighestRating, &data.Wins, &data.GamesPlayed,
	); err == sql.ErrNoRows {
		log.Println("Error fetching games won")
		ctx.JSON(400, gin.H{"error": "username not found"})
		return
	}

	data.Losses = data.GamesPlayed - data.Wins

	query = `
	SELECT gameid, white, black, winner, created_at
	FROM
	games
	WHERE (black = $1 OR white = $1)
	AND winner IS NOT NULL
	ORDER BY created_at DESC LIMIT 10`

	if rows, err := db.Query(query, username); err != nil {
		log.Println("Error fetching recent games:", err)
		ctx.JSON(400, gin.H{"error": "username not found"})
		return
	} else {
		for rows.Next() {
			var recentGame RecentGame
			var white string
			var black string
			var winner int
			rows.Scan(
				&recentGame.GameId, &white, &black, &winner,
				&recentGame.CreatedAt,
			)

			if white == username {
				if winner == 1 {
					recentGame.Result = "Lost"
				} else {
					recentGame.Result = "Won"
				}
				recentGame.Opponent = black
			} else {
				if winner == 0 {
					recentGame.Result = "Lost"
				} else {
					recentGame.Result = "Won"
				}
				recentGame.Opponent = white
			}
			data.RecentGames = append(data.RecentGames, recentGame)
		}
	}

	ctx.JSON(200, data)
}
