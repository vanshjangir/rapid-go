package core

import (
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/vanshjangir/baduk"
)

const (
	WhiteCell = 0
	BlackCell = 1
	EmptyCell = 2
)

type Game struct {
	Board   *baduk.Board
	Player  *Player
	OpName  string
	Id      string
	Turn    int
	History []string
	Over    chan bool
}

type GameDataRedis struct {
	Black       string    `json:"black"`
	White       string    `json:"white"`
	BTime       int64     `json:"btime"`
	WTime       int64     `json:"wtime"`
	LastUpdated time.Time `json:"lastUpdated"`
	Id          string    `json:"id"`
	Turn        int       `json:"turn"`
	History     []string  `json:"history"`
	State       string    `json:"state"`
}

type Player struct {
	Username    string
	Color       int
	DisConn     bool
	Clk         Clock
	OpClk       Clock
	DisConnTime Clock
	Rating      int
	Game        *Game
	Wsc         *websocket.Conn
	Ps          *redis.PubSub
}

type Clock struct {
	Start time.Time
	Spent int64
}

type MsgType struct {
	Type string `json:"type"`
}

type StartMsg struct {
	Type   string `json:"type"`
	Start  int    `json:"start"`
	Color  int    `json:"color"`
	GameId string `json:"gameId"`
}

type StopMsg struct {
	Type string `json:"type"`
}

type MoveMsg struct {
	Type     string `json:"type"`
	Move     string `json:"move"`
	State    string `json:"state"`
	SelfTime int64  `json:"selfTime"`
	OpTime   int64  `json:"opTime"`
}

type AbortMsg struct {
	Type string `json:"type"`
}

type GameOverMsg struct {
	Type    string `json:"type"`
	Winner  int    `json:"winner"`
	Message string `json:"message"`
}

type MoveStatusMsg struct {
	Type       string `json:"type"`
	TurnStatus bool   `json:"turnStatus"`
	MoveStatus bool   `json:"moveStatus"`
	State      string `json:"state"`
	SelfTime   int64  `json:"selfTime"`
	OpTime     int64  `json:"opTime"`
	Move       string `json:"move"`
}

type ReqStateMsg struct {
	Type string `json:"type"`
}

type SyncMsg struct {
	Type     string   `json:"type"`
	GameId   string   `json:"gameId"`
	PName    string   `json:"pname"`
	OpName   string   `json:"opname"`
	Color    int      `json:"color"`
	Turn     bool     `json:"turn"`
	State    string   `json:"state"`
	History  []string `json:"history"`
	SelfTime int64    `json:"selfTime"`
	OpTime   int64    `json:"opTime"`
}

type ChatMsg struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func (g *Game) InitGame() {
	g.Board = new(baduk.Board)
	g.Board.Init(19)
	g.Turn = BlackCell
	g.Player.Clk.Spent = 0
	g.Player.OpClk.Spent = 0
	g.Player.Clk.Start = time.Now()
	g.Player.OpClk.Start = time.Now()
}

func GetUniqueId() string {
	currentTimestamp := int(time.Now().UnixNano()) / int(time.Microsecond)
	uniqueID := uuid.New().ID()
	ID := currentTimestamp + int(uniqueID)
	return strconv.Itoa(ID)
}

func (p *Player) CheckDisConnTime() bool {
	diff := time.Since(p.DisConnTime.Start).Seconds()
	if diff >= 15 {
		return true
	} else {
		return false
	}
}

func (g *Game) CheckTimeout() bool {
	if g.Turn == g.Player.Color {
		addSpent := time.Since(g.Player.Clk.Start).Milliseconds()
		if g.Player.Clk.Spent+addSpent > 900000 {
			return true
		} else {
			return false
		}
	} else {
		addSpent := time.Since(g.Player.OpClk.Start).Milliseconds()
		if g.Player.OpClk.Spent+addSpent > 900000 {
			return true
		} else {
			return false
		}
	}
}

func (g *Game) TapClock(color int) {
	if color == g.Player.Color {
		g.Player.Clk.Spent += time.Since(g.Player.Clk.Start).Milliseconds()
		g.Player.OpClk.Start = time.Now()
	} else {
		g.Player.OpClk.Spent += time.Since(g.Player.OpClk.Start).Milliseconds()
		g.Player.Clk.Start = time.Now()
	}
}

func (g *Game) GetTime(color int) int64 {
	if color == g.Player.Color {
		if g.Turn == color {
			addSpent := time.Since(g.Player.Clk.Start).Milliseconds()
			return g.Player.Clk.Spent + addSpent
		}
		return g.Player.Clk.Spent
	} else {
		if g.Turn == color {
			addSpent := time.Since(g.Player.OpClk.Start).Milliseconds()
			return g.Player.OpClk.Spent + addSpent
		}
		return g.Player.OpClk.Spent
	}
}

func (g *Game) CheckTurn(color int) bool {
	if g.Turn != color {
		return false
	}

	return true
}

func (g *Game) UpdateState(move string, color int) (string, error) {
	if move == "ps" {
		g.History = append(g.History, move)
		return "", nil
	}

	col := int(move[0] - 'a')
	row, err := strconv.Atoi(move[1:])
	if err != nil {
		return "", nil
	}

	if color == BlackCell {
		if err := g.Board.SetB(col, row); err != nil {
			return "", err
		}
	} else {
		if err := g.Board.SetW(col, row); err != nil {
			return "", err
		}
	}

	g.History = append(g.History, move)
	return g.Board.Encode()
}

func (g *Game) IsOver() int {
	total := len(g.History)
	if total < 2 {
		return -1
	}

	if (g.History[total-1] == "ps") && (g.History[total-2] == "ps") {
		bs, ws := g.Board.Score()
		if float32(bs) > float32(ws)+7.5 {
			return BlackCell
		} else {
			return WhiteCell
		}
	}

	return -1
}
