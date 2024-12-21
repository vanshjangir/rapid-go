package routes

import (
    "os"
    "log"
    "time"
    "strings"
    "database/sql"

    "github.com/gin-gonic/gin"
    "github.com/vanshjangir/ligo/server/internal/database"
    "github.com/golang-jwt/jwt/v5"
)

const (
    TOKEN_TYPE_JWT = "1"
    TOKEN_TYPE_OAUTH = "2"
)

type loginData struct {
    Type        string  `json:"type"`
    Email       string  `json:"email"`
    Password    string  `json:"password"`
    Credential  string  `json:"credential"`
}

func createToken(username string) (string, error) {
    var secretKey = []byte(os.Getenv("JWT_SECRET_KEY"))

    claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "username": username,
        "exp": time.Now().Add(24*time.Hour).Unix(),
        "iat": time.Now().Unix(),
    })
    
    tokenString, err := claims.SignedString(secretKey)
    if err != nil {
        return "", err
    }
    
    return tokenString, nil
}

func loginByEmail(ctx *gin.Context, req *loginData) {

    db := database.ConnectDatabase()
    var storedPassword, username string
    query := "SELECT password, username FROM users WHERE email=$1"
    err := db.QueryRow(query, req.Email).Scan(&storedPassword, &username)
    if err != nil {
        if err == sql.ErrNoRows {
            ctx.JSON(404, gin.H{"error": "Email not found"})
            return
        }
        log.Fatal(err)
    }

    storedPassword = strings.TrimSpace(storedPassword)
    req.Password = strings.TrimSpace(req.Password)

    if storedPassword != req.Password {
        ctx.JSON(401, gin.H{"error": "Invalid password"})
        return
    }

    token, err := createToken(username)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Error generating token"})
        return
    }

    log.Println("Login successful for email:", req.Email, "and username:", username)
    ctx.JSON(200, gin.H{
        "message": "Login successful",
        "token": TOKEN_TYPE_JWT + token,
        "username": username,
    })
}

func loginByGoogle(ctx *gin.Context, req *loginData) {
    ctx.JSON(200, gin.H{
        "message": "Google Login successful",
        "token": TOKEN_TYPE_OAUTH + req.Credential,
        "username": "username",
    })
}

func Login(ctx *gin.Context) {
    var req loginData
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid request body"})
        return
    }

    switch req.Type {
    case "email":
        loginByEmail(ctx, &req)
        break
    case "google-token":
        loginByGoogle(ctx, &req)
    }
    log.Println("Login attempt for email:", req.Email)
}
