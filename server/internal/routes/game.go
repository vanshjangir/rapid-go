package routes

import (
    "fmt"
    "log"
    "time"
    "net/http"
    "encoding/json"
    "database/sql"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "github.com/vanshjangir/ligo/server/internal/core"
    "github.com/vanshjangir/ligo/server/internal/database"
)

var Pmap map[string]*core.Game;
var pendingWS *websocket.Conn = nil
var pendingUN string = ""
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

    p.Game.TapClock(p.Color)
    p.Game.Turn = 1 - p.Color

    moveStatus.MoveStatus = true
    moveStatus.TurnStatus = true
    moveStatus.Move = moveMsg.Move
    moveStatus.SelfTime = p.Game.GetTime(p.Color)
    moveStatus.OpTime = p.Game.GetTime(1 - p.Color)

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

    wConn  := g.Pblack.SelfConn
    lConn  := g.Pwhite.SelfConn
    if winner == g.Pwhite.Color {
        wConn = g.Pwhite.SelfConn
        lConn = g.Pblack.SelfConn
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

    Pmap[g.Pblack.Username] = nil
    Pmap[g.Pwhite.Username] = nil

    db := database.ConnectDatabase()
    if err := saveGame(db, g); err != nil {
        log.Println("Error saving game state");
    }
}

func saveGame(db *sql.DB, g *core.Game) error {
    return nil
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
    syncMsg.History = p.Game.History
    syncMsg.SelfTime = p.Game.GetTime(p.Color)
    syncMsg.OpTime = p.Game.GetTime(1 - p.Color)

    if err := p.SelfConn.WriteJSON(syncMsg); err != nil {
        log.Println("Error sending sync msg:", err)
    }
}

func handleChat(p *core.Player, msgBytes []byte) error {
    var chatMsg core.ChatMsg
    
    if err := json.Unmarshal(msgBytes, &chatMsg); err != nil {
        return fmt.Errorf("Error unmarshling chat msg: %v", err);
    }

    if err := p.OpConn.WriteJSON(chatMsg); err != nil {
        return fmt.Errorf("Error sending chat msg: %v", err)
    }

    return nil
}

func handleRecv (p *core.Player) error {
    _, msgBytes, err := p.SelfConn.ReadMessage()
    if err != nil {
        p.DisConn = true
        p.DisConnTime.Start = time.Now()
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
            close(p.Game.Over)
            return fmt.Errorf("Game Over by move")
        }

    case "abort":
        winner := 1 - p.Color
        handleGameOver(p.Game, winner)
        close(p.Game.Over)
        return fmt.Errorf("Game over by abort")

    case "reqState":
        handleSyncState(p)

    case "chat":
        handleChat(p, msgBytes);
    }

    return nil
}

func playGame(p *core.Player) {
    defer p.SelfConn.Close()
    for {
        if err := handleRecv(p); err != nil {
            log.Println(err)
        }

        if p.DisConn {
            break
        }
    }

    log.Println("Connection Ends from Player", p.Color)
}

func monitorTimeout(g *core.Game) {
    for {
        select{
        case <- g.Over:
            return
        default:
            if g.Pblack.DisConn && g.Pblack.CheckDisConnTime() {
                winner := 1 - g.Pblack.Color
                handleGameOver(g, winner)
                log.Println("Game over by disconnection")
                return
            }
            if g.Pwhite.DisConn && g.Pwhite.CheckDisConnTime() {
                winner := 1 - g.Pwhite.Color
                handleGameOver(g, winner)
                log.Println("Game over by disconnection")
                return
            }
            if g.CheckTimeout() {
                winner := 1 - g.Turn
                handleGameOver(g, winner)
                log.Println("Game over by timeout")
                return
            }
            time.Sleep(1 * time.Second)
        }
    }
}

func startGame(game *core.Game) {
    log.Println("New match has started")

    game.InitGame()
    game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: game.Id})
    game.Pwhite.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: game.Id})
    
    Pmap[game.Pblack.Username] = game
    Pmap[game.Pwhite.Username] = game
   
    game.Over = make(chan bool)
    go playGame(game.Pblack)
    go playGame(game.Pwhite)
    go monitorTimeout(game)
}

func reconnect(username string, c *websocket.Conn) bool {
    game, ok := Pmap[username]
    if !ok || game == nil {
        return false
    }

    if game.Pblack.Username == username {
        game.Pblack.DisConn = false
        game.Pblack.SelfConn = c
        game.Pwhite.OpConn = c

        game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: "gameId"})
        go playGame(game.Pblack)
    } else {
        game.Pwhite.DisConn = false
        game.Pwhite.SelfConn = c
        game.Pblack.OpConn = c
        
        game.Pwhite.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: "gameId"})
        go playGame(game.Pwhite)
    }

    c.WriteMessage(websocket.TextMessage, []byte("reconnected"))
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
            c.WriteMessage(websocket.TextMessage, []byte("Error in reconnecting"))
        }
        return
    }

    if pendingWS == nil {
        pendingWS = c
        pendingUN = username
        if err := c.WriteMessage(websocket.TextMessage, []byte("pending"));
        err != nil {
            log.Println("Error sending pending msg:", err)
            c.Close()
        }
    } else {
        game := new(core.Game)
        game.Pblack = new(core.Player)
        game.Pwhite = new(core.Player)
        game.Pblack.Game = game
        game.Pwhite.Game = game
        
        game.Pblack.SelfConn = pendingWS
        game.Pblack.Username = pendingUN
        game.Pwhite.SelfConn = c
        game.Pwhite.Username = username
        pendingWS = nil
        pendingUN = ""
        startGame(game)
    }
}
