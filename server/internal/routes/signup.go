package routes

import (
    "log"
    "database/sql"
    "github.com/gin-gonic/gin"
    "github.com/vanshjangir/ligo/server/internal/database"
)

type signupData struct {
    Email       string  `json:"email"`
    Password    string  `json:"password"`
    Username    string  `json:"username"`
}

func Signup(ctx *gin.Context) {
    db := database.ConnectDatabase()

    var req signupData
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.JSON(400, gin.H{"error": "Invalid request body"})
        return
    }
    log.Println("Signup attempt for email:", req.Email)

    var existingEmail string
    queryEmail := "SELECT email FROM users WHERE email=$1"
    err := db.QueryRow(queryEmail, req.Email).Scan(&existingEmail)
    if err != nil {
        if err != sql.ErrNoRows {
            log.Fatal(err)
        }
    } else {
        ctx.JSON(409, gin.H{"error": "Email already in use"})
        return
    }

    var existingUsername string
    queryUsername := "SELECT username FROM users WHERE username=$1"
    err = db.QueryRow(queryUsername, req.Username).Scan(&existingUsername)
    if err != nil {
        if err != sql.ErrNoRows {
            log.Fatal(err)
        }
    } else {
        ctx.JSON(409, gin.H{"error": "Username already in use"})
        return
    }

    insertQuery := "INSERT INTO users (email, password, username) VALUES ($1, $2, $3)"
    _, err = db.Exec(insertQuery, req.Email, req.Password, req.Username)
    if err != nil {
        log.Fatal(err)
    }
    
    token, err := createToken(req.Email)
    if err != nil {
        ctx.JSON(500, gin.H{"error": "Error generating token"})
    }

    log.Println("Signup successful for email:", req.Email)
    ctx.JSON(200, gin.H{"message": "Signup successful", "token": token})
}
