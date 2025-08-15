package routes

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

const (
	MSG_TYPE_BEGIN = 1
	MSG_TYPE_END   = 2
	MSG_TYPE_MOVE  = 3
	MSG_TYPE_ABORT = 4
	MSG_TYPE_WIN   = 5
	MSG_TYPE_LOSE  = 6

	GNUGO_RATING = 1800
)

func getRating(username string) int {
	db := database.GetDatabase()
	query := "SELECT rating FROM users WHERE username = $1"

	var rating int
	err := db.QueryRow(query, username).Scan(&rating)
	if err != nil {
		return 400
	}

	return rating
}

func addGameToDb(g *core.Game) error {
	player := "white"
	if g.Player.Color == core.BlackCell {
		player = "black"
	}

	db := database.GetDatabase()

	var gameid string
	selectQuery := "SELECT gameid FROM games WHERE gameid = $1"
	if err := db.QueryRow(selectQuery, g.Id).Scan(&gameid); err != nil {
		if err != sql.ErrNoRows {
			return err
		}
	}

	if gameid == g.Id {
		updateQuery := fmt.Sprintf(`
			UPDATE games SET %s = $2 WHERE gameid = $1`,
			player,
		)
		if _, err := db.Exec(updateQuery, g.Id, g.Player.Username); err != nil {
			return err
		}
	} else {
		insertQuery := fmt.Sprintf(`
			INSERT INTO games (gameid, %s) VALUES ($1, $2)`,
			player,
		)

		if _, err := db.Exec(insertQuery, g.Id, g.Player.Username); err != nil {
			return err
		}
	}

	return nil
}

func startGame(g *core.Game) {
	log.Println("New match has started")

	g.InitGame()
	g.Player.Rating = getRating(g.Player.Username)
	g.Player.Wsc.WriteJSON(
		core.StartMsg{Start: 1, Color: g.Player.Color, GameId: g.Id},
	)

	core.Pmap[g.Player.Username] = g
	g.Over = make(chan bool)
	if err := addGameToDb(g); err != nil {
		log.Println("Error occurred in adding Game data:", err)
		return
	}

	go core.PlayGame(g)
	go core.MonitorTimeout(g)
}

func reconnect(username string, c *websocket.Conn) bool {
	g, ok := core.Pmap[username]
	if !ok || g == nil {
		return false
	}

	g.Player.DisConn = false
	g.Player.Wsc = c
	g.Player.Wsc.WriteJSON(
		core.StartMsg{Start: 1, Color: g.Player.Color, GameId: g.Id},
	)
	go core.PlayGame(g)

	log.Println("Player reconnected", username)
	return true
}

func getUsername(ctx *gin.Context) string {
	usernameInterface, exists := ctx.Get("username")
	if !exists {
		ctx.JSON(400, gin.H{"error": "User claims not found"})
		ctx.Abort()
		return ""
	}

	username, ok := usernameInterface.(string)
	if !ok {
		ctx.JSON(400, gin.H{"error": "Username is not a valid string"})
		ctx.Abort()
		return ""
	}

	return username
}

func getPlayerGame(username string) (string, error) {
	hashKey := "live_game"

	gameID, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashKey, username).Result()
	if err == redis.Nil {
		return "", fmt.Errorf("player %s is not in a live game", username)
	} else if err != nil {
		return "", fmt.Errorf("failed to get game data: %w", err)
	}
	return gameID, nil
}

func getOpName(gameId string) (string, error) {
	hashKey := "live_game"

	jsonData, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashKey, gameId).Result()
	if err != nil {
		return "", fmt.Errorf("failed to get players name: %w", err)
	}
	return jsonData, nil
}

func setupGame(g *core.Game) {
	var jsondata string
	var err error
	var players map[string]any
	var gameData map[string]any

	jsondata, err = getPlayerGame(g.Player.Username)
	if err != nil {
		log.Println("Error getting player game", err)
		return
	}

	err = json.Unmarshal([]byte(jsondata), &gameData)
	if err != nil {
		log.Println("Error in Unmarshalling json for setupGame: ", err)
		return
	}

	jsondata, err = getOpName(g.Id)
	if err != nil {
		log.Println("Error getting Op name from redis", err)
		return
	}

	err = json.Unmarshal([]byte(jsondata), &players)
	if err != nil {
		log.Println("Error in Unmarshalling json for setupGame: ", err)
		return
	}

	g.Id = gameData["gameId"].(string)
	g.Player.Color = int(gameData["color"].(float64))
	if g.Player.Color == core.BlackCell {
		g.OpName = players["white"].(string)
	} else {
		g.OpName = players["black"].(string)
	}
	startGame(g)
}

func ConnectPlayer(ctx *gin.Context) {
	w, r := ctx.Writer, ctx.Request
	gameType := ctx.Query("type")
	username := getUsername(ctx)
	if len(username) == 0 {
		return
	}

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ConnectPlayer:", err)
		return
	}

	if gameType == "reconnect" {
		if ok := reconnect(username, c); !ok {
			c.WriteMessage(
				websocket.TextMessage,
				[]byte("Error in reconnecting"),
			)
		}
		return
	}

	game := new(core.Game)
	game.Player = new(core.Player)
	game.Player.Game = game
	game.Player.Username = username
	game.Player.Wsc = c

	go setupGame(game)
}
