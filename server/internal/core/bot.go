package core

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type GnuGo struct {
	cmd    *exec.Cmd
	stdin  *bufio.Writer
	stdout *bufio.Scanner
}

func NewGnuGo() (*GnuGo, error) {
	cmd := exec.Command("/usr/games/gnugo", "--mode", "gtp")
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
	var gameOverMsg GameOverMsg
	gameOverMsg.Type = "gameover"
	gameOverMsg.Winner = winner
	gameOverMsg.Message = wonby

	if err := g.Player.Wsc.WriteJSON(gameOverMsg); err != nil {
		log.Println("Error sending win msg to p:", err)
	}

	if err := g.Player.Wsc.Close(); err != nil {
		log.Println("Error closing conn winner:", err)
	}

	delete(Pmap, g.Player.Username)

	if err := saveGame(g, winner, wonby); err != nil {
		log.Println("Error saving game state:", err)
	}

	if err := updateRating(g, winner); err != nil {
		log.Println("Error saving game state:", err)
	}
}

func handleMoveBot(g *Game, msgBytes []byte, engine *GnuGo) error {

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
		fmt.Println("Error in updateState", err)

		// sending the user an alert that the move is invalid
		return nil
	}

	g.TapClock(g.Player.Color)
	g.Turn = 1 - g.Player.Color

	moveStatus.MoveStatus = true
	moveStatus.TurnStatus = true
	moveStatus.State, _ = g.Board.Encode()
	moveStatus.Move = moveMsg.Move
	moveStatus.SelfTime = g.GetTime(g.Player.Color)
	moveStatus.OpTime = g.GetTime(1 - g.Player.Color)

	if err := g.Player.Wsc.WriteJSON(moveStatus); err != nil {
		return fmt.Errorf("Error sending move msg: %v", err)
	}

	var engineMove string
	col := rune(moveMsg.Move[0])
	t, _ := strconv.Atoi(moveMsg.Move[1:])
	row := strconv.Itoa(t + 1)
	if moveMsg.Move[0] >= 'i' {
		engineMove = string(col+1) + row
	} else {
		engineMove = string(col) + row
	}

	engine.Send("play black" + engineMove)

	return nil
}

func playBotMove(engine *GnuGo, g *Game) error {
	res := engine.Send("genmove white")

	if res == "" {
		handleGameOverBot(g, BlackCell, "abort")
		close(g.Over)
		return fmt.Errorf("Game over by abort")
	}

	res = strings.Split(res, "\n")[0]
	res = strings.Split(res, " ")[1]
	if res == "PASS" {
		res = "ps"
	} else {
		col := rune(res[0])
		t, _ := strconv.Atoi(res[1:])
		row := strconv.Itoa(t - 1)
		if res[0] >= 'i' {
			res = string(col+1+32) + row
		} else {
			res = string(col+32) + row
		}

	}

	if _, err := g.UpdateState(res, WhiteCell); err != nil {
		fmt.Println("Error in updateState in playBotMove", err)
		res = "ps"
		g.UpdateState(res, WhiteCell)
	}

	g.TapClock(WhiteCell)
	g.Turn = BlackCell

	var moveMsg MoveMsg
	moveMsg.Type = "move"
	moveMsg.Move = res
	moveMsg.OpTime = g.GetTime(WhiteCell)
	moveMsg.SelfTime = g.GetTime(BlackCell)
	moveMsg.State, _ = g.Board.Encode()

	if err := g.Player.Wsc.WriteJSON(moveMsg); err != nil {
		return fmt.Errorf("Error sending move msg: %v", err)
	}

	return nil
}

func handleRecvBot(g *Game, engine *GnuGo) error {
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
		if err := handleMoveBot(g, msgBytes, engine); err != nil {
			return err
		}

		if winner := g.IsOver(); winner != -1 {
			handleGameOverBot(g.Player.Game, winner, "move")
			close(g.Player.Game.Over)
			return fmt.Errorf("Game over by move")
		}

		if err := playBotMove(engine, g); err != nil {
			handleGameOverBot(g, BlackCell, "error")
			close(g.Over)
			return err
		}

		if winner := g.IsOver(); winner != -1 {
			handleGameOverBot(g, winner, "move")
			close(g.Over)
			return fmt.Errorf("Game over by move")
		}

	case "abort":
		winner := 1 - g.Player.Color
		handleGameOverBot(g, winner, "abort")
		close(g.Over)
		return fmt.Errorf("Game over by abort")

	case "reqState":
		handleSyncState(g)
	}

	return nil
}

func PlayGameBot(g *Game) {
	engine, err := NewGnuGo()
	if err != nil {
		handleGameOverBot(g, BlackCell, "abort")
		return
	}
	defer engine.Close()
	defer g.Player.Wsc.Close()

	fmt.Print(engine.Send("boardsize 19"))

	for {
		if err := handleRecvBot(g, engine); err != nil {
			log.Println(err)
		}

		if g.Player.DisConn {
			log.Println("Player diconnected")
			break
		}
	}

	log.Println("Connection Ends from Player", g.Player.Color)
}
