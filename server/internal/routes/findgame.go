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

func addPlayer(username string, hashdata UserHashData) {
	hashkey := "live_game"
	jsondata, err := json.Marshal(hashdata)
	if err != nil {
		log.Println("Error marshling user hashdata", err)
		return
	}

	err = pubsub.Rdb.HSet(pubsub.RdbCtx, hashkey, username, jsondata).Err()
	if err != nil {
		log.Printf("Failed to set player %v to game %v: %v\n",
			username, hashdata, err)
	} else {
		log.Printf("Player %s is now in game %v\n", username, hashdata)
	}
}

func FindGame(ctx *gin.Context) {
	var hashdata UserHashData
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
		hashdata.GameId = <-Pe.Ch
		hashdata.Color = core.BlackCell
	} else {
		Pe.flip()
		hashdata.GameId = core.GetUniqueId()
		Pe.Ch <- hashdata.GameId
		hashdata.Color = core.WhiteCell
	}

	addPlayer(username, hashdata)
	ctx.JSON(200, gin.H{
		"wsurl": os.Getenv("WSURL"),
	})
}
