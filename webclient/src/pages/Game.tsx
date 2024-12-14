import { useEffect, useRef } from "react";
import { useGlobalContext } from "../GlobalContext";
import { ChatMessage, MsgChat, MsgLose, MsgMove, MsgMoveStatus, MsgSync, MsgWin } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";

const WHITE_CELL = 0;
const BLACK_CELL = 1;
const EMPTY_CELL = 2;

const Game: React.FC = () => {
  const { getSocket, destSocket, player } = useGlobalContext();
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(getSocket());
  const intervalRef = useRef<number | null>(null);
  const playerClockRef = useRef<HTMLDivElement>(null);
  const opponentClockRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const historyDivRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const messages = useRef<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  gameStateRef.current = {
    gameId: player.gameId,
    color: player.color,
    state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
    liberty: Array.from({ length: 19 }, () => Array(19).fill(4)),
    turn: player.color === 1 ? true : false,
    history: []
  };

  let gridSize = 684;
  let cellSize = gridSize / 19;
  let playerTime = 900;
  let opponentTime = 900;
  let newMessage = "";

  const drawBoard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const gridCount = 19;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#000";
    context.lineWidth = 1;

    for (let i = 0; i < gridCount; i++) {
      const pos = (i + 1) * cellSize;

      context.beginPath();
      context.moveTo(pos, cellSize);
      context.lineTo(pos, gridSize);
      context.stroke();

      context.beginPath();
      context.moveTo(cellSize, pos);
      context.lineTo(gridSize, pos);
      context.stroke();
    }

    context.font = `${gridSize/50}px Arial`;
    context.fillStyle = "#000";
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (let i = 0; i < gridCount; i++) {
      const x = (i + 1) * cellSize;
      const label = String.fromCharCode(65 + i);
      context.fillText(label, x, cellSize / 2);
    }
    
    for (let i = 0; i < gridCount; i++) {
      const x = (i + 1) * cellSize;
      const label = String.fromCharCode(65 + i);
      context.fillText(label, x, gridSize + cellSize / 2);
    }

    for (let i = 0; i < gridCount; i++) {
      const y = (i + 1) * cellSize;
      const label = (i + 1).toString();
      context.fillText(label, cellSize / 2, y);
    }

    for (let i = 0; i < gridCount; i++) {
      const y = (i + 1) * cellSize;
      const label = (i + 1).toString();
      context.fillText(label, gridSize + cellSize / 2, y);
    }

    ctxRef.current = context;
  };

  const getCanvasCoordinates = (
    event: MouseEvent,
    canvas: HTMLCanvasElement
  ): { col: string; row: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - cellSize;
    const y = event.clientY - rect.top - cellSize;
    const col = String.fromCharCode(Math.round(x / cellSize) + 97);
    const row = Math.round(y / cellSize);

    return { col, row };
  };

  const handleCanvasClick = (event: MouseEvent) => {
    event.stopPropagation();  
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(event, canvas);
    if (coords && socket) {
      socket.send(
        JSON.stringify({
          type: "move",
          move: coords.col + coords.row
        })
      );
    }
  };

  const placeStone = (move: string, color: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!canvas || !ctx) {
      console.log("Canvas or Ctx undefined");
      return;
    }

    const col = move.charCodeAt(0) - 97;
    const row = parseInt(move.slice(1));

    const x = col * cellSize + cellSize;
    const y = row * cellSize + cellSize;

    const stoneImage = new Image();
    if (color === WHITE_CELL) {
      stoneImage.src = "/whitestone.png";
    } else {
      stoneImage.src = "/blackstone.png";
    }

    stoneImage.onload = () => {
      const radius = cellSize / 2;
      ctx.drawImage(stoneImage, x - radius, y - radius, radius * 2, radius * 2);
    };
  };

  const updateState = (move: string, color: number) => {
    const col = move.charCodeAt(0) - 97;
    const row = parseInt(move.slice(1));
    if (gameStateRef.current) {
      const gameState = gameStateRef.current;
      if (!gameState.history) gameState.history = [];

      gameState.state[col][row] = color;
      gameState.turn = !gameState.turn;
      gameState.history.push(move);
      updateHistory(gameState.history);
      showMoveStatus(move);
      console.log("GameState", gameStateRef.current)
    }
  };

  const getGameState = async () => {
    const socket = socketRef.current;
    if (!socket) {
      return
    }

    socket.send(
      JSON.stringify({
        type: "reqState",
      })
    );
  }

  const handlePass = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "move",
          move: "ps"
        })
      );
    }
  };

  const handleAbort = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "abort"
        })
      );
    }
  };

  const handleSocketRecv = async (data: any) => {
    const msg: MsgMove | MsgMoveStatus | MsgSync | MsgWin | MsgLose | MsgChat =
      await JSON.parse(data);
    switch (msg.type) {
      case "movestatus":
        if (!msg.turnStatus) {
          showMoveStatus("Not your turn");
          break;
        }
        if (!msg.moveStatus) {
          showMoveStatus("Invalid move");
          break;
        }
        if (gameStateRef.current) {
          updateState(msg.move, gameStateRef.current.color);
          placeStone(msg.move, gameStateRef.current.color);
          playerTime = 900 - Math.round(msg.selfTime/1000);
          opponentTime = 900 - Math.round(msg.opTime/1000);
        }
        break;

      case "move":
        if (gameStateRef.current) {
          updateState(
            msg.move,
            gameStateRef.current.color === WHITE_CELL ? BLACK_CELL : WHITE_CELL
          );
          placeStone(
            msg.move,
            gameStateRef.current.color === WHITE_CELL ? BLACK_CELL : WHITE_CELL
          );
          playerTime = 900 - Math.round(msg.selfTime/1000);
          opponentTime = 900 - Math.round(msg.opTime/1000);
        }
        break;

      case "sync":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current
          console.log("Sycn State", msg);
          gameState.gameId = msg.gameId,
          gameState.color = msg.color,
          gameState.turn = msg.turn,
          gameState.state = msg.state,
          gameState.liberty = msg.liberty,
          gameState.history = msg.history,
          playerTime = 900 - Math.round(msg.selfTime/1000);
          opponentTime = 900 - Math.round(msg.opTime/1000);
          handleResize();
          setupClock();
          updateHistory(gameState.history);
        }
        break;

      case "win":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage("You Won", true)
        destSocket();
        console.log("You Won!!")
        break;
      
      case "lose":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage("You Lost", false)
        destSocket();
        console.log("You Lost :(")
        break;

      case "chat":
        messages.current = [...messages.current, {type: 'received', text: msg.message.trim() }];
        updateChat();
        break;
    }
  };

  const setupSocket = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.onmessage = async (event: MessageEvent) => {
        const data = await event.data;
        handleSocketRecv(data)
      }
    }
  };

  const setupBoard = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("click", handleCanvasClick);
    }
  };

  const handleResize = () => {
    const width = window.innerWidth * 0.7 > 600 ? window.innerWidth * 0.7 : window.innerWidth * 0.9;
    const newGridSize = (Math.floor((Math.floor(Math.min(width, 684)))/19))*19;
    const newCellSize = newGridSize / 19;
    gridSize = newGridSize;
    cellSize = newCellSize;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = gridSize + cellSize;
      canvas.height = gridSize + cellSize;
    }
    drawBoard();

    if(gameStateRef.current){
      for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
          if (gameStateRef.current.state[i][j] !== EMPTY_CELL) {
            placeStone(`${String.fromCharCode(i + 97)}${j + 1}`, gameStateRef.current.state[i][j]);
          }
        }
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  const updateClock = () => {
    if (!playerClockRef.current || !opponentClockRef.current || !gameStateRef.current) {
      return
    }
    if (gameStateRef.current.turn === true) {
      playerClockRef.current.textContent = formatTime(playerTime);
    } else {
      opponentClockRef.current.textContent = formatTime(opponentTime);
    }
  };

  const setupClock = () => {
    if (playerClockRef.current && opponentClockRef.current) {
      playerClockRef.current.textContent = formatTime(playerTime)
      opponentClockRef.current.textContent = formatTime(opponentTime);
    }
  }

  const showMoveStatus = (msg: string) => {
    if (msgRef.current) {
      msgRef.current.className = "text-center text-xl font-bold h-[40px]";
      msgRef.current.innerText = msg;
    }
  }

  const showEndMessage = (msg: string, win: boolean) => {
    if (msgRef.current) {
      if (win) {
        msgRef.current.className = "text-center text-3xl font-bold h-[40px]";
        msgRef.current.innerText = msg;
      } else {
        msgRef.current.className = "text-center text-3xl font-bold h-[40px]";
        msgRef.current.innerText = msg;
      }
    }
  }

  const updateHistory = (history: string[]) => {
    if (historyDivRef.current) {
      historyDivRef.current.innerHTML = "";
      history.forEach((_, index) => {
        if (index % 2 === 0) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "text-white flex flex-row w-full";

          const firstMove = document.createElement("div");
          firstMove.className = "bg-[#282828] w-[50%] text-center";
          firstMove.textContent = history[index] || "";

          const secondMove = document.createElement("div");
          secondMove.className = "bg-[#343434] w-[50%] text-center";
          secondMove.textContent = history[index + 1] || "";

          rowDiv.appendChild(firstMove);
          rowDiv.appendChild(secondMove);

          if (historyDivRef.current)
            historyDivRef.current.appendChild(rowDiv);
        }
      });
    }
  };
  
  const updateChat = () => {
    if (chatRef.current) {
      chatRef.current.innerHTML = "";
      messages.current.forEach((_, index) => {
        const textDiv = document.createElement("div");
        textDiv.className = "text-white flex flex-row w-full";
        textDiv.textContent = messages.current[index].text;
        textDiv.className = `px-2 rounded-lg text-wrap break-all ${messages.current[index].type === 'sent' ? 'text-blue-500 self-end' : 'text-gray-500 self-start'}`;


        if (chatRef.current) {
          chatRef.current.appendChild(textDiv);
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      });
    }
  };

  const handleSendMessage = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (newMessage.trim()) {
      messages.current = [...messages.current, { type: 'sent', text: newMessage.trim() }];
      const socket = socketRef.current;
      if (socket) {
        socket.send(
          JSON.stringify({
            type: "chat",
            message: newMessage.trim()
          })
        );
      }
      newMessage = "";
      updateChat();
    }
  };

  useEffect(() => {
    handleResize();
    setupClock();
  }, [gameStateRef.current]);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      if (!gameStateRef.current) return;
      gameStateRef.current.turn === true ? playerTime -= 1 : opponentTime -= 1;
      updateClock();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setupSocket();
    setupBoard();
    getGameState();
    setupClock();

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#222222] overflow-y-auto">
      <Navbar />
      <div id="game-container" className="w-full flex flex-col items-center justify-center lg:flex-row">
        <div id="game-board" className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            id="canvas"
            className="bg-yellow-200"
            width={gridSize + cellSize}
            height={gridSize + cellSize}
          ></canvas>
          <div className="flex text-white w-full justify-between">
            <div className="text-center">
              <span className="text-xl font-bold">Opponent</span>
              <div className="text-lg" ref={opponentClockRef}></div>
            </div>
            <div className="text-center">
              <span className="text-xl font-bold">Player</span>
              <div className="text-lg" ref={playerClockRef}></div>
            </div>
          </div>
        </div>
        <div id="game-stats" className="flex flex-col ml-2 text-white">
          <div ref={msgRef} className="text-center text-3xl font-bold h-[40px]"></div>
          <div className="flex flex-row justify-center w-[400px] p-2">
            <button
              onClick={handlePass}
              className="bg-blue-500 rounded-l-lg p-2 w-[150px]"
            >Pass</button>
            <button
              onClick={handleAbort}
              className="bg-red-500 rounded-r-lg p-2 w-[150px]"
            >Abort</button>
          </div>
          <div className="flex flex-col text-white h-[250px] w-[400px] items-center">
            <div
              ref={historyDivRef}
              className="flex flex-col overflow-y-auto h-full w-full bg-[#181818] rounded"
              style={{ maxHeight: "250px" }}
            ></div>
          </div>
          <div className="flex flex-col text-white h-[300px] w-[400px] items-center">
            <div className="mb-2">Chat</div>
            <div
              ref={chatRef}
              className="flex flex-col overflow-y-auto h-[250px] w-full bg-[#181818] rounded"
              style={{ maxHeight: "250px", padding: "10px" }}
            >
            </div>
            <div className="flex w-full mt-2">
              <input
                type="text"
                ref={inputRef}
                onChange={(e) => newMessage = e.target.value}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage()}}
                className="flex-1 p-2 bg-[#282828] text-white rounded-l-lg outline-none"
                placeholder="Type your message..."
              />
              <button
                onClick={handleSendMessage}
                className="p-2 bg-blue-500 text-white rounded-r-lg"
              >Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
