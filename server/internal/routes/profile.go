package routes

import (
    "log"
    "time"
    "database/sql"
    "github.com/gin-gonic/gin"
    "github.com/vanshjangir/rapid-go/server/internal/database"
)

type RecentGame struct {
    Opponent    string  `json:"opponent"`
    Result      string  `json:"result"`
    Date        string  `json:"date"`
}

type UserProfileData struct {
    Name            string  `json:"name"`
    Rating          int     `json:"rating"`
    GamesPlayed     int     `json:"gamesPlayed"`
    Wins            int     `json:"wins"`
    Losses          int     `json:"losses"`
    HighestRating   int     `json:"highestRating"`
    RecentGames     []RecentGame `json:"recentGames"`
}

func Profile(ctx *gin.Context) {
    db := database.ConnectDatabase()
    username := ctx.Query("username")

    var data UserProfileData
    data.Name = username

    query := "SELECT rating, highestrating FROM users WHERE username = $1"
    if err := db.QueryRow(query, username).Scan(&data.Rating, &data.HighestRating);
    err == sql.ErrNoRows {
        log.Println("Error fetching rating highestrating")
        ctx.JSON(400, gin.H{"error": "username not found"})
        return
    }
    
    query = "SELECT COUNT(*) FROM games WHERE white = $1 OR black = $1"
    if err := db.QueryRow(query, username).Scan(&data.GamesPlayed);
    err == sql.ErrNoRows {
        log.Println("Error fetching games played")
        ctx.JSON(400, gin.H{"error": "username not found"})
        return
    }
    
    query = "SELECT COUNT(*) FROM games WHERE (white = $1 AND winner = 1) OR (black = $1 AND winner = 0)"
    if err := db.QueryRow(query, username).Scan(&data.Wins);
    err == sql.ErrNoRows {
        log.Println("Error fetching games won")
        ctx.JSON(400, gin.H{"error": "username not found"})
        return
    }

    data.Losses = data.GamesPlayed - data.Wins

    query = "SELECT white, black, winner, date FROM games WHERE black = $1 OR white = $1 ORDER BY created_at DESC LIMIT 10"
    if rows, err := db.Query(query, username);
    err != nil {
        log.Println("Error fetching recent games:",err)
        ctx.JSON(400, gin.H{"error": "username not found"})
        return
    } else {
        for rows.Next() {
            var recentGame RecentGame
            var white string
            var black string
            var date time.Time
            var winner int
            rows.Scan(&white, &black, &winner, &date);
            
            if white == username {
                if winner == 0 {
                    recentGame.Result = "Lost"
                } else {
                    recentGame.Result = "Won"
                }
                recentGame.Opponent = black
            } else {
                if winner == 1 {
                    recentGame.Result = "Lost"
                } else {
                    recentGame.Result = "Won"
                }
                recentGame.Opponent = white
            }
            recentGame.Date = date.String()
            data.RecentGames = append(data.RecentGames, recentGame)
        }

    }

    ctx.JSON(200, data)
}
