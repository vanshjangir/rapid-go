package routes

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

func spectateGame(wsc *websocket.Conn, gameId string, black string) {
	ps := pubsub.Rdb.Subscribe(pubsub.RdbCtx, gameId)
	defer ps.Unsubscribe(pubsub.RdbCtx, gameId)
	defer wsc.Close()
	defer ps.Close()

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

		if pubsubMsg.Type == "move" {
			var moveMsg core.MoveMsg
			if err := json.Unmarshal(pubsubMsg.Data, &moveMsg); err != nil {
				log.Println("Error unmarshaling moveMsg in PubsubRecv:", err)
				break
			}

			if pubsubMsg.Player != black {
				// if white, then swap because spectator is a Black Player
				moveMsg.SelfTime, moveMsg.OpTime = moveMsg.OpTime, moveMsg.SelfTime
			}

			if err := wsc.WriteJSON(moveMsg); err != nil {
				log.Println("Error sending data from redis to client:", err)
				break
			}
		} else if pubsubMsg.Type == "gameover" {
			if err := wsc.WriteMessage(websocket.TextMessage, pubsubMsg.Data); err != nil {
				log.Println("Error sending data from redis to client:", err)
			}
			break
		}
	}
}

func getGameFromRedis(gameId string) (core.GameDataRedis, error) {
	var gdr core.GameDataRedis
	hashkey := "live_game"
	jsondata, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashkey, gameId).Result()
	if err != nil {
		return gdr, fmt.Errorf(
			"Failed to get Game Data from redis %v", err,
		)
	} else {
		if err := json.Unmarshal([]byte(jsondata), &gdr); err != nil {
			log.Println("Error in Unmarshalling json for setupGame: ", err)
			return gdr, fmt.Errorf(
				"Error in Unmarshalling json for setupGame: %v", err,
			)
		}
		return gdr, nil
	}
}

func sendSyncStateSpectator(wsc *websocket.Conn, gdr core.GameDataRedis) {
	var syncMsg core.SyncMsg
	syncMsg.Type = "sync"
	syncMsg.Color = core.BlackCell
	syncMsg.GameId = gdr.Id
	syncMsg.History = gdr.History
	syncMsg.PName = gdr.Black
	syncMsg.OpName = gdr.White
	syncMsg.SelfTime = gdr.BTime
	syncMsg.OpTime = gdr.WTime
	syncMsg.State = gdr.State
	syncMsg.Turn = gdr.Turn == core.BlackCell

	if gdr.Turn == core.BlackCell {
		syncMsg.SelfTime += time.Since(gdr.LastUpdated).Milliseconds()
	} else {
		syncMsg.OpTime += time.Since(gdr.LastUpdated).Milliseconds()
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

	gdr, err := getGameFromRedis(gameId)
	if err != nil {
		return
	}

	sendSyncStateSpectator(c, gdr)
	go spectateGame(c, gameId, gdr.Black)
}
