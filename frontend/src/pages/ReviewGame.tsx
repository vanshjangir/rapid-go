import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { GameState } from "../types/game";
import {
  cellSize,
  gridSize,
  EMPTY_CELL,
  redrawCanvas,
  BLACK_CELL,
  WHITE_CELL,
} from "../utils/board";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Button,
} from "@chakra-ui/react";

const ReviewGame = () => {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const historyDivRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [black, setBlack] = useState<string>("black");
  const [white, setWhite] = useState<string>("white");
  const [winner, setWinner] = useState<number>(-1);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const { gameId } = useParams();

  const fetchGame = async () => {
    const BACKEND_URL = import.meta.env.PROD ?
      import.meta.env.VITE_HTTPS_URL :
      import.meta.env.VITE_HTTP_URL;
    const token = localStorage.getItem('token') || "";
    const response = await fetch(`${BACKEND_URL}/review?gameid=${gameId}`, {
      headers: {
        "Authorization": token
      }
    });

    const json = await response.json();
    const gameMoves = json.moves.split("/").filter((move: string) => move.length > 0);
    setMoves(gameMoves);
    setBlack(json.black);
    setWhite(json.white);
    setWinner(json.winner);
    
    gameStateRef.current = {
      gameId: gameId || "",
      pname: "",
      opname: "",
      color: BLACK_CELL,
      state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
      turn: true,
      history: []
    };

    setCurrentMoveIndex(gameMoves.length);
  }

  const toShow = (move: string) => {
    if (move) {
      return move === "ps" ? "Pass" :
        move[0].toUpperCase() + String(Number(move.slice(1)) + 1);
    }
    return "";
  };

  const playMovesToIndex = (targetIndex: number) => {
    if (!gameStateRef.current) return;

    gameStateRef.current.state = Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL));
    gameStateRef.current.turn = true;
    gameStateRef.current.history = [];

    for (let i = 0; i < targetIndex && i < moves.length; i++) {
      const move = moves[i];
      
      if (move === "ps") {
        gameStateRef.current.history.push(move);
        gameStateRef.current.turn = !gameStateRef.current.turn;
      } else {
        const col = move.charCodeAt(0) - 97;
        const row = parseInt(move.slice(1));
        
        if (col >= 0 && col < 19 && row >= 0 && row < 19) {
          const stoneColor = gameStateRef.current.turn ? BLACK_CELL : WHITE_CELL;
          gameStateRef.current.state[col][row] = stoneColor;
          gameStateRef.current.history.push(move);
          gameStateRef.current.turn = !gameStateRef.current.turn;
        }
      }
    }

    redrawCanvas(canvasRef, gameStateRef, ctxRef);
    updateHistory(gameStateRef.current.history, targetIndex);
    updateStatusMessage(targetIndex);
  };

  const updateStatusMessage = (moveIndex: number) => {
    if (!msgRef.current) return;

    if (moveIndex === 0) {
      msgRef.current.innerText = "Start of Game";
    } else if (moveIndex >= moves.length) {
      if (winner === 0) {
        msgRef.current.innerText = `${black} won`;
      } else if (winner === 1) {
        msgRef.current.innerText = `${white} won`;
      } else {
        msgRef.current.innerText = "Game Over";
      }
    } else {
      const lastMove = moves[moveIndex - 1];
      const moveDisplay = toShow(lastMove);
      const playerName = (moveIndex - 1) % 2 === 0 ? black : white;
      msgRef.current.innerText = `${playerName}: ${moveDisplay}`;
    }
  };
  
  const updateHistory = (_history: string[], currentIndex: number) => {
    if (!historyDivRef.current) return;

    historyDivRef.current.innerHTML = "";
    
    for (let index = 0; index < moves.length; index += 2) {
      const rowDiv = document.createElement("div");
      rowDiv.className = "text-white flex flex-row w-full";

      const firstMove = document.createElement("div");
      const isFirstMoveActive = index < currentIndex;
      const isFirstMoveCurrent = index === currentIndex - 1;
      
      firstMove.className = `w-[50%] text-center p-2 cursor-pointer transition-all duration-200 ${
        isFirstMoveCurrent 
          ? "bg-orange-500 text-white font-bold" 
          : isFirstMoveActive 
            ? "bg-[#2d3748] hover:bg-[#4a5568]" 
            : "bg-gray-600 text-gray-400"
      }`;
      firstMove.textContent = `${Math.floor(index / 2) + 1}. ${toShow(moves[index])}`;
      firstMove.addEventListener("click", () => {
        setCurrentMoveIndex(index + 1);
      });

      const secondMove = document.createElement("div");
      const hasSecondMove = index + 1 < moves.length;
      
      if (hasSecondMove) {
        const isSecondMoveActive = index + 1 < currentIndex;
        const isSecondMoveCurrent = index + 1 === currentIndex - 1;
        
        secondMove.className = `w-[50%] text-center p-2 cursor-pointer transition-all duration-200 ${
          isSecondMoveCurrent 
            ? "bg-orange-500 text-white font-bold" 
            : isSecondMoveActive 
              ? "bg-[#4a5568] hover:bg-[#2d3748]" 
              : "bg-gray-600 text-gray-400"
        }`;
        secondMove.textContent = toShow(moves[index + 1]);
        secondMove.addEventListener("click", () => {
          setCurrentMoveIndex(index + 2);
        });
      } else {
        secondMove.className = "w-[50%] text-center p-2 bg-[#4a5568]";
        secondMove.textContent = "";
      }

      rowDiv.appendChild(firstMove);
      rowDiv.appendChild(secondMove);
      historyDivRef.current.appendChild(rowDiv);
    }
    
    if (currentIndex > 0) {
      const currentRow = Math.floor((currentIndex - 1) / 2);
      const rowElements = historyDivRef.current.children;
      if (rowElements[currentRow]) {
        rowElements[currentRow].scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
      }
    }
  };

  const goToStart = () => {
    setCurrentMoveIndex(0);
  };

  const goToEnd = () => {
    setCurrentMoveIndex(moves.length);
  };

  const goToPrevious = () => {
    if (currentMoveIndex > 0) {
      setCurrentMoveIndex(currentMoveIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentMoveIndex < moves.length) {
      setCurrentMoveIndex(currentMoveIndex + 1);
    }
  };

  useEffect(() => {
    fetchGame();
  }, []);
  
  useEffect(() => {
    redrawCanvas(canvasRef, gameStateRef, ctxRef);
  }, []);
  
  useEffect(() => {
    const resizeHandler = () => {
      redrawCanvas(canvasRef, gameStateRef, ctxRef);
    };

    window.addEventListener("resize", resizeHandler);
    redrawCanvas(canvasRef, gameStateRef, ctxRef);

    return () => {
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  useEffect(() => {
    if (moves.length > 0) {
      playMovesToIndex(currentMoveIndex);
    }
  }, [currentMoveIndex, moves]);

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
          <HStack w="100%" spacing={3}>
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
                <Text fontSize="xl" fontWeight="600" color="orange.200">{white}</Text>
              </VStack>
              <VStack spacing={2} textAlign="center">
                <Text fontSize="xl" fontWeight="600" color="orange.200">{black}</Text>
              </VStack>
            </VStack>
          </HStack>
          
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

          {/* Navigation Controls */}
          <HStack spacing={2} w="100%">
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={goToStart}
              disabled={currentMoveIndex === 0}
              flex={1}
            >
              Start
            </Button>
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={goToPrevious}
              disabled={currentMoveIndex === 0}
              flex={1}
            >
              Prev
            </Button>
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={goToNext}
              disabled={currentMoveIndex >= moves.length}
              flex={1}
            >
              Next
            </Button>
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={goToEnd}
              disabled={currentMoveIndex >= moves.length}
              flex={1}
            >
              End
            </Button>
          </HStack>

          {/* Move Counter */}
          <Box
            bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
            backdropFilter="blur(12px)"
            rounded="xl"
            border="2px solid"
            borderColor="whiteAlpha.200"
            boxShadow="0 10px 20px rgba(0, 0, 0, 0.4)"
            p={3}
            w="100%"
            textAlign="center"
          >
            <Text fontSize="lg" fontWeight="600" color="orange.200">
              Move {currentMoveIndex} of {moves.length}
            </Text>
          </Box>

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
                Game History (Click to navigate)
              </Text>
              <Box
                ref={historyDivRef}
                display="flex"
                flexDirection="column"
                overflowY="auto"
                h="300px"
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

export default ReviewGame;
