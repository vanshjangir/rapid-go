import { GameState, MsgMoveStatus } from "../types/game";
import { Inflate } from "pako";

export let gridSize = 684;
export let cellSize = gridSize / 19;
export let boardOffset = cellSize/2;
export const WHITE_CELL = 0;
export const BLACK_CELL = 1;
export const EMPTY_CELL = 2;

export const drawBoard = async (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>
) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  if (!ctxRef) return;

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

export const redrawCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameStateRef: React.MutableRefObject<GameState | null>,
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>
) => {
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
  drawBoard(canvasRef, ctxRef);

  if(gameStateRef.current){
    for (let i = 0; i < 19; i++) {
      for (let j = 0; j < 19; j++) {
        if (gameStateRef.current.state[i][j] !== EMPTY_CELL) {
          placeStone(canvasRef, ctxRef, i, j, gameStateRef.current.state[i][j]);
        }
      }
    }
  }
};

export const placeStone = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  col:number, row:number, color: number
) => {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;

  if (!canvas || !ctx) {
    console.log("Canvas or Ctx undefined");
    return;
  }
  
  clearCell(ctxRef, col, row);
  if (color === EMPTY_CELL) {
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

export const getCanvasCoordinates = (
  event: MouseEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } | null => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left - cellSize - boardOffset;
  const y = event.clientY - rect.top - cellSize - boardOffset;
  return { x: Math.round(x / cellSize), y: Math.round(y / cellSize)};
};


export const handleCanvasClick = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  gameStateRef: React.MutableRefObject<GameState | null>,
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  socketRef: React.MutableRefObject<WebSocket | null>,
  event: MouseEvent
) => {
  event.stopPropagation();  
  const canvas = canvasRef.current;
  const socket = socketRef.current;
  const gameState = gameStateRef.current;
  if (!canvas) return;

  const coords = getCanvasCoordinates(event, canvas);

  if (coords && socket && gameState) {
    const col = String.fromCharCode(coords.x + 97);
    const row = coords.y;
    placeStone(canvasRef, ctxRef, coords.x, coords.y, gameState.color);
    socket.send(
      JSON.stringify({
        type: "move",
        move: col + row
      })
    );
  }
};

export const clearCell = (
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  col: number, row: number
) => {
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

export const retainOldState = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>,
  gameStateRef: React.MutableRefObject<GameState | null>,
  msg: MsgMoveStatus,
) => {
  const x = msg.move[0].charCodeAt(0) - 'a'.charCodeAt(0);
  const y = Number(msg.move.slice(1));
  const gameState = gameStateRef.current;
  if (gameState) {
    placeStone(
      canvasRef, ctxRef, x, y,
      gameState.state[x][y]
    );
  }
}


export const decodeState = (
  gameStateRef: React.MutableRefObject<GameState | null>,
  state: string,
): {x: number, y: number, c: number}[] => {
  try {
    if (!gameStateRef.current) return [];
    const gameState = gameStateRef.current;
    const base64Enc = state.replace(/-/g, '+').replace(/_/g, '/');
    const data = Uint8Array.from(atob(base64Enc), char => char.charCodeAt(0));
    const size = data[0];
    const dict = new Uint8Array([2, 1, 0]);
    const inflater = new Inflate({
      windowBits: -15,
      dictionary: dict
    });

    let newMoves: { x: number; y: number; c: number }[] = [];
    try {
      inflater.push(data.slice(1), true);
    } catch (e) {
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
            if (gameState.state[i][j] !== BLACK_CELL)
              newMoves.push({ x: i, y: j, c: BLACK_CELL });
            break;
          case 1:
            if (gameState.state[i][j] !== WHITE_CELL)
              newMoves.push({ x: i, y: j, c: WHITE_CELL });
            break;
          case 0:
            if (gameState.state[i][j] !== EMPTY_CELL)
              newMoves.push({ x: i, y: j, c: EMPTY_CELL });
            break;
        }
      }
    }

    return newMoves;
  } catch (error) {
    throw error;
  }
};
