package core

import (
    "strconv"
    "github.com/gorilla/websocket"
)

const (
    BLACK_CELL = 0
    WHITE_CELL = 1
    EMPTY_CELL = 2
    WHITE_CAPTURED = 3
    BLACK_CAPTURED = 4
)

type Game struct {
    P1          *Player
    P2          *Player
    Id          string
    State       [19][19]int
    Liberty     [19][19]int
    Turn        int
    History     []byte
}

type Player struct {
    Id          string
    Game        *Game
    SelfConn    *websocket.Conn
    OpConn      *websocket.Conn
    Color       int
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
    Type    string  `json:"type"`
    Move    string  `json:"move"`
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
    Move        string  `json:"move"`
}

type ReqStateMsg struct {
    Type    string  `json:"type"`
}

type SyncMsg struct {
    Type    string          `json:"type"`
    GameId  string          `json:"gameId"`
    Color   int             `json:"color"`
    Turn    bool            `json:"turn"`
    Liberty [19][19]int     `json:"liberty"`
    State   [19][19]int     `json:"state"`
    History string          `json:"history"`
}

type ChatMsg struct {
    Type    string  `json:"string"`
    Message string  `json:"message"`
}

func (g *Game) InitGame() {
    g.P1.Color = 1
    g.P2.Color = 0
    g.P1.OpConn = g.P2.SelfConn
    g.P2.OpConn = g.P1.SelfConn
    g.Turn = 1

    for i := 0; i < 19; i++ {
        for j := 0; j < 19; j++ {
            g.State[i][j] = EMPTY_CELL
        }
    }
}

func (g *Game) CheckValidMove(move string, color int) bool {
    if move == "ps" {
        return true
    }

    col := int(move[0] - 'a')
    row, err := strconv.Atoi(move[1:])
    if err != nil {
        return false
    }
    row -= 1

    if g.State[col][row] != EMPTY_CELL {
        return false
    }

    // also check for Ko state

    if libr := g.checkLiberties(col, row, color); libr == 0 {
        if ok := g.checkInOutCapture(col, row, color); ok {
            return true
        } else {
            return false
        }
    }

    return true
}

func (g *Game) checkInOutCapture(col int, row int, color int) bool {
    opColor := 0
    if color == 0 {
        opColor = 1
    }

    x := [4]int{0, -1, 0, 1}
    y := [4]int{-1, 0, 1, 0}

    for i := 0; i < 4; i++ {
        dx := col + x[i]
        dy := row + y[i]
        if dx >= 0 && dy > 0 && dx < 19 && dy < 19 &&
        g.State[dx][dy] == opColor {
            if g.Liberty[dx][dy] == 1 {
                return true
            } else {
                return false
            }
        }
    }
    return false
}

func (g *Game) checkLiberties(col int, row int, color int) int {
    libr := 0
    x := [4]int{0, -1, 0, 1}
    y := [4]int{-1, 0, 1, 0}

    for i := 0; i < 4; i++ {
        dx := col + x[i]
        dy := row + y[i]
        if dx >= 0 && dy > 0 && dx < 19 && dy < 19 {
            if g.State[dx][dy] == EMPTY_CELL {
                libr += 1
            } else if g.State[dx][dy] == color {
                libr += g.Liberty[dx][dy] - 1
            }
        }
    }
    return libr
}

func (g *Game) CheckTurn(color int) bool {
    if g.Turn != color {
        return false
    }

    return true
}

func (g *Game) getGroupLiberties(col int, row int, color int, vis *[19][19]bool) int {
    libr := 0
    x := [4]int{0, -1, 0, 1}
    y := [4]int{-1, 0, 1, 0}

    for i := 0; i < 4; i++ {
        dx := col + x[i]
        dy := row + y[i]
        if dx >= 0 && dy > 0 && dx < 19 && dy < 19 &&
        g.State[dx][dy] == EMPTY_CELL {
            libr += 1
        }
    }

    for i := 0; i < 4; i++ {
        dx := col + x[i]
        dy := row + y[i]
        if dx >= 0 && dy > 0 && dx < 19 && dy < 19 &&
        g.State[dx][dy] == color && !vis[dx][dy] {
            vis[dx][dy] = true
            libr += g.getGroupLiberties(dx, dy, color, vis)
        }
    }
    return libr
}

func (g *Game) setGroupLiberties(col int, row int, color int,
    groupLibr int, vis *[19][19]bool) {
   
    g.Liberty[col][row] = groupLibr

    x := [4]int{0, -1, 0, 1}
    y := [4]int{-1, 0, 1, 0}
    for i := 0; i < 4; i++ {
        dx := col + x[i]
        dy := row + y[i]
        if dx >= 0 && dy > 0 && dx < 19 && dy < 19 &&
        g.State[dx][dy] == color && !vis[dx][dy] {
            vis[dx][dy] = true
            g.setGroupLiberties(dx, dy, color, groupLibr, vis)
        }
    }
}

func (g *Game) updateLiberties(col int, row int, color int) {
    var gvis [19][19]bool
    var svis [19][19]bool
    groupLibr := g.getGroupLiberties(col, row, color, &gvis)
    g.setGroupLiberties(col, row, color, groupLibr, &svis)

}

func (g *Game) UpdateState(move string, color int) {
    if move == "ps" {
        g.History = append(g.History, []byte(move)...)
        return
    }

    col := int(move[0] - 'a')
    row, err := strconv.Atoi(move[1:])
    if err != nil {
        return
    }
    row -= 1

    if(color == 1){
        g.State[col][row] = BLACK_CELL
    } else {
        g.State[col][row] = WHITE_CELL
    }


    var vis [19][19]bool
    for i := 0; i < 19; i++ {
        for j := 0; j < 19; j++ {
            if vis[col][row] {
                continue
            }
            vis[col][row] = true
            g.updateLiberties(col, row, color)
        }
    }
    g.checkCapture(col, row, color)

    g.History = append(g.History, []byte(move)...)
}

func (g *Game) checkCapture(col int, row int, color int) {
    for i := 0; i < 19; i++ {
        for j := 0; j < 19; j++ {
            if g.Liberty[i][j] == 0 && g.State[i][j] != color {
                g.State[i][j] = EMPTY_CELL
                x := [4]int{0, -1, 0, 1}
                y := [4]int{-1, 0, 1, 0}
                for i := 0; i < 4; i++ {
                    dx := col + x[i]
                    dy := row + y[i]
                    if dx >= 0 && dy > 0 && dx < 19 && dy < 19 &&
                    g.State[dx][dy] == color {
                        g.Liberty[dx][dy] += 1
                    }
                }
            }
        }
    }
}

func (g *Game) IsOver() (bool, int) {
    over := false
    total := len(g.History)
    if total < 4 {
        return over, -1
    }

    last := string(g.History[total-2:])
    slast := string(g.History[total-4:total-2])

    if last == "ps" && slast == "ps" {
        over = true
    } else {
        return over, -1
    }

    return over, g.getWinner()
}

func (g *Game) getWinner() int {
    return 1
}
