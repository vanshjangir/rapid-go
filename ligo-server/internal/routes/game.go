package routes

import (
    "fmt"
    "log"
    "time"
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

    p.Game.TapClock(p.Color)

    moveStatus.MoveStatus = true
    moveStatus.TurnStatus = true
    moveStatus.Move = moveMsg.Move
    moveStatus.SelfTime = p.Game.GetTime(p.Color)
    if p.Color == 1 {
        moveStatus.OpTime = p.Game.GetTime(0)
    } else {
        moveStatus.OpTime = p.Game.GetTime(1)
    }

    if err := p.SelfConn.WriteJSON(moveStatus); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }
    
    moveMsg.OpTime = moveStatus.SelfTime
    moveMsg.SelfTime = moveStatus.OpTime

    if err := p.OpConn.WriteJSON(moveMsg); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }

    return nil
}

func handleGameOver(g *core.Game, winner int) {
    winMsg := new(core.WinMsg)
    loseMsg := new(core.LoseMsg)
    winMsg.Type = "win"
    loseMsg.Type = "lose"

    wConn  := g.P1.SelfConn
    lConn  := g.P2.SelfConn
    if winner == g.P2.Color {
        wConn = g.P2.SelfConn
        lConn = g.P1.SelfConn
    }

    if err := wConn.WriteJSON(winMsg); err != nil {
        log.Println("Error sending win msg to p:", err)
    }

    if err := lConn.WriteJSON(loseMsg); err != nil {
        log.Println("Error sending lose msg to op:", err)
    }
    
    if err := wConn.Close(); err != nil {
        log.Println("Error closing conn winner:", err)
    }
    
    if err := lConn.Close(); err != nil {
        log.Println("Error closing conn loser:", err)
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

func handleRecv (p *core.Player) error {
    _, msgBytes, err := p.SelfConn.ReadMessage()
    if err != nil {
        return fmt.Errorf("Error in reading on player %v: %v", p.Color, err)
    }

    var msg core.MsgType
    if err := json.Unmarshal(msgBytes, &msg); err != nil {
        return fmt.Errorf("Error unmarshaling msg type: %v", err)
    }

    switch msg.Type {
    case "move":
        if err := handleMove(p, msgBytes); err != nil {
            return err
        }

        if ok, winner := p.Game.IsOver(); ok {
            handleGameOver(p.Game, winner)
            return fmt.Errorf("Game Over by move")
        }

    case "abort":
        winner := 1 - p.Color
        handleGameOver(p.Game, winner)
        return fmt.Errorf("Game over by abort")

    case "reqState":
        handleSyncState(p)

    case "chat":
    }

    return nil
}

func playGame(p *core.Player, over chan bool) {
    defer p.SelfConn.Close()
    for {
        if err := handleRecv(p); err != nil {
            log.Println(err)
            break
        }
    }

    select {
    case <-over:
    default:
        close(over)
    }
    log.Println("Connection Ends from Player", p.Color)
}

func startGame(game *core.Game) {
    log.Println("New match has started")

    game.InitGame()
    game.P1.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: "gameId"})
    game.P2.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: "gameId"})
   
    over := make(chan bool)
    go playGame(game.P1, over)
    go playGame(game.P2, over)
    go func(g *core.Game, over chan bool) {
        for {
            select{
            case <- over:
                return
            default:
                if game.CheckTimeout() {
                    winner := 1 - g.Turn
                    handleGameOver(g, winner)
                    log.Println("Game over by timeout")
                    return
                }
                time.Sleep(1 * time.Second)
            }
        }
    }(game, over)
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
