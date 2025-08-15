import { useEffect, useRef, useState } from "react";
import { useGlobalContext } from "../GlobalContext";
import { ChatMessage, MsgChat, MsgMove, MsgMoveStatus, MsgSync, MsgGameover } from "../types/game";
import { GameState } from "../types/game";
import Navbar from "../components/Navbar";
import {
  cellSize,
  gridSize,
  placeStone,
  EMPTY_CELL,
  handleCanvasClick,
  redrawCanvas,
  retainOldState,
  decodeState,
} from "../utils/board";
import {
  Box,
  Flex,
  Button,
  VStack,
  HStack,
  Text,
  Input
} from "@chakra-ui/react";

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
  const [pname, setPname] = useState<string>("");
  const [opname, setOpname] = useState<string>("");

  let playerTime = 900;
  let opponentTime = 900;
  let newMessage = "";

  const getGameState = async () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ type: "reqState", }));
  };

  const handlePass = () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.send(JSON.stringify({ type: "move", move: "ps" }));
  };

  const updateState = (state: string, move: string) => {
    if (!gameStateRef.current)
      return;
    
    const gameState = gameStateRef.current;
    const newMoves = decodeState(gameStateRef, state);
    
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
  }

  const handleAbort = () => {
    const socket = socketRef.current;
    if (socket) socket.send(JSON.stringify({type: "abort"}));
  };

  const handleSocketRecv = async (data: any) => {
    const msg: MsgMove | MsgMoveStatus | MsgSync | MsgGameover | MsgChat =
      await JSON.parse(data);
    switch (msg.type) {
      case "movestatus":
        if (msg.turnStatus === false) {
          showMoveStatus("Not your turn");
          retainOldState(canvasRef, ctxRef, gameStateRef, msg);
          break;
        }
        if (msg.moveStatus === false) {
          showMoveStatus("Invalid move");
          retainOldState(canvasRef, ctxRef, gameStateRef, msg);
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
            updateState(msg.state, msg.move);
          }
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
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
            updateState(msg.state, msg.move);
          }
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
        }
        break;

      case "sync":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          gameState.gameId = msg.gameId;
          gameState.color = msg.color;
          gameState.turn = msg.turn;
          gameState.pname = msg.pname;
          gameState.opname = msg.opname;

          updateState(msg.state, "");

          setPname(gameState.pname)
          setOpname(gameState.opname)

          gameState.history = msg.history;
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
          redrawCanvas(canvasRef, gameStateRef, ctxRef);
          setupClock();
          updateHistory(gameState.history);
        }
        break;

      case "gameover":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage(msg.winner === gameStateRef.current?.color ? "You won" : "You lost");
        destSocket();
        break;

      case "chat":
        messages.current = [
          ...messages.current,
          { type: 'received', text: msg.message.trim() }
        ];
        updateChat();
        break;
    }
  };

  const setupSocket = () => {
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

  const updateChat = () => {
    if (chatRef.current) {
      chatRef.current.innerHTML = "";
      messages.current.forEach((_, index) => {
        const textDiv = document.createElement("div");
        textDiv.className = "text-white flex flex-row w-full px-2 py-1 rounded-lg text-wrap break-all";
        textDiv.textContent = messages.current[index].text;
        
        if (messages.current[index].type === 'sent') {
          textDiv.style.color = '#f6ad55';
          textDiv.style.alignSelf = 'end';
        } else {
          textDiv.style.color = '#9ca3af';
          textDiv.style.alignSelf = 'start';
        }

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
      const socket = socketRef.current;
      if (!socket) return;

      messages.current = [
        ...messages.current, { type: 'sent', text: newMessage.trim() }
      ];
      socket.send(JSON.stringify({ type: "chat", message: newMessage.trim() }));
      newMessage = "";
      updateChat();
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
      gameId: player.gameId,
      pname: "",
      opname: "",
      color: player.color,
      state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
      turn: player.color === 1 ? true : false,
      history: []
    };

    setupSocket();
    getGameState();
    setupClock();

    const clickHandler = (e: MouseEvent) => {
      handleCanvasClick(canvasRef, gameStateRef, ctxRef, socketRef, e);
    };
    const resizeHandler = () => {
      redrawCanvas(canvasRef, gameStateRef, ctxRef);
    };

    canvasRef.current?.addEventListener("click", clickHandler);
    window.addEventListener("resize", resizeHandler);
    redrawCanvas(canvasRef, gameStateRef, ctxRef);

    return () => {
      canvasRef.current?.removeEventListener("click", clickHandler);
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
              <Text fontSize="xl" fontWeight="600" color="orange.200">{opname}</Text>
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
              <Text fontSize="xl" fontWeight="600" color="orange.200">{pname}</Text>
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

          <HStack 
            justifyContent="center" 
            w="100%" 
            spacing={3}
          >
            <Button
              onClick={handlePass}
              bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
              color="white"
              _hover={{ 
                bg: "linear-gradient(135deg, rgba(45, 55, 72, 0.9), rgba(74, 85, 104, 0.9))",
                transform: "translateY(-2px)",
                boxShadow: "0 8px 25px rgba(246, 173, 85, 0.3)"
              }}
              rounded="xl"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="600"
              flex="1"
              transition="all 0.3s ease"
              border="2px solid"
              borderColor="orange.400"
            >
              Pass
            </Button>
            <Button
              onClick={handleAbort}
              bg="linear-gradient(135deg, #dc2626, #b91c1c)"
              color="white"
              _hover={{ 
                bg: "linear-gradient(135deg, #b91c1c, #991b1b)",
                transform: "translateY(-2px)",
                boxShadow: "0 8px 25px rgba(220, 38, 38, 0.4)"
              }}
              rounded="xl"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="600"
              flex="1"
              transition="all 0.3s ease"
              border="2px solid"
              borderColor="red.400"
            >
              Abort
            </Button>
          </HStack>

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
                Chat
              </Text>
              <Box
                ref={chatRef}
                display="flex"
                flexDirection="column"
                overflowY="auto"
                h="200px"
                w="100%"
                bg="linear-gradient(135deg, rgba(26, 32, 44, 0.5), rgba(45, 55, 72, 0.5))"
                borderRadius="xl"
                p={3}
                mb={3}
                border="1px solid"
                borderColor="whiteAlpha.200"
              />
              <HStack w="100%" spacing={3}>
                <Input
                  type="text"
                  ref={inputRef}
                  onChange={(e) => newMessage = e.target.value}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage() }}
                  flex="1"
                  bg="linear-gradient(135deg, rgba(26, 32, 44, 0.8), rgba(45, 55, 72, 0.8))"
                  color="white"
                  border="2px solid"
                  borderColor="whiteAlpha.300"
                  _focus={{
                    borderColor: "orange.400",
                    boxShadow: "0 0 0 1px #ed8936, 0 0 20px rgba(237, 137, 54, 0.3)"
                  }}
                  rounded="xl"
                  px={4}
                  py={3}
                  placeholder="Type your message..."
                  _placeholder={{ color: "gray.400" }}
                />
                <Button
                  onClick={handleSendMessage}
                  bg="linear-gradient(135deg, #f6ad55, #ed8936)"
                  color="white"
                  _hover={{ 
                    bg: "linear-gradient(135deg, #ed8936, #dd6b20)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 25px rgba(246, 173, 85, 0.4)"
                  }}
                  rounded="xl"
                  px={6}
                  py={3}
                  fontWeight="600"
                  transition="all 0.3s ease"
                  border="2px solid"
                  borderColor="orange.400"
                >
                  Send
                </Button>
              </HStack>
            </Box>
          </VStack>
        </VStack>
      </Flex>
    </Box>
  );
};

export default Game;
