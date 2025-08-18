package core

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
	"math"

	"github.com/gorilla/websocket"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

var Pmap map[string]*Game

func MonitorTimeout(g *Game) {
	for {
		select {
		case <-g.Over:
			return
		default:
			if g.Player.DisConn && g.Player.CheckDisConnTime() {
				winner := 1 - g.Player.Color
				handleGameOver(g, winner, "discn")
				log.Println("Game over by disconnection")
				return
			}
			if g.CheckTimeout() {
				winner := 1 - g.Turn
				handleGameOver(g, winner, "time")
				log.Println("Game over by timeout")
				return
			}
			time.Sleep(1 * time.Second)
		}
	}
}

func saveGame(g *Game, winner int, wonby string) error {
	db := database.GetDatabase()
	updateQuery := `
		UPDATE games SET
		winner = $2, wonby = $3, moves = $4, date = $5
		WHERE gameid = $1
	`
	if _, err := db.Exec(
		updateQuery,
		g.Id,
		winner,
		wonby,
		strings.Join(g.History, "/"),
		time.Now().UTC(),
	); err != nil {
		return err
	}
	return nil
}

func getNewRating(pr int, opr int, won bool) int {
	score := 1.0
	if won == false{
		score = 0
	}
	expectedScore := 1/(1 + math.Pow(10, float64((pr - opr)/400)))
	var k float64 = 20
	newRating := float64(pr) + k*(score - expectedScore)
	return int(newRating)
}

func getOpRating(db *sql.DB, g *Game) int {
	query := `SELECT rating FROM users WHERE username = $1`
	opRating := 400
	if err := db.QueryRow(query, g.OpName).Scan(&opRating); err != nil {
		log.Println("Error fetching op rating", err)
	}
	return opRating
}

func updateRating(g *Game, winner int) error {
	db := database.GetDatabase()
	opRating := getOpRating(db, g)
	newRating := g.Player.Rating
	if winner == g.Player.Color {
		newRating = getNewRating(g.Player.Rating, opRating, true)
	} else {
		newRating = getNewRating(g.Player.Rating, opRating, false)
	}
	query := "UPDATE users SET rating = $1 WHERE username = $2"
	if _, err := db.Exec(query, newRating, g.Player.Username); err != nil {
		return err
	}

	return nil
}

func handleChat(g *Game, msgBytes []byte) error {
	jsonData := make(map[string]any)
	if err := json.Unmarshal(msgBytes, &jsonData); err != nil {
		log.Println("Error unmarshaling chat message", err)
		return err
	}
	sendToPubsub(g, jsonData, "chat")
	return nil
}

func handleSyncState(g *Game) {
	var syncMsg SyncMsg
	syncMsg.Type = "sync"
	syncMsg.Color = g.Player.Color
	syncMsg.PName = g.Player.Username
	syncMsg.OpName = g.OpName
	syncMsg.GameId = g.Id
	syncMsg.History = g.History
	syncMsg.SelfTime = g.GetTime(g.Player.Color)
	syncMsg.OpTime = g.GetTime(1 - g.Player.Color)

	if g.Player.Game.Turn == g.Player.Color {
		syncMsg.Turn = true
	}

	if state, err := g.Board.Encode(); err != nil {
		log.Println("Error encoding board state:", err)
	} else {
		syncMsg.State = state
	}

	if err := g.Player.Wsc.WriteJSON(syncMsg); err != nil {
		log.Println("Error sending sync msg:", err, syncMsg)
	}
}

func deleteFromRedis(key string) {
	hashKey := "live_game"

	exists, err := pubsub.Rdb.HExists(pubsub.RdbCtx, hashKey, key).Result()
	if err != nil {
		panic(err)
	}
	if exists == false {
		return
	}

	err = pubsub.Rdb.HDel(pubsub.RdbCtx, hashKey, key).Err()
	if err != nil {
		log.Println("Error deleting player name from redis Hashmap:", err)
	}
}

func handleGameOver(g *Game, winner int, wonby string) {
	var gameOverMsg GameOverMsg
	gameOverMsg.Type = "gameover"
	gameOverMsg.Winner = winner
	gameOverMsg.Message = wonby

	if err := g.Player.Wsc.WriteJSON(gameOverMsg); err != nil {
		log.Println("Error sending gameOverMsg msg to p:", err)
	}

	if err := g.Player.Wsc.Close(); err != nil {
		log.Println("Error closing conn loser:", err)
	}

	sendToPubsub(g, gameOverMsg, "gameover")

	if err := saveGame(g, winner, wonby); err != nil {
		log.Println("Error saving game state:", err)
	}

	if err := updateRating(g, winner); err != nil {
		log.Println("Error saving game state:", err)
	}

	delete(Pmap, g.Player.Username)
	deleteFromRedis(g.Player.Username)
	deleteFromRedis(g.Id)
	close(g.Over)
}

