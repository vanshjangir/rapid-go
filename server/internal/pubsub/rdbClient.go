package pubsub

import (
	"context"
	"encoding/json"

	"github.com/go-redis/redis/v8"
)

type PubsubMsg struct {
	Player string          `json:"player"`
	Type   string          `json:"type"`
	Data   json.RawMessage `json:"data"`
}

var RdbCtx = context.Background()
var Rdb *redis.Client
