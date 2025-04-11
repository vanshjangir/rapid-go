package core

import(
    "log"
    "fmt"
    "time"
    "strings"
    "encoding/json"
    "database/sql"
    "github.com/vanshjangir/rapid-go/server/internal/database"
)

var Pmap map[string]*Game;

func MonitorTimeout(g *Game) {
    for {
        select{
        case <- g.Over:
            return
        default:
            if g.Pblack.DisConn && g.Pblack.CheckDisConnTime() {
                winner := 1 - g.Pblack.Color
                handleGameOver(g, winner, "discn")
                close(g.Over)
                log.Println("Game over by disconnection")
                return
            }
            if g.Pwhite.DisConn && g.Pwhite.CheckDisConnTime() {
                winner := 1 - g.Pwhite.Color
                handleGameOver(g, winner, "discn")
                close(g.Over)
                log.Println("Game over by disconnection")
                return
            }
            if g.CheckTimeout() {
                winner := 1 - g.Turn
                handleGameOver(g, winner, "time")
                close(g.Over)
                log.Println("Game over by timeout")
                return
            }
            time.Sleep(1 * time.Second)
        }
    }
}


func saveGame(db *sql.DB, g *Game, winner int, wonby string) error {
    insertQuery := "INSERT INTO games (gameid, white, black, winner, wonby, moves, date) VALUES ($1, $2, $3, $4, $5, $6, $7)"
    if _, err := db.Exec(
        insertQuery,
        g.Id,
        g.Pwhite.Username,
        g.Pblack.Username,
        winner,
        wonby,
        strings.Join(g.History, "/"),
        time.Now().UTC(),
        ); err != nil {
        return err
    }
    return nil
}

func getNewRating(wr int, br int) (int, int) {
    return wr, br
}

func updateRating(db *sql.DB, g *Game) error {
    wnew, bnew := getNewRating(g.Pwhite.Rating, g.Pblack.Rating)
    query := "UPDATE users SET rating = $1 WHERE username = $2"

    if _, err := db.Exec(query, wnew, g.Pwhite.Username); err != nil {
        return err
    }

    if _, err := db.Exec(query, bnew, g.Pblack.Username); err != nil {
        return err
    }

    return nil
}

func handleChat(p *Player, msgBytes []byte) error {
    var chatMsg ChatMsg
    
    if err := json.Unmarshal(msgBytes, &chatMsg); err != nil {
        return fmt.Errorf("Error unmarshling chat msg: %v", err);
    }

    if err := p.OpConn.WriteJSON(chatMsg); err != nil {
        return fmt.Errorf("Error sending chat msg: %v", err)
    }

    return nil
}

func handleSyncState(p *Player) {
    var syncMsg SyncMsg
    syncMsg.Type = "sync"
    syncMsg.Color = p.Color
    syncMsg.GameId = p.Game.Id
    syncMsg.History = p.Game.History
    syncMsg.SelfTime = p.Game.GetTime(p.Color)
    syncMsg.OpTime = p.Game.GetTime(1 - p.Color)

    if p.Game.Turn == p.Color {
        syncMsg.Turn = true
    }

    if state, err := p.Game.Board.Encode(); err != nil {
        log.Println("Error encoding board state:", err)
    } else {
        syncMsg.State = state
    }

    if err := p.SelfConn.WriteJSON(syncMsg); err != nil {
        log.Println("Error sending sync msg:", err)
    }
}

func handleGameOver(g *Game, winner int, wonby string) {
    winMsg := new(WinMsg)
    loseMsg := new(LoseMsg)
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

    delete(Pmap, g.Pblack.Username)
    delete(Pmap, g.Pwhite.Username)

    db := database.ConnectDatabase()
    if err := saveGame(db, g, winner, wonby); err != nil {
        log.Println("Error saving game state:", err);
    }
    
    if err := updateRating(db, g); err != nil {
        log.Println("Error saving game state:", err);
    }
}

func handleMove(p *Player, msgBytes []byte, ) error {

    var moveMsg MoveMsg
    var moveStatus MoveStatusMsg

    moveMsg.Type = "move"
    moveStatus.Type = "movestatus"

    if err := json.Unmarshal(msgBytes, &moveMsg); err != nil {
        return fmt.Errorf("Error unmarshing move msg: %v", err)
    }

    if ok := p.Game.CheckTurn(p.Color); !ok {
        moveStatus.MoveStatus = false
        moveStatus.TurnStatus = false
        moveStatus.State, _ = p.Game.Board.Encode()
        moveStatus.Move = moveMsg.Move
        p.SelfConn.WriteJSON(moveStatus)
        return nil
    }

    if _, err := p.Game.UpdateState(moveMsg.Move, p.Color); err != nil {
        moveStatus.TurnStatus = true
        moveStatus.MoveStatus = false
        moveStatus.State, _ = p.Game.Board.Encode()
        moveStatus.Move = moveMsg.Move
        p.SelfConn.WriteJSON(moveStatus)
        fmt.Println("Error in updateState", err);

        // sending the user an alert that the move is invalid
        return nil
    }

    p.Game.TapClock(p.Color)
    p.Game.Turn = 1 - p.Color

    moveStatus.MoveStatus = true
    moveStatus.TurnStatus = true
    moveStatus.State, _ = p.Game.Board.Encode()
    moveStatus.Move = moveMsg.Move
    moveStatus.SelfTime = p.Game.GetTime(p.Color)
    moveStatus.OpTime = p.Game.GetTime(1 - p.Color)

    if err := p.SelfConn.WriteJSON(moveStatus); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }
    
    moveMsg.OpTime = moveStatus.SelfTime
    moveMsg.SelfTime = moveStatus.OpTime
    moveMsg.State, _ = p.Game.Board.Encode()

    if err := p.OpConn.WriteJSON(moveMsg); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }

    return nil
}

func handleRecv (p *Player) error {
    _, msgBytes, err := p.SelfConn.ReadMessage()
    if err != nil {
        p.DisConn = true
        p.DisConnTime.Start = time.Now()
        return fmt.Errorf("Error in reading on player %v: %v", p.Color, err)
    }

    var msg MsgType
    if err := json.Unmarshal(msgBytes, &msg); err != nil {
        return fmt.Errorf("Error unmarshaling msg type: %v", err)
    }

    switch msg.Type {
    case "move":
        if err := handleMove(p, msgBytes); err != nil {
            return err
        }

        if winner := p.Game.IsOver(); winner != -1 {
            handleGameOver(p.Game, winner, "move")
            close(p.Game.Over)
            return fmt.Errorf("Game over by move")
        }

    case "abort":
        winner := 1 - p.Color
        handleGameOver(p.Game, winner, "abort")
        close(p.Game.Over)
        return fmt.Errorf("Game over by abort")

    case "reqState":
        handleSyncState(p)

    case "chat":
        handleChat(p, msgBytes);
    }

    return nil
}

func PlayGame(p *Player) {
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
