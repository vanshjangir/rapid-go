FROM golang:latest AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/websocket ./cmd/websocket

FROM debian:stable-slim AS prod

RUN apt-get update && apt-get install -y gnugo
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/websocket /websocket

ENTRYPOINT ["/websocket"]
