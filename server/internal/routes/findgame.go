package routes

import (
	"encoding/json"
	"log"
	"os"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/vanshjangir/rapid-go/server/internal/core"
	"github.com/vanshjangir/rapid-go/server/internal/pubsub"
)

type UserHashData struct {
	GameId string `json:"gameId"`
	Color  int    `json:"color"`
}

type GameHashData struct {
	White string `json:"white"`
	Black string `json:"black"`
}

type PlayerExists struct {
	mu     sync.Mutex
	Ch     chan string
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

func addGame(gameId string, gameHashData GameHashData, color int) {
	hashkey := "live_game"
	exists, err := pubsub.Rdb.HExists(pubsub.RdbCtx, hashkey, gameId).Result()
	if err != nil {
		panic(err)
	}
	if exists == true {
		jsondata, err := pubsub.Rdb.HGet(pubsub.RdbCtx, hashkey, gameId).Result()
		if err != nil {
			return
		}
		var tempData GameHashData
		if err := json.Unmarshal([]byte(jsondata), &tempData); err != nil {
			log.Println("Error in Unmarshalling json for setupGame: ", err)
			return
		}
		if color == core.BlackCell {
			gameHashData.Black = tempData.Black
		} else {
			gameHashData.White = tempData.White
		}
	}

	jsondata, err := json.Marshal(gameHashData)
	if err != nil {
		log.Println("Error marshling user hashdata", err)
		return
	}
	err = pubsub.Rdb.HSet(pubsub.RdbCtx, hashkey, gameId, jsondata).Err()
	if err != nil {
		log.Printf("Failed to set player %v to game %v: %v\n",
			gameId, gameHashData, err)
	} else {
		log.Printf("Player %s is now in game %v\n", gameId, gameHashData)
	}
}

func FindGame(ctx *gin.Context) {
	var userHashData UserHashData
	var gameHashData GameHashData
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
		Pe.flip()
		userHashData.GameId = <-Pe.Ch
		userHashData.Color = core.BlackCell
		gameHashData.Black = username
	} else {
		Pe.flip()
		userHashData.GameId = core.GetUniqueId()
		Pe.Ch <- userHashData.GameId
		userHashData.Color = core.WhiteCell
		gameHashData.Black = username
	}

	addPlayer(username, userHashData)
	addGame(userHashData.GameId, gameHashData, userHashData.Color)
	ctx.JSON(200, gin.H{
		"wsurl": os.Getenv("WSURL"),
	})
}
