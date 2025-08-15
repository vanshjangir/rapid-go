package routes

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/database"
)

func addBotEntry(g *core.Game) error {
	db := database.GetDatabase()
	updateQuery := `UPDATE games SET white = $2 WHERE gameid = $1`
	if _, err := db.Exec(updateQuery, g.Id, "bot"); err != nil {
		return err
	}
	return nil
}

func startGameBot(g *core.Game) {
	log.Println("New match has started")

	g.InitGame()
	g.Player.Rating = getRating(g.Player.Username)
	g.Player.Wsc.WriteJSON(
		core.StartMsg{Start: 1, Color: 1, GameId: g.Id},
	)

	core.Pmap[g.Player.Username] = g
	g.Over = make(chan bool)
	if err := addGameToDb(g); err != nil {
		log.Println("Error occurred in adding Game data:", err)
		return
	}

	if err := addBotEntry(g); err != nil {
		log.Println("Error occurred in adding Bot Entry:", err)
		return
	}

	go core.PlayGameBot(g)
}

func reconnectBot(username string, c *websocket.Conn) bool {
	game, ok := core.Pmap[username]
	if !ok || game == nil {
		return false
	}

	game.Player.DisConn = false
	game.Player.Wsc = c
	game.Player.Wsc.WriteJSON(
		core.StartMsg{Start: 1, Color: core.BlackCell, GameId: game.Id},
	)
	go core.PlayGameBot(game)

	log.Println("Player reconnected", username)
	return true
}

func setupGameBot(g *core.Game) {
	g.Id = core.GetUniqueId()
	g.Player.Color = core.BlackCell
	startGameBot(g)
}

func ConnectAgainstBot(ctx *gin.Context) {
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
		if ok := reconnectBot(username, c); !ok {
			c.WriteMessage(
				websocket.TextMessage,
				[]byte("Error in reconnecting"),
			)
		}
		return
	}

	g := new(core.Game)
	g.Player = new(core.Player)
	g.Player.Game = g
	g.Player.Username = username
	g.Player.Wsc = c

	setupGameBot(g)
}
