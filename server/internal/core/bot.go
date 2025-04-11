package core

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"

	"github.com/vanshjangir/rapid-go/server/internal/database"
)

type GnuGo struct {
	cmd    *exec.Cmd
	stdin  *bufio.Writer
	stdout *bufio.Scanner
}

func NewGnuGo() (*GnuGo, error) {
	cmd := exec.Command("gnugo", "--mode", "gtp")
	stdinPipe, _ := cmd.StdinPipe()
	stdoutPipe, _ := cmd.StdoutPipe()
	err := cmd.Start()
	if err != nil {
		return nil, err
	}
	return &GnuGo{
		cmd:    cmd,
		stdin:  bufio.NewWriter(stdinPipe),
		stdout: bufio.NewScanner(stdoutPipe),
	}, nil
}

func (gg *GnuGo) Send(cmd string) string {
	gg.stdin.WriteString(cmd + "\n")
	gg.stdin.Flush()

	var res string
	for gg.stdout.Scan() {
		line := gg.stdout.Text()
		if line == "" {
			break
		}
		res += line + "\n"
	}
	return res
}

func (g *GnuGo) Close() {
	if g.cmd != nil && g.cmd.Process != nil {
		g.cmd.Process.Kill()
	}
}

func handleGameOverBot(g *Game, winner int, wonby string) {
    winMsg := new(WinMsg)
    loseMsg := new(LoseMsg)
    winMsg.Type = "win"
    loseMsg.Type = "lose"

    conn  := g.Pblack.SelfConn

    if winner == BLACK_CELL {
        if err := conn.WriteJSON(winMsg); err != nil {
            log.Println("Error sending win msg to p:", err)
        }
    } else {
        if err := conn.WriteJSON(loseMsg); err != nil {
            log.Println("Error sending lose msg to p:", err)
        }
    }
    
    if err := conn.Close(); err != nil {
        log.Println("Error closing conn winner:", err)
    }

    delete(Pmap, g.Pblack.Username)
    
    db := database.ConnectDatabase()
    if err := saveGame(db, g, winner, wonby); err != nil {
        log.Println("Error saving game state:", err);
    }
    
    if err := updateRating(db, g); err != nil {
        log.Println("Error saving game state:", err);
    }
}

func handleMoveBot(p *Player, msgBytes []byte, engine *GnuGo) error {

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

    var engineMove string
    col := rune(moveMsg.Move[0])
    row := moveMsg.Move[1:]
    if(moveMsg.Move[0] >= 'i'){
        engineMove = string(col+1) + row
    } else {
        engineMove = string(col) + row
    }
    
    engine.Send("play black" + engineMove)
    
    return nil
}

func playBotMove (engine *GnuGo, g *Game) error {
    res := engine.Send("genmove white")
    
    if res == "" {
        handleGameOverBot(g, BLACK_CELL, "abort")
        close(g.Over)
        return fmt.Errorf("Game over by abort")
    }

    res = strings.Split(res, "\n")[0]
    res = strings.Split(res, " ")[1]
    if res == "PASS" {
        res = "ps"
    } else {
        col := rune(res[0])
        row := res[1:]
        if(res[0] >= 'i'){
            res = string(col+1 +32) + row
        } else {
            res = string(col +32) + row
        }

    }
    
    if _, err := g.UpdateState(res, WHITE_CELL); err != nil {
        fmt.Println("Error in updateState in playBotMove", err);
        res = "ps"
        g.UpdateState(res, WHITE_CELL)
    }
    
    g.TapClock(WHITE_CELL)
    g.Turn = BLACK_CELL

    var moveMsg MoveMsg
    moveMsg.Type = "move"
    moveMsg.Move = res
    moveMsg.OpTime = g.GetTime(WHITE_CELL)
    moveMsg.SelfTime = g.GetTime(BLACK_CELL)
    moveMsg.State, _ = g.Board.Encode()

    if err := g.Pblack.SelfConn.WriteJSON(moveMsg); err != nil {
        return fmt.Errorf("Error sending move msg: %v", err)
    }

    return nil
}

func handleRecvBot (p *Player, engine *GnuGo) error {
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
        if err := handleMoveBot(p, msgBytes, engine); err != nil {
            return err
        }

        if winner := p.Game.IsOver(); winner != -1 {
            handleGameOverBot(p.Game, winner, "move")
            close(p.Game.Over)
            return fmt.Errorf("Game over by move")
        }
        
        if err := playBotMove(engine, p.Game); err != nil {
            handleGameOverBot(p.Game, BLACK_CELL, "error")
            close(p.Game.Over)
            return err
        }
        
        if winner := p.Game.IsOver(); winner != -1 {
            handleGameOverBot(p.Game, winner, "move")
            close(p.Game.Over)
            return fmt.Errorf("Game over by move")
        }

    case "abort":
        winner := 1 - p.Color
        handleGameOverBot(p.Game, winner, "abort")
        close(p.Game.Over)
        return fmt.Errorf("Game over by abort")

    case "reqState":
        handleSyncState(p)

    }

    return nil
}

func PlayGameBot(p *Player) {
    engine, err := NewGnuGo()
    if err != nil {
        handleGameOverBot(p.Game, BLACK_CELL, "abort")
        return
    }
    defer engine.Close()
    defer p.SelfConn.Close()
	
    fmt.Print(engine.Send("boardsize 19"))
    
    for {
        if err := handleRecvBot(p, engine); err != nil {
            log.Println(err)
        }

        if p.DisConn {
            break
        }
    }

    log.Println("Connection Ends from Player", p.Color)
}
