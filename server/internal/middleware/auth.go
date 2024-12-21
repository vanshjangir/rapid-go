package middleware

import (
    "os"
    "fmt"
    "net/http"
    "strings"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
)

const (
    TOKEN_TYPE_JWT = "1"
    TOKEN_TYPE_OAUTH = "2"
    TOKEN_TYPE_GUEST = "3"
)

func verifyToken(tokenString string) (*jwt.Token, error) {
    var secretKey = []byte(os.Getenv("JWT_SECRET_KEY"))

    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return secretKey, nil
    })
    
    if err != nil {
        fmt.Printf("Parsing Error: %v\n", err)
        return nil, err
    }
    
    if !token.Valid {
        fmt.Println("Token is not valid")
        return nil, fmt.Errorf("invalid token")
    }
    
    return token, nil
}

func Auth(ctx *gin.Context) {
    authHeader := strings.Split(ctx.GetHeader("Sec-WebSocket-Protocol"), ", ")
    if authHeader[1] == "" {
        ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header missing"})
        ctx.Abort()
        return
    }

    fmt.Println("Headers", authHeader)

    token := authHeader[1]

    switch token[:1] {
    case TOKEN_TYPE_JWT:
        token, err := verifyToken(token[1:])
        if err != nil {
            fmt.Printf("JWT verification failed: %v\n", err)
            ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            ctx.Abort()
            return
        }
        fmt.Printf("JWT verified. Claims: %+v\n", token.Claims)
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid claims"})
            ctx.Abort()
        }
        ctx.Set("username", claims["username"])
        ctx.Next()
    case TOKEN_TYPE_OAUTH:
        ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Support will be added soon"})
        ctx.Abort()
    case TOKEN_TYPE_GUEST:
        uniqueId := int(uuid.New().ID())
        ctx.Set("username", "G"+strconv.Itoa(uniqueId))
        ctx.Next()
    default:
        fmt.Printf("Unknown token type: %v\n", token[:1])
        ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Unsupported token type"})
        ctx.Abort()
    }
}
