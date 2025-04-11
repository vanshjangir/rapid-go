package routes

import (
    "log"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    "github.com/vanshjangir/rapid-go/server/internal/core"
    "github.com/vanshjangir/rapid-go/server/internal/database"
)

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

    GNUGO_RATING = 1800
)

func getRating(username string) int {
    db := database.ConnectDatabase()
    query := "SELECT rating FROM users WHERE username = $1"
    
    var rating int
    err := db.QueryRow(query, username).Scan(&rating)
    if err != nil {
        return 400
    }

    return rating
}

func startGame(game *core.Game) {
    log.Println("New match has started")

    game.InitGame()
    game.Pblack.Rating = getRating(game.Pblack.Username)
    game.Pwhite.Rating = getRating(game.Pwhite.Username)
    game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: game.Id})
    game.Pwhite.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: game.Id})
    
    core.Pmap[game.Pblack.Username] = game
    core.Pmap[game.Pwhite.Username] = game
   
    game.Over = make(chan bool)
    go core.PlayGame(game.Pblack)
    go core.PlayGame(game.Pwhite)
    go core.MonitorTimeout(game)
}

func startBotGame(game *core.Game) {
    log.Println("New match has started")

    game.InitGame()
    game.Pblack.Rating = getRating(game.Pblack.Username)
    game.Pwhite.Rating = GNUGO_RATING
    game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: game.Id})
    
    core.Pmap[game.Pblack.Username] = game
    
    game.Over = make(chan bool)
    go core.PlayGameBot(game.Pblack)
}

func reconnect(username string, c *websocket.Conn) bool {
    game, ok := core.Pmap[username]
    if !ok || game == nil {
        return false
    }

    if game.Pblack.Username == username {
        game.Pblack.DisConn = false
        game.Pblack.SelfConn = c
        game.Pwhite.OpConn = c

        game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: game.Id})
        go core.PlayGame(game.Pblack)
    } else {
        game.Pwhite.DisConn = false
        game.Pwhite.SelfConn = c
        game.Pblack.OpConn = c
        
        game.Pwhite.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 0, GameId: game.Id})
        go core.PlayGame(game.Pwhite)
    }

    c.WriteMessage(websocket.TextMessage, []byte("reconnected"))
    log.Println("Player reconnected", username)
    return true
}

func reconnectBot(username string, c *websocket.Conn) bool {
    game, ok := core.Pmap[username]
    if !ok || game == nil {
        return false
    }

    // always will be black
    game.Pblack.DisConn = false
    game.Pblack.SelfConn = c
    game.Pwhite.OpConn = c
    game.Pblack.SelfConn.WriteJSON(core.StartMsg{Start: 1, Color: 1, GameId: game.Id})
    go core.PlayGameBot(game.Pblack)

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
    recType := ctx.Query("rectype")
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
        if recType == "player" {
            if ok := reconnect(username, c); !ok {
                c.WriteMessage(websocket.TextMessage,
                    []byte("Error in reconnecting"))
            }
        } else {
            if ok := reconnectBot(username, c); !ok {
                c.WriteMessage(websocket.TextMessage,
                    []byte("Error in reconnecting"))
            }
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

func ConnectAgainstBot(ctx *gin.Context) {
    w, r := ctx.Writer, ctx.Request
    username := getUsername(ctx)
    if len(username) == 0 {
        return
    }

    c, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("ConnectPlayer:", err)
        return
    }


    game := new(core.Game)
    game.Pblack = new(core.Player)
    game.Pwhite = new(core.Player)
    game.Pblack.Game = game
    game.Pwhite.Game = game
    
    game.Pblack.Username = username
    game.Pblack.SelfConn = c
    game.Pwhite.Username = "bot"
    game.Pwhite.SelfConn = nil
    startBotGame(game)
}