func sendToPubsub(g *Game, jsonData any, msgType string) {
	finalJsonData := make(map[string]any)
	finalJsonData["data"] = jsonData
	finalJsonData["type"] = msgType
	finalJsonData["player"] = g.Player.Username

	finalMsg, err := json.Marshal(finalJsonData)
	if err != nil {
		log.Println("Error marshalling json in sendToPubsub", err)
		return
	}

	err = pubsub.Rdb.Publish(pubsub.RdbCtx, g.Id, string(finalMsg)).Err()
	if err != nil {
		log.Println("Error publishing move to redis channel:", err)
	}
}

func updateStateInRedis(g *Game) {
	hashkey := "live_game"
	rawJsonString, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashkey, g.Id).Result()
	if err != nil {
		log.Println("Error Getting game data from redis:", err)
		return
	}

	var gdr GameDataRedis
	if err := json.Unmarshal([]byte(rawJsonString), &gdr); err != nil {
		log.Println("Error in Unmarshalling json of game data from redis:", err)
		return
	}

	gdr.History = g.History
	gdr.Turn = g.Turn
	gdr.BTime = g.GetTime(BlackCell)
	gdr.WTime = g.GetTime(WhiteCell)
	gdr.LastUpdated = time.Now()
	if state, err := g.Board.Encode(); err != nil {
		log.Println("Error encoding board state:", err)
	} else {
		gdr.State = state
	}

	if rawJsonByte, err := json.Marshal(gdr); err != nil {
		log.Println("Error marshalling game data to store in redis:", err)
	} else {
		err = pubsub.Rdb.HSet(
			pubsub.RdbCtx,
			hashkey,
			g.Id,
			string(rawJsonByte),
		).Err()
		if err != nil {
			log.Println(
				"Failed to set game data in redis while updating:\n", gdr, err,
			)
		}
	}
}

func handleMove(g *Game, msgBytes []byte) error {
	var moveMsg MoveMsg
	var moveStatus MoveStatusMsg
	moveMsg.Type = "move"
	moveStatus.Type = "movestatus"

	if err := json.Unmarshal(msgBytes, &moveMsg); err != nil {
		return fmt.Errorf("Error unmarshing move msg: %v", err)
	}

	if ok := g.CheckTurn(g.Player.Color); !ok {
		moveStatus.MoveStatus = false
		moveStatus.TurnStatus = false
		moveStatus.State, _ = g.Board.Encode()
		moveStatus.Move = moveMsg.Move
		g.Player.Wsc.WriteJSON(moveStatus)
		return nil
	}

	if _, err := g.UpdateState(moveMsg.Move, g.Player.Color); err != nil {
		moveStatus.TurnStatus = true
		moveStatus.MoveStatus = false
		moveStatus.State, _ = g.Board.Encode()
		moveStatus.Move = moveMsg.Move
		g.Player.Wsc.WriteJSON(moveStatus)
		log.Println("Error in updateState", err)

		// sending the user an alert that the move is invalid
		return nil
	}

	g.TapClock(g.Player.Color)
	g.Turn = 1 - g.Player.Color

	updateStateInRedis(g)

	moveStatus.MoveStatus = true
	moveStatus.TurnStatus = true
	moveStatus.State, _ = g.Board.Encode()
	moveStatus.Move = moveMsg.Move
	moveStatus.SelfTime = g.GetTime(g.Player.Color)
	moveStatus.OpTime = g.GetTime(1 - g.Player.Color)

	if err := g.Player.Wsc.WriteJSON(moveStatus); err != nil {
		return fmt.Errorf("Error sending move msg: %v", err)
	}

	jsonData := make(map[string]any)
	jsonData["type"] = moveMsg.Type
	jsonData["move"] = moveMsg.Move
	jsonData["state"] = moveStatus.State
	jsonData["selfTime"] = moveStatus.SelfTime
	jsonData["opTime"] = moveStatus.OpTime

	sendToPubsub(g, jsonData, "move")
	return nil
}

