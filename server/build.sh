CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o backend_app ./cmd/backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o websocket_app ./cmd/websocket
