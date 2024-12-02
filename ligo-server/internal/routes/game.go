package routes

import (
    "fmt"
    "log"
    "net/http"
    "encoding/json"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "github.com/vanshjangir/ligo/ligo-server/internal/core"
)

var pendingWS *websocket.Conn = nil
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true
    },
}

const (
    MSG_TYPE_BEGIN = 1
    MSG_TYPE_END = 2
    MSG_TYPE_MOVE = 3
    MSG_TYPE_ABORT = 4
    MSG_TYPE_WIN = 5
    MSG_TYPE_LOSE = 6
)

func handleMove(p *core.Player, msgBytes []byte, ) error {

    var moveMsg core.MoveMsg
    var moveStatus core.MoveStatusMsg

    moveMsg.Type = "move"
    moveStatus.Type = "movestatus"

    if err := json.Unmarshal(msgBytes, &moveMsg); err != nil {
        return fmt.Errorf("Error unmarshing move msg: %v", err)
    }

    if ok := p.Game.CheckTurn(p.Color); !ok {
        moveStatus.MoveStatus = false
        moveStatus.TurnStatus = false
        moveStatus.Move = moveMsg.Move
        p.SelfConn.WriteJSON(moveStatus)
        return nil
    }

    if ok := p.Game.CheckValidMove(moveMsg.Move, p.Color); !ok {
        moveStatus.TurnStatus = true
        moveStatus.MoveStatus = false
        moveStatus.Move = moveMsg.Move
        p.SelfConn.WriteJSON(moveStatus)
        return nil
    }

    p.Game.UpdateState(moveMsg.Move, p.Color)

    if p.Color == 1 {
        p.Game.Turn = 0
    } else {
        p.Game.Turn = 1
    }

    moveStatus.MoveStatus = true
    moveStatus.TurnStatus = true
    moveStatus.Move = moveMsg.Move
    p.SelfConn.WriteJSON(moveStatus)

    if err := p.OpConn.WriteJSON(moveMsg); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }

    return nil
}

func handleGameOver(p *core.Player, winner int) {
    winMsg := new(core.WinMsg)
    winMsg.Type = "win"
    loseMsg := new(core.LoseMsg)
    loseMsg.Type = "lose"

    if p.Color == winner {
        if err := p.SelfConn.WriteJSON(winMsg); err != nil {
            log.Println("Error sending win msg to p:", err)
        }

        if err := p.OpConn.WriteJSON(loseMsg); err != nil {
            log.Println("Error sending lose msg to op:", err)
        }
    } else {
        if err := p.SelfConn.WriteJSON(loseMsg); err != nil {
            log.Println("Error sending lose msg to p:", err)
        }

        if err := p.OpConn.WriteJSON(winMsg); err != nil {
            log.Println("Error sending win msg to op:", err)
        }
    }
    
    
    if err := p.OpConn.Close(); err != nil {
        log.Println("Error closing conn op:", err)
    }
}

func handleSyncState(p *core.Player) {
    var syncMsg core.SyncMsg
    syncMsg.Type = "sync"
    syncMsg.Color = p.Color
    syncMsg.GameId = p.Game.Id
    if p.Game.Turn == p.Color {
        syncMsg.Turn = true
    }
    syncMsg.State = p.Game.State
    syncMsg.Liberty = p.Game.Liberty
    syncMsg.History = string(p.Game.History)

    if err := p.SelfConn.WriteJSON(syncMsg); err != nil {
        log.Println("Error sending sync msg:", err)
    }
}

func playGame(p *core.Player) {
    defer p.SelfConn.Close()

    gameloop:
    for{
        _, msgBytes, err := p.SelfConn.ReadMessage()
        if err != nil {
            log.Println("Error reading message:", err)
            break gameloop
        }

        var msg core.MsgType
        if err := json.Unmarshal(msgBytes, &msg); err != nil {
            log.Println("Error unmarshling msg type:", err)
            break gameloop
        }

        switch msg.Type {
        case "move":
            if err := handleMove(p, msgBytes); err != nil {
                log.Println(err)
                break gameloop
            }

            if ok, winner := p.Game.IsOver(); ok {
                handleGameOver(p, winner)
                break gameloop
            }

        case "abort":
            winner := p.Color
            if winner == 1 {
                winner = 0
            } else {
                winner = 1
            }
            handleGameOver(p, winner)
            break gameloop

        case "reqState":
            handleSyncState(p)

        case "chat":
        }

    }

    log.Println("Game Ends")
}

func startGame(game *core.Game) {
    log.Println("New match has started")

    game.InitGame()
    game.P1.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: "gameId"})
    game.P2.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: "gameId"})
    
    go playGame(game.P1)
    go playGame(game.P2)
}

func ConnectPlayer(ctx *gin.Context) {
    w, r := ctx.Writer, ctx.Request
    c, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("ConnectPlayer:", err)
        return
    }

    if pendingWS == nil {
        pendingWS = c
        if err := c.WriteMessage(websocket.TextMessage, []byte("pending"));
        err != nil {
            log.Println("Error sending pending msg:", err)
            c.Close()
        }
    } else {
        game := new(core.Game)
        game.P1 = new(core.Player)
        game.P2 = new(core.Player)
        game.P1.Game = game
        game.P2.Game = game
        
        game.P1.SelfConn = pendingWS
        game.P2.SelfConn = c
        pendingWS = nil
        startGame(game)
    }
}
