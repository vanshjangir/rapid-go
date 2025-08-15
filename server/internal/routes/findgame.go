package routes

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

type UserHashData struct {
	GameId string `json:"gameId"`
	Color  int    `json:"color"`
}

type GameStarterData struct {
	GameId   string `json:"gameId"`
	Username string `json:"white"`
}

type PlayerExists struct {
	mu     sync.Mutex
	Ch     chan GameStarterData
	Exists bool
}

var Pe *PlayerExists

func (pe *PlayerExists) doesExists() bool {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	return pe.Exists
}

func (pe *PlayerExists) flip() {
	pe.mu.Lock()
	defer pe.mu.Unlock()
	pe.Exists = !pe.Exists
}

func addPlayer(username string, userHashData UserHashData) {
	hashkey := "live_game"
	jsondata, err := json.Marshal(userHashData)
	if err != nil {
		log.Println("Error marshling user hashdata", err)
		return
	}

	err = pubsub.Rdb.HSet(pubsub.RdbCtx, hashkey, username, jsondata).Err()
	if err != nil {
		log.Printf("Failed to set player %v to game %v: %v\n",
			username, userHashData, err)
	} else {
		log.Printf("Player %s is now in game %v\n", username, userHashData)
	}
}

func addGame(gameId string, black string, white string) {
	hashkey := "live_game"

	var gdr core.GameDataRedis
	gdr.Black = black
	gdr.White = white
	gdr.Turn = core.BlackCell
	gdr.Id = gameId

	jsondata, err := json.Marshal(gdr)
	if err != nil {
		log.Println("Error marshling user hashdata", err)
		return
	}

	err = pubsub.Rdb.HSet(pubsub.RdbCtx, hashkey, gameId, jsondata).Err()
	if err != nil {
		log.Printf(
			"Failed to set game data %v to game %v: %v\n",
			gdr, gameId, err,
		)
	} else {
		log.Printf("Game data added in redis for %v : %v", gameId, gdr)
	}

	err = pubsub.Rdb.Expire(pubsub.RdbCtx, hashkey, 35*60*time.Second).Err()
	if err != nil {
		log.Printf(
			"Failed to set expiration on game id %v: %v\n",
			gameId, err,
		)
	}
}

func FindGame(ctx *gin.Context) {
	var userHashData UserHashData
	var gameStarterData GameStarterData
	usernameItf, exists := ctx.Get("username")
	if !exists {
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	username, ok := usernameItf.(string)
	if !ok {
		ctx.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	if Pe.doesExists() == false {
		// wait for the other player to join, which will send gameId
		// and his username to this player

		Pe.flip()
		gameStarterData = <-Pe.Ch
		userHashData.GameId = gameStarterData.GameId
		userHashData.Color = core.BlackCell

		addGame(
			userHashData.GameId,
			username,                 // black player username
			gameStarterData.Username, // white player username
		)
	} else {
		// generate the game id, and send it to the channel
		// where a player is already waiting
		Pe.flip()
		gameStarterData.GameId = core.GetUniqueId()
		gameStarterData.Username = username
		Pe.Ch <- gameStarterData
		userHashData.GameId = gameStarterData.GameId
		userHashData.Color = core.WhiteCell
	}

	addPlayer(username, userHashData)
	ctx.JSON(200, gin.H{
		"wsurl": os.Getenv("WSURL"),
	})
}
