package routes

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/vanshjangir/rapid-go/server/internal/database"
	"google.golang.org/api/oauth2/v2"
	"google.golang.org/api/option"
)

const (
	TOKEN_TYPE_JWT   = "1"
	TOKEN_TYPE_OAUTH = "2"
)

type loginData struct {
	Type       string `json:"type"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Credential string `json:"credential"`
}

func createToken(username string) (string, error) {
	var secretKey = []byte(os.Getenv("JWT_SECRET_KEY"))

	claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": username,
		"exp":      time.Now().Add(28 * 24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	})

	tokenString, err := claims.SignedString(secretKey)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func loginByEmail(ctx *gin.Context, req *loginData) {

	db := database.GetDatabase()
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

	if storedPassword == "0" {
		ctx.JSON(401, gin.H{"error": "Email/Password not found"})
		return
	}

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
		"message":  "Login successful",
		"token":    TOKEN_TYPE_JWT + token,
		"username": username,
	})
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

func loginByGoogle(ctx *gin.Context, req *loginData) {
	tokenInfo, err := verifyGoogleToken(ctx, req.Credential)
	if err != nil {
		log.Println("ERROR:", err)
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Google token"})
		return
	}

	email := tokenInfo.Email
	if email == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Google token does not contain valid email"})
		return
	}

	db := database.GetDatabase()
	var username string
	query := "SELECT username FROM users WHERE email=$1"
	err = db.QueryRow(query, email).Scan(&username)
	if err != nil {
		if err == sql.ErrNoRows {
			uniqueId := int(uuid.New().ID())
			username = "U" + strconv.Itoa(uniqueId)
			_, err = db.Exec("INSERT INTO users (email, username) VALUES ($1, $2)", email, username)
			if err != nil {
				ctx.JSON(500, gin.H{"error": "Error creating user"})
				return
			}
		} else {
			log.Fatal(err)
		}
	}

	log.Println("Login successful for Google user:", email, "and username:", username)
	ctx.JSON(200, gin.H{
		"message":  "Google Login successful",
		"token":    TOKEN_TYPE_OAUTH + req.Credential,
		"username": username,
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
	case "google-token":
		loginByGoogle(ctx, &req)
	}
}
