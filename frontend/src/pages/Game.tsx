import { useEffect, useRef } from "react";
import { useGlobalContext } from "../GlobalContext";
import { ChatMessage, MsgChat, MsgLose, MsgMove, MsgMoveStatus, MsgSync, MsgWin } from "../types/game";
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
  handleCanvasClick,
  handleResize,
  retainOldState,
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

  gameStateRef.current = {
    gameId: player.gameId,
    color: player.color,
    state: Array.from({ length: 19 }, () => Array(19).fill(EMPTY_CELL)),
    turn: player.color === 1 ? true : false,
    history: []
  };

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
            decodeState(msg.state, msg.move);
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
            decodeState(msg.state, msg.move);
          }
          playerTime = 900 - Math.round(msg.selfTime / 1000);
          opponentTime = 900 - Math.round(msg.opTime / 1000);
        }
        break;

      case "sync":
        if (gameStateRef.current) {
          const gameState = gameStateRef.current;
          console.log("Sycn State", msg);
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

      case "win":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage("You Won");
        destSocket();
        console.log("You Won!!");
        break;

      case "lose":
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        showEndMessage("You Lost");
        destSocket();
        console.log("You Lost :(");
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
      
      historyDivRef.current.scrollTop = historyDivRef.current.scrollHeight;
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
    setupClock();

    const clickHandler = (e: MouseEvent) => {
      handleCanvasClick(canvasRef, gameStateRef, ctxRef, socketRef, e);
    };
    const resizeHandler = () => {
      handleResize(canvasRef, gameStateRef, ctxRef);
    };

    canvasRef.current?.addEventListener("click", clickHandler);
    window.addEventListener("resize", resizeHandler);
    handleResize(canvasRef, gameStateRef, ctxRef);

    return () => {
      canvasRef.current?.removeEventListener("click", clickHandler);
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="#222222" overflowY="auto">
      <Navbar />
      <Flex id="game-container" w="100%" flexDirection={{ base: "column", lg: "row" }} alignItems="center" mt="8" justifyContent="center">
        <Box id="game-board" display="flex" flexDirection="column" alignItems="center">
          <canvas
            ref={canvasRef}
            id="canvas"
            className="bg-yellow-200"
            width={gridSize + 2 * cellSize}
            height={gridSize + 2 * cellSize}
          ></canvas>
          <HStack color="white" w="100%" justifyContent="space-between">
            <Box textAlign="center">
              <Text fontSize="xl" fontWeight="bold">Player</Text>
              <Box as="div" ref={playerClockRef} fontSize="lg"></Box>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xl" fontWeight="bold">Opponent</Text>
              <Box as="div" ref={opponentClockRef} fontSize="lg"></Box>
            </Box>
          </HStack>
        </Box>
        <Box id="game-stats" display="flex" flexDirection="column" ml={{ base: "0", lg: "2" }} color="white">
          <Box ref={msgRef} textAlign="center" fontSize="3xl" fontWeight="bold" h="40px"></Box>
          <HStack justifyContent="center" w="400px" p="2">
            <Button
              onClick={handlePass}
              bg="blue.500"
              borderLeftRadius="lg"
              p="2"
              w="150px"
              _hover={{ bg: "blue.600" }}
            >
              Pass
            </Button>
            <Button
              onClick={handleAbort}
              bg="red.500"
              borderRightRadius="lg"
              p="2"
              w="150px"
              _hover={{ bg: "red.600" }}
            >
              Abort
            </Button>
          </HStack>
          <VStack h="240px" w="400px" alignItems="center">
            <Box
              ref={historyDivRef}
              display="flex"
              flexDirection="column"
              overflowY="auto"
              h="100%"
              w="100%"
              bg="#181818"
              borderRadius="md"
              maxH="250px"
            ></Box>
          </VStack>
          <VStack h="300px" w="400px" pt={"10"} alignItems="center">
            <Box
              ref={chatRef}
              display="flex"
              flexDirection="column"
              overflowY="auto"
              h="240px"
              w="100%"
              bg="#181818"
              borderRadius="md"
              maxH="250px"
              p="10px"
            ></Box>
            <HStack w="100%" mt="2">
              <Input
                type="text"
                ref={inputRef}
                onChange={(e) => newMessage = e.target.value}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage() }}
                flex="1"
                p="2"
                bg="#282828"
                color="white"
                borderLeftRadius="lg"
                outline="none"
                placeholder="Type your message..."
              />
              <Button
                onClick={handleSendMessage}
                p="2"
                bg="blue.500"
                color="white"
                borderRightRadius="lg"
                _hover={{ bg: "blue.600" }}
              >
                Send
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Flex>
    </Box>
  );
};

export default Game;
