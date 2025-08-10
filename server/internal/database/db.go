package database

import (
	"database/sql"
	"log"
	"os"
	"sync"
)

var (
	db   *sql.DB
	once sync.Once
)

func GetDatabase() *sql.DB {
	once.Do(func() {
		connection_uri := os.Getenv("POSTGRES_URI")

		var err error
		db, err = sql.Open("postgres", connection_uri)
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
