import { useEffect, useRef, useState } from "react";
import { useGlobalContext } from "../GlobalContext";
import { MsgMove, MsgMoveStatus, MsgSync } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";

const BLACK_CELL = 0;
const WHITE_CELL = 1;
const EMPTY_CELL = 2;

const Game: React.FC = () => {
  const { getSocket, player } = useGlobalContext();
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(getSocket());

  let gridSize = 570;
  let cellSize = gridSize / 19;

  const [gameState, setGameState] = useState<GameState | null>({
    gameId: player.gameId,
    color: player.color,
    state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
    liberty: Array.from({ length: 19 }, () => Array(19).fill(4)),
    turn: player.color === 1 ? true : false,
    history: ""
  });

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
    if (gameState) {
      gameState.state[col][row] = color;
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

  const handleSocketRecv = (data: any) => {
    const msg: MsgMove | MsgMoveStatus | MsgSync = JSON.parse(data);
    switch (msg.type) {
      case "movestatus":
        if (!msg.turnStatus) {
          // not your turn
          break;
        }
        if (!msg.moveStatus) {
          // invalid move
        } else {
          if (gameState) {
            updateState(msg.move, gameState.color);
            placeStone(msg.move, gameState.color);
          }
        }
        break;

      case "move":
        if (gameState) {
          updateState(
            msg.move,
            gameState.color === WHITE_CELL ? BLACK_CELL : WHITE_CELL
          );
          placeStone(
            msg.move,
            gameState.color === WHITE_CELL ? BLACK_CELL : WHITE_CELL
          );
        }
        break;

      case "sync":
        if (gameState) {
          console.log("Sycn State", msg);
          setGameState({
            gameId: msg.gameId,
            color: msg.color,
            turn: msg.turn,
            state: msg.state,
            liberty: msg.liberty,
            history: msg.history,
          });
        }
    }
  };

  const setupSocket = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.addEventListener("message", (event) => {
        handleSocketRecv(event.data);
      });
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
    const newGridSize = (Math.floor((Math.floor(Math.min(width, 570)))/19))*19;
    const newCellSize = newGridSize / 19;
    gridSize = newGridSize;
    cellSize = newCellSize;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = gridSize + cellSize;
      canvas.height = gridSize + cellSize;
    }
    drawBoard();

    if(gameState){
      for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
          if (gameState.state[i][j] !== EMPTY_CELL) {
            placeStone(`${String.fromCharCode(i + 97)}${j + 1}`, gameState.state[i][j]);
          }
        }
      }
    }
  };

  useEffect(() => {
    setupSocket();
    setupBoard();
    getGameState();

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#222222]">
      <Navbar />
      <div id="game-container" className="w-full flex flex-col lg:flex-row">
        <div id="game-board" className="w-full lg:w-[70vw] flex justify-center">
          <canvas
            ref={canvasRef}
            id="canvas"
            className="bg-yellow-200"
            width={gridSize + cellSize}
            height={gridSize + cellSize}
          ></canvas>
        </div>
        <div id="game-stats" className="flex flex-col text-white w-full lg:w-auto">
          <button onClick={handlePass}>Pass</button>
          <button onClick={handleAbort}>Abort</button>
        </div>
      </div>
    </div>
  );
};

export default Game;
