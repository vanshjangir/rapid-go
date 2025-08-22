import { useState, useEffect, useRef } from "react";
import { useParams } from 'react-router-dom';
import { MsgChat, MsgMove, MsgMoveStatus, MsgSync, MsgGameover } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";
import {
  cellSize,
  gridSize,
  BLACK_CELL,
  EMPTY_CELL,
  redrawCanvas,
  decodeState,
} from "../utils/board";
import {
  Box,
  Flex,
  VStack,
  HStack,
  Circle,
  Text,
} from "@chakra-ui/react";

const Spectate: React.FC = () => {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const setupSocketRef = useRef<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const playerClockRef = useRef<HTMLDivElement>(null);
  const opponentClockRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const historyDivRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  
  const BACKEND_URL = import.meta.env.PROD ?
    import.meta.env.VITE_HTTPS_URL :
    import.meta.env.VITE_HTTP_URL;
  const token = localStorage.getItem("token") || "";
  const { gameId } = useParams();
  const [pname, setPname] = useState<string>("Black");
  const [opname, setOpname] = useState<string>("White");
  const [currentTurn, setCurrentTurn] = useState<boolean>(false);
  const wsWsPrefix = import.meta.env.PROD ? "wss://" : "ws://";

  let playerTime = 900;
  let opponentTime = 900;

  const getGameState = async () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ type: "reqState", }));
  };

  const updateState = (state: string, move: string) => {
    if (!gameStateRef.current)
      return;
    
    const gameState = gameStateRef.current;
    const newMoves = decodeState(gameStateRef, state);
    
    newMoves.forEach((item) => {
      gameState.state[item.x][item.y] = item.c;
      if (item.c === EMPTY_CELL) {
        return;
      }
      gameState.turn = !gameState.turn;
      setCurrentTurn(gameState.turn);
      showMoveStatus(move);
    });

    gameState.history.push(move);
    redrawCanvas(canvasRef, gameStateRef, ctxRef);
    updateHistory(gameState.history);
  }

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
            setCurrentTurn(gameState.turn);
            updateHistory(gameState.history);
            showMoveStatus("Pass");
          } else {
            updateState(msg.state, msg.move);
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
            `${pname} won` : `${opname} won`
        );
        socketRef.current?.close();
        break;

      case "sync":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          gameState.gameId = msg.gameId;
          gameState.color = msg.color;
          gameState.pname = msg.pname;
          gameState.opname = msg.opname;
          gameState.turn = msg.turn;
          
          setPname(gameState.pname)
          setOpname(gameState.opname)
          setCurrentTurn(gameState.turn);

          updateState(msg.state, "");
         
          // setting the turn here again, cuz updateState messes up with
          // turn as well
          gameState.turn = msg.turn;

          gameState.history = msg.history;
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
          redrawCanvas(canvasRef, gameStateRef, ctxRef);
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
    const response = await fetch(BACKEND_URL + "/getwsurl", {
      headers: { Authorization : token }
    });

    const json = await response.json();
    return json.wsurl || "";
  }

  const setupSocket = async () => {
    if (setupSocketRef.current) return;
    setupSocketRef.current = true;

    const wsurl = await getWsurl();
    socketRef.current = new WebSocket(
      `${wsWsPrefix}${wsurl}/spectate/${gameId}?token=${token}`
    );
    if (socketRef.current) {
      socketRef.current.onmessage = async (event: MessageEvent) => {
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
    redrawCanvas(canvasRef, gameStateRef, ctxRef);
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
    gameStateRef.current = {
      gameId: gameId || "",
      pname: "",
      opname: "",
      color: BLACK_CELL,
      state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
      turn: true,
      history: []
    };

    setCurrentTurn(gameStateRef.current.turn);
    setupSocket();
    getGameState();

    const resizeHandler = () => {
      redrawCanvas(canvasRef, gameStateRef, ctxRef);
    };

    window.addEventListener("resize", resizeHandler);
    redrawCanvas(canvasRef, gameStateRef, ctxRef);

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
              <HStack w={"200px"} spacing={3} alignItems="center" justifyContent="center">
                <Circle 
                  size="20px"
                  position={"absolute"}
                  left={"20px"}
                  bg={
                    1 - (gameStateRef.current?.color || 0) === BLACK_CELL ?
                    "#2D3748" : "#F7FAFC"
                  } 
                  border="2px solid" 
                  borderColor={
                    1 - (gameStateRef.current?.color || 0) === BLACK_CELL ?
                    "#4A5568" : "#E2E8F0"
                  }
                />
                <Text fontSize="xl" fontWeight="600" color="orange.200">{opname}</Text>
              </HStack>
              <Box 
                as="div" 
                ref={opponentClockRef} 
                fontSize="2xl" 
                fontWeight="700"
                bg={!currentTurn 
                  ? "linear-gradient(135deg, rgba(72, 187, 120, 0.3), rgba(56, 161, 105, 0.3))" 
                  : ""
                }
                px={4}
                py={2}
                rounded="xl"
                fontFamily="mono"
                border="2px solid"
                borderColor={!currentTurn ? "green.400" : "transparent"}
                textShadow={!currentTurn 
                  ? "0 0 10px rgba(72, 187, 120, 0.5)" 
                  : "0 0 10px rgba(246, 173, 85, 0.3)"
                }
                transition="all 0.3s ease"
              />
            </VStack>
            <VStack spacing={2} textAlign="center">
              <HStack spacing={3} alignItems="center" justifyContent="center">
                <Circle 
                  size="20px" 
                  position={"absolute"}
                  left={"20px"}
                  bg={gameStateRef.current?.color === BLACK_CELL ? "#2D3748" : "#F7FAFC"} 
                  border="2px solid" 
                  borderColor={gameStateRef.current?.color === BLACK_CELL ? "#4A5568" : "#E2E8F0"}
                />
                <Text fontSize="xl" fontWeight="600" color="orange.200">{pname}</Text>
              </HStack>
              <Box 
                as="div" 
                ref={playerClockRef} 
                fontSize="2xl" 
                fontWeight="700"
                bg={currentTurn 
                  ? "linear-gradient(135deg, rgba(72, 187, 120, 0.3), rgba(56, 161, 105, 0.3))" 
                  : ""
                }
                px={4}
                py={2}
                rounded="xl"
                fontFamily="mono"
                border="2px solid"
                borderColor={currentTurn ? "green.400" : "transparent"}
                textShadow={currentTurn 
                  ? "0 0 10px rgba(72, 187, 120, 0.5)" 
                  : "0 0 10px rgba(246, 173, 85, 0.3)"
                }
                transition="all 0.3s ease"
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
