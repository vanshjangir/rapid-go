import { useEffect, useRef, useState } from "react";
import { useGlobalContext } from "../GlobalContext";
import { MsgMove, MsgMoveStatus } from "../types/game"
import { GameState } from "../types/game";

const GRID_SIZE = 570
const CELL_SIZE = GRID_SIZE / 19
const BLACK_CELL = 0
const WHITE_CELL = 1
const EMPTY_CELL = 2

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { getSocket, player } = useGlobalContext();
  const socketRef = useRef<WebSocket | null>(getSocket())
  const [gameState, setGameState] = useState<GameState | null>({
    gameId: player.gameId,
    color: player.color,
    state: Array.from({length: 19}, () => Array(19).fill(EMPTY_CELL)),
    liberty: Array.from({length: 19}, () => Array(19).fill(4)),
    turn: player.color === 1 ? true : false,
    history: []
  });

  const drawBoard = async (canvasRef: React.RefObject<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const gridCount = 19;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#000";
    context.lineWidth = 1;

    for (let i = 1; i <= gridCount; i++) {
      const pos = i * CELL_SIZE;

      context.beginPath();
      context.moveTo(pos, CELL_SIZE);
      context.lineTo(pos, GRID_SIZE);
      context.stroke();

      context.beginPath();
      context.moveTo(CELL_SIZE, pos);
      context.lineTo(GRID_SIZE, pos);
      context.stroke();
    }

    ctxRef.current = context;
  };

  const getCanvasCoordinates = (
    event: MouseEvent,
    canvas: HTMLCanvasElement
  ): { col: string; row: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - CELL_SIZE;
    const y = event.clientY - rect.top - CELL_SIZE;
    const col = String.fromCharCode(Math.round(x/CELL_SIZE) + 97);
    const row = Math.round(y/CELL_SIZE);

    return { col, row };
  };


  const handleCanvasClick = (event: MouseEvent) => {
    const canvas = canvasRef.current;
    const socket = socketRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(event, canvas);
    if(coords && socket){
      socket.send(JSON.stringify({
        type: "move",
        move: coords.col + coords.row,
      }))
    }
  };

  const placeStone = (move: string, color: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    if(!canvas || !ctx){
      console.log("Canvas or Ctx undefined")
      return;
    }

    const col = move.charCodeAt(0) - 97;
    const row = parseInt(move.slice(1));

    const x = col * CELL_SIZE + CELL_SIZE;
    const y = row * CELL_SIZE + CELL_SIZE;

    const stoneImage = new Image();
    if(color === 1){
      stoneImage.src = "/whitestone.png";
    } else {
      stoneImage.src = "/blackstone.png";
    }

    stoneImage.onload = () => {
      const radius = CELL_SIZE / 2;
      ctx.drawImage(stoneImage, x - radius, y - radius, radius * 2, radius * 2);
    };
  };

  const updateState = (move: string) => {
    const col = move.charCodeAt(0) - 97;
    const row = parseInt(move.slice(1));
    if(gameState){
      gameState.state[col][row] = gameState?.color === 1 ? BLACK_CELL : WHITE_CELL;
    }
  }

  const handleSocketRecv = (data:any) => {
    const msg: MsgMove | MsgMoveStatus = JSON.parse(data);
    switch (msg.type) {
      case "movestatus":
        if(!msg.turnStatus){
          // not your turn
          break;
        }
        if(!msg.moveStatus){
          //invalid move
        } else {
          updateState(msg.move);
          if(gameState){
            placeStone(msg.move, gameState.color);
          }
        }
        break;

      case "move":
        updateState(msg.move);
        if(gameState){
          placeStone(msg.move, gameState.color === 1 ? 0 : 1);
        }
        break;
    }
  }

  const setupSocket = () => {
    const socket = socketRef.current;
    if(socket){
      socket.addEventListener("message", event => {
        handleSocketRecv(event.data);
      })
    }
  }

  const setupBoard = () => {
    drawBoard(canvasRef);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("click", handleCanvasClick);
    }
  }

  useEffect(() => {
    setupSocket();
    setupBoard();
    setGameState({
      gameId: player.gameId,
      color: player.color,
      state: Array.from({length: 19}, () => Array(19).fill(EMPTY_CELL)),
      liberty: Array.from({length: 19}, () => Array(19).fill(4)),
      turn: player.color === 1 ? true : false,
      history: []
    })
  }, []);

  return (
    <div className="h-screen flex flex-col bg-black">
      <div id="navbar" className="h-20"></div>
      <div id="game-container" className="w-full flex">
        <div id="game-board" className="w-[70vw] flex justify-center">
          <canvas
            ref={canvasRef}
            id="canvas"
            className="bg-yellow-200"
            width={GRID_SIZE + CELL_SIZE}
            height={GRID_SIZE + CELL_SIZE}
          ></canvas>
        </div>
        <div id="game-stats"></div>
      </div>
    </div>
  );
};

export default Game;
