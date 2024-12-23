package core

import (
    "strconv"
    "time"

    "github.com/vanshjangir/baduk"
    "github.com/google/uuid"
    "github.com/gorilla/websocket"
)

const (
    WHITE_CELL = 0
    BLACK_CELL = 1
    EMPTY_CELL = 2
)

type Game struct {
    Board       *baduk.Board
    Pblack      *Player
    Pwhite      *Player
    Id          string
    Turn        int
    History     []string
    Over        chan bool
}

type Player struct {
    Username    string
    Color       int
    DisConn     bool
    Clk         Clock
    DisConnTime Clock
    Rating      int
    Game        *Game
    SelfConn    *websocket.Conn
    OpConn      *websocket.Conn
}

type Clock struct {
    Start       time.Time
    Spent       int64
}

type MsgType struct {
    Type    string  `json:"type"`
}

type StartMsg struct {
    Type    string  `json:"type"`
    Start   int     `json:"start"`
    Color   int     `json:"color"`
    GameId  string  `json:"gameId"`
}

type StopMsg struct {
    Type    string  `json:"type"`
}

type MoveMsg struct {
    Type        string  `json:"type"`
    Move        string  `json:"move"`
    State       string  `json:"state"`
    SelfTime    int64   `json:"selfTime"`
    OpTime      int64   `json:"opTime"`
}

type AbortMsg struct {
    Type    string  `json:"type"`
}

type WinMsg struct {
    Type    string  `json:"type"`
}

type LoseMsg struct {
    Type    string  `json:"type"`
}

type MoveStatusMsg struct {
    Type        string  `json:"type"`
    TurnStatus  bool    `json:"turnStatus"`
    MoveStatus  bool    `json:"moveStatus"`
    State       string  `json:"state"`
    SelfTime    int64   `json:"selfTime"`
    OpTime      int64   `json:"opTime"`
    Move        string  `json:"move"`
}

type ReqStateMsg struct {
    Type    string  `json:"type"`
}

type SyncMsg struct {
    Type        string          `json:"type"`
    GameId      string          `json:"gameId"`
    Color       int             `json:"color"`
    Turn        bool            `json:"turn"`
    State       string          `json:"state"`
    History     []string        `json:"history"`
    SelfTime    int64           `json:"selfTime"`
    OpTime      int64           `json:"opTime"`
}

type ChatMsg struct {
    Type    string  `json:"type"`
    Message string  `json:"message"`
}

func (g *Game) InitGame() {
    g.Board = new(baduk.Board)
    g.Board.Init(19)

    g.Turn = BLACK_CELL
    
    g.Pblack.Color = BLACK_CELL
    g.Pblack.OpConn = g.Pwhite.SelfConn
    g.Pblack.Clk.Spent = 0
    
    g.Pwhite.Color = WHITE_CELL
    g.Pwhite.OpConn = g.Pblack.SelfConn
    g.Pwhite.Clk.Spent = 0
    
    g.Pblack.Clk.Start = time.Now()
    
    g.Id = getUniqueId()
}

func getUniqueId() string {
    currentTimestamp := int(time.Now().UnixNano()) / int(time.Microsecond)
    uniqueID := uuid.New().ID()
    ID := currentTimestamp + int(uniqueID)
    return strconv.Itoa(ID)
}

func (p *Player) CheckDisConnTime() bool {
    diff := time.Now().Sub(p.DisConnTime.Start).Seconds()
    if diff >= 15 {
        return true
    } else {
        return false
    }
}

func (g *Game) CheckTimeout() bool {
    if g.Turn == g.Pblack.Color {
        g.Pblack.Clk.Spent += time.Now().Sub(g.Pblack.Clk.Start).Milliseconds()
        g.Pblack.Clk.Start = time.Now()
        if g.Pblack.Clk.Spent > 900000 {
            return true
        } else {
            return false
        }
    } else {
        g.Pwhite.Clk.Spent += time.Now().Sub(g.Pwhite.Clk.Start).Milliseconds()
        g.Pwhite.Clk.Start = time.Now()
        if g.Pwhite.Clk.Spent > 900000 {
            return true
        } else {
            return false
        }
    }
}

func (g *Game) TapClock(color int) {
    if color == g.Pblack.Color {
        g.Pblack.Clk.Spent += time.Now().Sub(g.Pblack.Clk.Start).Milliseconds()
        g.Pwhite.Clk.Start = time.Now()
    } else {
        g.Pwhite.Clk.Spent += time.Now().Sub(g.Pwhite.Clk.Start).Milliseconds()
        g.Pblack.Clk.Start = time.Now()
    }
}

func (g *Game) GetTime(color int) int64 {
    if color == g.Pblack.Color {
        return g.Pblack.Clk.Spent
    } else {
        return g.Pwhite.Clk.Spent
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

    if(color == BLACK_CELL){
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
        if float32(bs) > float32(ws) + 7.5 {
            return BLACK_CELL
        } else {
            return WHITE_CELL
        }
    }

    return -1
}
