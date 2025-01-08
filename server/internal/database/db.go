package database

import (
    "os"
    "fmt"
    "log"
    "sync"
    "strconv"
    "database/sql"
)

var(
    db *sql.DB
    once sync.Once
)

func ConnectDatabase () *sql.DB {
    once.Do( func() {
        host := os.Getenv("POSTGRES_HOST")
        if host == "" {
            host = "localhost"
        }
        port, _ := strconv.Atoi(os.Getenv("POSTGRES_PORT"))
        user := os.Getenv("POSTGRES_USER")
        password := os.Getenv("POSTGRES_PASSWORD")
        dbname := "rapid-go"

        psqlInfo := fmt.Sprintf("host=%s port=%d user=%s "+
            "password=%s dbname=%s sslmode=disable",
            host, port, user, password, dbname)

        var err error
        db, err = sql.Open("postgres", psqlInfo)
        if err != nil {
            panic(err)
        }
        
        err = db.Ping()
        if err != nil {
            panic(err)
        }

        log.Println("Successfully connected to postgres")
    })

    return db
}