func handleRecv(g *Game) error {
	_, msgBytes, err := g.Player.Wsc.ReadMessage()
	if err != nil {
		g.Player.DisConn = true
		g.Player.DisConnTime.Start = time.Now()
		return fmt.Errorf("Error in reading on player %v: %v", g.Player.Color, err)
	}

	var msg MsgType
	if err := json.Unmarshal(msgBytes, &msg); err != nil {
		return fmt.Errorf("Error unmarshaling msg type: %v", err)
	}

	switch msg.Type {
	case "move":
		if err := handleMove(g, msgBytes); err != nil {
			return err
		}

		if winner := g.Player.Game.IsOver(); winner != -1 {
			handleGameOver(g, winner, "move")
			return fmt.Errorf("Game over by move")
		}

	case "abort":
		winner := 1 - g.Player.Color
		handleGameOver(g, winner, "abort")
		return fmt.Errorf("Game over by abort")

	case "reqState":
		handleSyncState(g)

	case "chat":
		handleChat(g, msgBytes)
	}

	return nil
}

func sendToClient(g *Game, msgBytes []byte) {
	if err := g.Player.Wsc.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
		log.Println("Error sending data from redis to client:", err)
	}
}

func handlePubsubMove(g *Game, msgBytes []byte) {
	var moveMsg MoveMsg
	if err := json.Unmarshal(msgBytes, &moveMsg); err != nil {
		log.Println("Error unmarshing move msg:", err)
	}

	if ok := g.CheckTurn(1 - g.Player.Color); !ok {
		fmt.Println("Not your turn")
		return
	}

	if _, err := g.UpdateState(moveMsg.Move, 1-g.Player.Color); err != nil {
		fmt.Println("Error in updateState", err)
		return
	}

	g.TapClock(1 - g.Player.Color)
	g.Turn = g.Player.Color

	// just switch the timing that op has sent, because it has sent the
	// timings with its perspective, we need to swap it
	moveMsg.SelfTime, moveMsg.OpTime = moveMsg.OpTime, moveMsg.SelfTime

	if rawjson, err := json.Marshal(moveMsg); err != nil {
		log.Println("Error marshalling moveMsg in handlePubsubMove:", err)
	} else {
		sendToClient(g, rawjson)
	}
}

func handleGameOverPubsub(g *Game, msgBytes []byte) {
	var gameOverMsg GameOverMsg
	if err := json.Unmarshal(msgBytes, &gameOverMsg); err != nil {
		log.Println("Error unmarshing chat msg:", err)
	}

	if err := g.Player.Wsc.WriteJSON(gameOverMsg); err != nil {
		log.Println("Error sending gameOverMsg msg to p:", err)
	}

	if err := g.Player.Wsc.Close(); err != nil {
		log.Println("Error closing conn loser:", err)
	}

	if err := updateRating(g, gameOverMsg.Winner); err != nil {
		log.Println("Error saving game state:", err)
	}

	delete(Pmap, g.Player.Username)
	deleteFromRedis(g.Player.Username)
	deleteFromRedis(g.Id)
	close(g.Over)
}

func PubsubRecv(g *Game) {
	ps := pubsub.Rdb.Subscribe(pubsub.RdbCtx, g.Id)
	g.Player.Ps = ps
	defer ps.Close()

	_, err := ps.Receive(pubsub.RdbCtx)
	if err != nil {
		log.Println("Subscription to redis channel failed")
	}

	ch := ps.Channel()
RecvLoop:
	for msg := range ch {
		var pubsubMsg pubsub.PubsubMsg
		if err := json.Unmarshal([]byte(msg.Payload), &pubsubMsg); err != nil {
			log.Println("Error unmarshaling json in PubsubRecv", err)
			return
		}

		if pubsubMsg.Player == g.Player.Username {
			continue
		}

		switch pubsubMsg.Type {
		case "move":
			handlePubsubMove(g, pubsubMsg.Data)

		case "chat":
			sendToClient(g, pubsubMsg.Data)

		case "gameover":
			handleGameOverPubsub(g, pubsubMsg.Data)
			break RecvLoop
		}
	}

	if err := ps.Unsubscribe(pubsub.RdbCtx, g.Id); err != nil {
		log.Println("Error Unsubscribing to channel")
	}
}

func PlayGame(g *Game) {
	go PubsubRecv(g)
	defer g.Player.Wsc.Close()
	for {
		if err := handleRecv(g); err != nil {
			log.Println(err)
		}

		if g.Player.DisConn {
			log.Println("Player diconnected")
			if err := g.Player.Ps.Unsubscribe(pubsub.RdbCtx, g.Id); err != nil {
				log.Println("Error Unsubscribing to channel")
			}
			break
		}
	}

	log.Println("Connection Ends from Player", g.Player.Color)
}
