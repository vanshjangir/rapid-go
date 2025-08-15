package routes

import (
	"encoding/json"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

func spectateGame(wsc *websocket.Conn, gameId string) {
	ps := pubsub.Rdb.Subscribe(pubsub.RdbCtx, gameId)
	defer ps.Close()
	defer ps.Unsubscribe(pubsub.RdbCtx, gameId)

	_, err := ps.Receive(pubsub.RdbCtx)
	if err != nil {
		log.Println("Subscription to redis channel failed")
	}

	ch := ps.Channel()
	for msg := range ch {
		var pubsubMsg pubsub.PubsubMsg
		if err := json.Unmarshal([]byte(msg.Payload), &pubsubMsg); err != nil {
			log.Println("Error unmarshaling json in PubsubRecv", err)
			break
		}

		if pubsubMsg.Type != "move" && pubsubMsg.Type != "gameover" {
			continue
		}

		if err := wsc.WriteMessage(websocket.TextMessage, pubsubMsg.Data); err != nil {
			log.Println("Error sending data from redis to client:", err)
			break
		}

		if pubsubMsg.Type == "gameover" {
			break
		}
	}
}

func getPlayer(gameId string) string {
	hashkey := "live_game"
	jsondata, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashkey, gameId).Result()
	if err != nil {
		return ""
	} else {
		var tempData map[string]any
		if err := json.Unmarshal([]byte(jsondata), &tempData); err != nil {
			log.Println("Error in Unmarshalling json for setupGame: ", err)
			return ""
		}
		return tempData["black"].(string)
	}
}

func sendSyncState(wsc *websocket.Conn, gameId string) {
	player := getPlayer(gameId)
	g := core.Pmap[player]

	var syncMsg core.SyncMsg
	syncMsg.Type = "sync"
	syncMsg.Color = g.Player.Color
	syncMsg.GameId = g.Id
	syncMsg.History = g.History
	syncMsg.SelfTime = g.GetTime(g.Player.Color)
	syncMsg.OpTime = g.GetTime(1 - g.Player.Color)

	if state, err := g.Board.Encode(); err != nil {
		log.Println("Error encoding board state:", err)
	} else {
		syncMsg.State = state
	}

	if err := wsc.WriteJSON(syncMsg); err != nil {
		log.Println("Error sending sync msg:", err)
	}
}

func Spectate(ctx *gin.Context) {
	w, r := ctx.Writer, ctx.Request
	gameId := ctx.Param("gameId")

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ConnectPlayer:", err)
		return
	}

	sendSyncState(c, gameId)
	go spectateGame(c, gameId)
}
