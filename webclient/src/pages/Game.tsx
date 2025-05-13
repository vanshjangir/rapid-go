import { useEffect, useRef } from "react";
import { useGlobalContext } from "../GlobalContext";
import { ChatMessage, MsgChat, MsgLose, MsgMove, MsgMoveStatus, MsgSync, MsgWin } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";
import { Inflate } from "pako";

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
    turn: player.color === 1 ? true : false,
    history: []
  };

  let gridSize = 684;
  let cellSize = gridSize / 19;
  let boardOffset = cellSize/2;
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
      const pos = (i + 1) * cellSize + boardOffset;

      context.beginPath();
      context.moveTo(pos, cellSize + boardOffset);
      context.lineTo(pos, gridSize + boardOffset);
      context.stroke();

      context.beginPath();
      context.moveTo(cellSize + boardOffset, pos);
      context.lineTo(gridSize + boardOffset, pos);
      context.stroke();
    }

    context.font = `${gridSize/50}px Arial`;
    context.fillStyle = "#000";
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (let i = 0; i < gridCount; i++) {
      const x = (i + 1) * cellSize;
      const label = String.fromCharCode(65 + i);
      context.fillText(label, x + boardOffset, boardOffset);
    }
    
    for (let i = 0; i < gridCount; i++) {
      const x = (i + 1) * cellSize;
      const label = String.fromCharCode(65 + i);
      context.fillText(label, x + boardOffset, gridSize + cellSize + boardOffset);
    }

    for (let i = 0; i < gridCount; i++) {
      const y = (i + 1) * cellSize;
      const label = (i + 1).toString();
      context.fillText(label, cellSize / 2, y + boardOffset);
    }

    for (let i = 0; i < gridCount; i++) {
      const y = (i + 1) * cellSize;
      const label = (i + 1).toString();
      context.fillText(label, gridSize + cellSize + boardOffset, y + boardOffset);
    }

    ctxRef.current = context;
  };

  const getCanvasCoordinates = (
    event: MouseEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - cellSize - boardOffset;
    const y = event.clientY - rect.top - cellSize - boardOffset;
    return { x: Math.round(x / cellSize), y: Math.round(y / cellSize)};
  };

  const handleCanvasClick = (event: MouseEvent) => {
    event.stopPropagation();  
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    const gameState = gameStateRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(event, canvas);
    
    if (coords && socket && gameState) {
      const col = String.fromCharCode(coords.x + 97);
      const row = coords.y;
      placeStone(coords.x, coords.y, gameState.color);
      socket.send(
        JSON.stringify({
          type: "move",
          move: col + row
        })
      );
    }
  };

  const placeStone = (col:number, row:number, color: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if (!canvas || !ctx) {
      console.log("Canvas or Ctx undefined");
      return;
    }
   
    const x = col * cellSize + cellSize + boardOffset;
    const y = row * cellSize + cellSize + boardOffset;

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

  const clearCell = (col: number, row: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const x = col * cellSize + cellSize + boardOffset;
    const y = row * cellSize + cellSize + boardOffset;

    const startx = cellSize + boardOffset;
    const starty = cellSize + boardOffset;
    const endx = gridSize + boardOffset;
    const endy = gridSize + boardOffset;
    
    ctx.clearRect(x - cellSize/2, y - cellSize/2, cellSize, cellSize);
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(Math.max(x - cellSize/2, startx), y);
    ctx.lineTo(Math.min(x + cellSize/2, endx), y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x, Math.max(y - cellSize/2, starty));
    ctx.lineTo(x, Math.min(y + cellSize/2, endy));
    ctx.stroke();
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

  const decodeState = (state: string, move: string) => {
    try {
      if (!gameStateRef.current) return;
      const gameState = gameStateRef.current;
      const base64Enc = state.replace(/-/g, '+').replace(/_/g, '/');
      const data = Uint8Array.from(atob(base64Enc), char => char.charCodeAt(0));
      const size = data[0];
      const dict = new Uint8Array([2, 1, 0]);
      const inflater = new Inflate({
        windowBits: -15,
        dictionary: dict
      });

      let newMoves: {x:number; y:number; c:number}[] = [];
      
      try {
        inflater.push(data.slice(1), true);
      } catch (e) {
        console.error('Inflation error:', e);
        throw e;
      }

      if (inflater.err) {
        throw new Error(`Decompression failed: ${inflater.msg}`);
      }

      const decompressed = inflater.result;
      let pos = 0;

      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          if (pos >= decompressed.length) {
            throw new Error('Unexpected end of decompressed data');
          }
          const c = decompressed[pos++];
          switch (c) {
            case 2:
              if (gameState.state[i][j] != BLACK_CELL) {
                newMoves.push({x:i, y:j, c:BLACK_CELL});
              }
              break;
            case 1:
              if (gameState.state[i][j] != WHITE_CELL) {
                newMoves.push({x:i, y:j, c:WHITE_CELL});
              }
              break;
            case 0:
              if (gameState.state[i][j] != EMPTY_CELL) {
                newMoves.push({x:i, y:j, c:EMPTY_CELL});
              }
              break;
          }
        }
      }

      newMoves.forEach((item) => {
        gameState.state[item.x][item.y] = item.c;
        if (item.c === EMPTY_CELL) {
          clearCell(item.x, item.y);
          return;
        }
      

        gameState.turn = !gameState.turn;
        showMoveStatus(move);
        placeStone(item.x, item.y, item.c);
      })

      if (!gameState.history) gameState.history = [];
      gameState.history.push(move);
      updateHistory(gameState.history);
    } catch (error) {
      console.error('Decode error:', error);
      throw error;
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
    console.log("MoveStatus", msg);
    switch (msg.type) {
      case "movestatus":
        if (!msg.turnStatus) {
          showMoveStatus("Not your turn");
          const x = msg.move[0].charCodeAt(0) - 'a'.charCodeAt(0);
          const y = Number(msg.move.slice(1));
          console.log("col", x, y);
          clearCell(x,y);
          break;
        }
        if (!msg.moveStatus) {
          showMoveStatus("Invalid move");
          const x = msg.move[0].charCodeAt(0) - 'a'.charCodeAt(0);
          const y = Number(msg.move.slice(1));
          clearCell(x,y);
          break;
        }
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          
          if (msg.move === "ps") {
            if (!gameState.history) gameState.history = [];
            gameState.history.push(msg.move);
            gameState.turn = !gameState.turn;
            updateHistory(gameState.history);
            showMoveStatus("Pass");
          } else {
            decodeState(msg.state, msg.move);
          }
          
          playerTime = 900 - Math.round(msg.selfTime/1000);
          opponentTime = 900 - Math.round(msg.opTime/1000);
        }
        break;

      case "move":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          if (msg.move === "ps") {
            gameState.history.push(msg.move);
            gameState.turn = !gameState.turn;
            updateHistory(gameState.history);
            showMoveStatus("Pass");
          } else {
            decodeState(msg.state, msg.move);
          }
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
          
          decodeState(msg.state, ""),
          
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
        showEndMessage("You Won")
        destSocket();
        console.log("You Won!!")
        break;
      
      case "lose":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage("You Lost")
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
      canvas.width = gridSize + 2 * cellSize;
      canvas.height = gridSize + 2 * cellSize;
    }
    drawBoard();

    if(gameStateRef.current){
      for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
          if (gameStateRef.current.state[i][j] !== EMPTY_CELL) {
            placeStone(i, j, gameStateRef.current.state[i][j]);
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
      if (!isNaN(Number(msg.slice(1,)))) {
        msgRef.current.innerText = toShow(msg);
      } else {
        msgRef.current.innerText = msg === "ps" ? "Pass" : msg;
      }
    }
  }

  const showEndMessage = (msg: string) => {
    if (msgRef.current) {
      msgRef.current.className = "text-center text-3xl font-bold h-[40px]";
      msgRef.current.innerText = msg;
    }
  }

  const toShow = (move: string) => {
    if (move) {
      return move === "ps" ? "Pass" :
      move[0].toUpperCase() + String(Number(move.slice(1,)) + 1);
    }
    return "";
  }

  const updateHistory = (history: string[]) => {
    if (history.length > 2) {
      const last = history[history.length - 1];
      const slast = history[history.length - 2];
      if (last === "ps" && slast === "ps") {
        if (msgRef.current) {
          console.log("aya", history);
          msgRef.current.className = "text-center text-3xl font-bold h-[40px]";
          msgRef.current.innerText = "Evaluating...";
        }
      }
    }

    if (historyDivRef.current) {
      historyDivRef.current.innerHTML = "";
      history.forEach((_, index) => {
        if (index % 2 === 0) {
          const rowDiv = document.createElement("div");
          rowDiv.className = "text-white flex flex-row w-full";

          const firstMove = document.createElement("div");
          firstMove.className = "bg-[#282828] w-[50%] text-center";
          firstMove.textContent = toShow(history[index]);

          const secondMove = document.createElement("div");
          secondMove.className = "bg-[#343434] w-[50%] text-center";
          secondMove.textContent = toShow(history[index + 1]);

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
      <div id="game-container" className="w-full flex flex-col items-center mt-8 justify-center lg:flex-row">
        <div id="game-board" className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            id="canvas"
            className="bg-yellow-200"
            width={gridSize + 2 * cellSize}
            height={gridSize + 2 * cellSize}
          ></canvas>
          <div className="flex text-white w-full justify-between">
            <div className="text-center">
              <span className="text-xl font-bold">Player</span>
              <div className="text-lg" ref={playerClockRef}></div>
            </div>
            <div className="text-center">
              <span className="text-xl font-bold">Opponent</span>
              <div className="text-lg" ref={opponentClockRef}></div>
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
          <div className="flex flex-col text-white h-[240px] w-[400px] items-center">
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
              className="flex flex-col overflow-y-auto h-[240px] w-full bg-[#181818] rounded"
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
