#!/bin/sh

SESSION_NAME=${1:-'rapidgo'}

IS_SESSION_STARTED=$(tmux list-sessions 2> /dev/null | grep $SESSION_NAME | wc -l)

if [ $IS_SESSION_STARTED -gt 0 ]; then
  echo "Session with '$SESSION_NAME' already exists. Try using a different name by passing it as an argument."
  exit 1
fi

tmux new-session -d -s $SESSION_NAME
tmux rename-window -t $SESSION_NAME:1 'editor'
tmux send-keys -t 'editor' C-m "nvim" C-m

tmux new-window -t $SESSION_NAME:2 -n 'backend'
tmux send-keys -t 'backend' "cd server/cmd/backend" C-m "go run ." C-m

tmux new-window -t $SESSION_NAME:3 -n 'websocket'
tmux send-keys -t 'websocket' "cd server/cmd/websocket" C-m "go run ." C-m

tmux new-window -t $SESSION_NAME:4 -n 'frontend'
tmux send-keys -t 'frontend' "cd frontend" C-m "npm run dev" C-m

tmux select-window -t $SESSION_NAME:1
tmux attach -t $SESSION_NAME
