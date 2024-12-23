package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"google.golang.org/api/oauth2/v2"
	"google.golang.org/api/option"
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

func verifyGoogleToken(ctx context.Context, token string) (*oauth2.Tokeninfo, error) {
    oauth2Service, err := oauth2.NewService(ctx, option.WithAPIKey(os.Getenv("GOOGLE_CLIENT_ID")))
    if err != nil {
        return nil, err
    }

    tokenInfo, err := oauth2Service.Tokeninfo().IdToken(token).Do()
    if err != nil {
        return nil, err
    }

    return tokenInfo, nil
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
        tokenInfo, err := verifyGoogleToken(ctx, token[1:])
        if err != nil {
            log.Println("Google verification failed:", err)
            ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Google token"})
            ctx.Abort()
            return
        }
        var username string
        db := database.ConnectDatabase()
        query := "SELECT username FROM users WHERE email = $1"
        
        if err := db.QueryRow(query, tokenInfo.Email).Scan(&username);
        err != nil {
            log.Println("Google query failed")
            ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Username not found"})
            ctx.Abort()
            return
        }
        
        ctx.Set("username", username)
        ctx.Next()

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
