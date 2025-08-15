import { useEffect, useRef } from "react";
import { useParams } from 'react-router-dom';
import { MsgChat, MsgMove, MsgMoveStatus, MsgSync, MsgGameover } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";
import { Inflate } from "pako";
import {
  cellSize,
  gridSize,
  placeStone,
  WHITE_CELL,
  BLACK_CELL,
  EMPTY_CELL,
  handleResize,
} from "../utils/board";
import {
  Box,
  Flex,
  VStack,
  Text,
} from "@chakra-ui/react";

const Spectate: React.FC = () => {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);
  const playerClockRef = useRef<HTMLDivElement>(null);
  const opponentClockRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const historyDivRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const httpapi = import.meta.env.VITE_HTTP_URL
  const token = localStorage.getItem("token") || "";
  const { gameId } = useParams();
  
  gameStateRef.current = {
    gameId: gameId || "",
    color: BLACK_CELL,
    state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
    turn: true,
    history: []
  };


  let playerTime = 900;
  let opponentTime = 900;

  const getGameState = async () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ type: "reqState", }));
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

      let newMoves: { x: number; y: number; c: number }[] = [];
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

      newMoves.forEach((item) => {
        gameState.state[item.x][item.y] = item.c;
        if (item.c === EMPTY_CELL) {
          placeStone(canvasRef, ctxRef, item.x, item.y, EMPTY_CELL);
          return;
        }
        gameState.turn = !gameState.turn;
        showMoveStatus(move);
        placeStone(canvasRef, ctxRef, item.x, item.y, item.c);
      });

      if (!gameState.history) gameState.history = [];
      gameState.history.push(move);
      updateHistory(gameState.history);
    } catch (error) {
      console.error('Decode error:', error);
      throw error;
    }
  };

  const handleSocketRecv = async (data: any) => {
    const msg: MsgMove | MsgMoveStatus | MsgSync | MsgGameover | MsgChat =
      await JSON.parse(data);
    switch (msg.type) {
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
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
        }
        break;

      case "gameover":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage(
          msg.winner === gameStateRef.current?.color ?
            "Black won" : "White won"
        );
        socketRef.current?.close();
        break;

      case "sync":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          console.log("Sync State", msg);
          gameState.gameId = msg.gameId;
          gameState.color = msg.color;
          gameState.turn = msg.turn;

          decodeState(msg.state, "");

          gameState.history = msg.history;
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
          handleResize(canvasRef, gameStateRef, ctxRef);
          setupClock();
          updateHistory(gameState.history);
        }
        break;

      default:
        socketRef.current?.close();
        break;
    }
  };
  
  const getWsurl = async () => {
    const response = await fetch(httpapi + "/getwsurl", {
      headers: { Authorization : token }
    });

    const json = await response.json();
    return json.wsurl || "";
  }

  const setupSocket = async () => {
    const wsurl = await getWsurl();
    socketRef.current = new WebSocket("ws://" + wsurl + `/spectate/${gameId}` + "?token=" + token);
    const socket = socketRef.current;
    if (socket) {
      socket.onmessage = async (event: MessageEvent) => {
        const data = await event.data;
        handleSocketRecv(data);
      };
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
      return;
    }
    if (gameStateRef.current.turn === true) {
      playerClockRef.current.textContent = formatTime(playerTime);
    } else {
      opponentClockRef.current.textContent = formatTime(opponentTime);
    }
  };

  const setupClock = () => {
    if (playerClockRef.current && opponentClockRef.current) {
      playerClockRef.current.textContent = formatTime(playerTime);
      opponentClockRef.current.textContent = formatTime(opponentTime);
    }
  };

  const showMoveStatus = (msg: string) => {
    if (msgRef.current) {
      msgRef.current.className = "text-center text-xl font-bold h-[40px]";
      if (!isNaN(Number(msg.slice(1)))) {
        msgRef.current.innerText = toShow(msg);
      } else {
        msgRef.current.innerText = msg === "ps" ? "Pass" : msg;
      }
    }
  };

  const showEndMessage = (msg: string) => {
    if (msgRef.current) {
      msgRef.current.className = "text-center text-3xl font-bold h-[40px]";
      msgRef.current.innerText = msg;
    }
  };

  const toShow = (move: string) => {
    if (move) {
      return move === "ps" ? "Pass" :
        move[0].toUpperCase() + String(Number(move.slice(1)) + 1);
    }
    return "";
  };

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
          firstMove.className = "bg-[#2d3748] w-[50%] text-center p-1";
          firstMove.textContent = toShow(history[index]);

          const secondMove = document.createElement("div");
          secondMove.className = "bg-[#4a5568] w-[50%] text-center p-1";
          secondMove.textContent = toShow(history[index + 1]);

          rowDiv.appendChild(firstMove);
          rowDiv.appendChild(secondMove);

          if (historyDivRef.current)
            historyDivRef.current.appendChild(rowDiv);
        }
      });
      
      historyDivRef.current.scrollTop = historyDivRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    handleResize(canvasRef, gameStateRef, ctxRef);
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
    getGameState();

    const resizeHandler = () => {
      handleResize(canvasRef, gameStateRef, ctxRef);
    };

    window.addEventListener("resize", resizeHandler);
    handleResize(canvasRef, gameStateRef, ctxRef);

    return () => {
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return (
    <Box 
      minH="100vh" 
      display="flex" 
      flexDirection="column" 
      bg="linear-gradient(135deg, #1a202c 0%, #2d3748 25%, #4a5568 50%, #2d3748 75%, #1a202c 100%)"
      overflowY="auto"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        opacity="0.05"
        backgroundSize="100px 100px"
      />

      <Navbar />
      <Flex 
        id="game-container" 
        w="100%" 
        flexDirection={{ base: "column", lg: "row" }} 
        alignItems={{ base: "center", lg: "flex-start" }} 
        justifyContent="center"
        gap={8}
        p={6}
        position="relative"
        zIndex={1}
      >
        <VStack 
          id="game-clocks" 
          spacing={6} 
          align="center"
          w={{ base: "100%", lg: "auto" }}
          order={{ base: 1, lg: 1 }}
        >
          <VStack 
            color="white" 
            w={{ base: `${gridSize + 2 * cellSize}px`, lg: "100%" }}
            justifyContent="space-between"
            bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
            backdropFilter="blur(12px)"
            rounded="2xl"
            p={6}
            border="2px solid"
            borderColor="whiteAlpha.200"
            boxShadow="0 20px 40px rgba(0, 0, 0, 0.4)"
          >
            <VStack spacing={2} textAlign="center">
              <Text fontSize="xl" fontWeight="600" color="orange.200">White</Text>
              <Box 
                as="div" 
                ref={opponentClockRef} 
                fontSize="2xl" 
                fontWeight="700"
                bg="linear-gradient(135deg, rgba(246, 173, 85, 0.2), rgba(237, 137, 54, 0.2))"
                px={4}
                py={2}
                rounded="xl"
                fontFamily="mono"
                border="1px solid"
                borderColor="orange.400"
                textShadow="0 0 10px rgba(246, 173, 85, 0.3)"
              />
            </VStack>
            <VStack spacing={2} textAlign="center">
              <Text fontSize="xl" fontWeight="600" color="orange.200">Black</Text>
              <Box 
                as="div" 
                ref={playerClockRef} 
                fontSize="2xl" 
                fontWeight="700"
                bg="linear-gradient(135deg, rgba(246, 173, 85, 0.2), rgba(237, 137, 54, 0.2))"
                px={4}
                py={2}
                rounded="xl"
                fontFamily="mono"
                border="1px solid"
                borderColor="orange.400"
                textShadow="0 0 10px rgba(246, 173, 85, 0.3)"
              />
            </VStack>
          </VStack>
        </VStack>

        <VStack 
          id="game-board" 
          spacing={6} 
          align="center"
          order={{ base: 2, lg: 2 }}
        >
          <Box position="relative">
            <Box
              position="absolute"
              top="-15px"
              left="-15px"
              right="-15px"
              bottom="-15px"
              borderRadius="3xl"
              bg="radial-gradient(circle, rgba(246, 173, 85, 0.15), rgba(237, 137, 54, 0.05))"
              filter="blur(20px)"
            />
            <canvas
              ref={canvasRef}
              id="canvas"
              width={gridSize + 2 * cellSize}
              height={gridSize + 2 * cellSize}
              style={{
                position: "relative",
                zIndex: 2,
                backgroundColor: "#fef3c7",
                borderRadius: "24px",
                border: "3px solid rgba(246, 173, 85, 0.3)",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)"
              }}
            />
          </Box>
        </VStack>

        <VStack 
          id="game-stats" 
          spacing={6}
          w={{ base: `${gridSize + 2 * cellSize}px`, lg: "400px" }}
          color="white"
          order={{ base: 3, lg: 3 }}
        >
          <Box 
            ref={msgRef} 
            textAlign="center" 
            fontSize="2xl" 
            fontWeight="900" 
            h="60px"
            bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
            backdropFilter="blur(12px)"
            rounded="2xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            border="2px solid"
            borderColor="whiteAlpha.200"
            w="100%"
            bgGradient="linear(to-r, #f6ad55, #ed8936)"
            bgClip="text"
            textShadow="0 0 20px rgba(237, 137, 54, 0.3)"
            boxShadow="0 20px 40px rgba(0, 0, 0, 0.4)"
          />

          <VStack spacing={4} w="100%">
            <Box
              bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
              backdropFilter="blur(12px)"
              rounded="2xl"
              border="2px solid"
              borderColor="whiteAlpha.200"
              boxShadow="0 20px 40px rgba(0, 0, 0, 0.4)"
              w="100%"
              p={4}
              position="relative"
              overflow="hidden"
            >
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                h="3px"
                bg="linear-gradient(90deg, #f6ad55, #ed8936, #dd6b20)"
              />
              <Text fontSize="lg" fontWeight="600" color="orange.200" mb={3}>
                Game History
              </Text>
              <Box
                ref={historyDivRef}
                display="flex"
                flexDirection="column"
                overflowY="auto"
                h="200px"
                w="100%"
                bg="linear-gradient(135deg, rgba(26, 32, 44, 0.5), rgba(45, 55, 72, 0.5))"
                borderRadius="xl"
                border="1px solid"
                borderColor="whiteAlpha.200"
              />
            </Box>
          </VStack>
        </VStack>
      </Flex>
    </Box>
  );
};

export default Spectate;
