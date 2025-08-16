import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";
import Navbar from "../components/Navbar";
import { PlayButton } from "../components/Buttons"
import { Flex, Box, Text, Image, VStack, HStack, Container } from "@chakra-ui/react";

const Home = () => {
  const nav = useNavigate();
  const { connect, player, destSocket } = useGlobalContext();
  const [matchStatus, setMatchStatus] = useState("");
  const token = localStorage.getItem("token") || "";
  const BACKEND_URL = import.meta.env.PROD ?
    import.meta.env.VITE_HTTPS_URL :
    import.meta.env.VITE_HTTP_URL;
  const wsWsPrefix = import.meta.env.PROD ? "wss://" : "ws://";

  const getWsurl = async () => {
    const response = await fetch(BACKEND_URL + "/getwsurl", {
      headers: { Authorization : token }
    });

    const json = await response.json();
    return json.wsurl || "";
  }

  const play = async (how: string) => {
    if (how === "bot") {
      const wsurl = await getWsurl();
      localStorage.setItem('wsurl', wsurl);
      connectToGame(`${wsWsPrefix}${wsurl}`, how);
    } else {
      findGame(how);
    }
  }

  const connectToGame = (wsurl: string, how: string) => {
    const params = (how === "bot" ? "/againstbot" : "/game") +
      "?type=new&token=" + token;
    
    const socket = connect(wsurl + params);
    localStorage.setItem("rectype", how);

    socket.onmessage = async (event: MessageEvent) => {
      const json: MsgStart = await JSON.parse(event.data);
      player.color = json.color;
      player.gameId = json.gameId;

      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/game/${json.gameId}`)) {
        nav(`/game/${json.gameId}`);
      }
    };
  }

  const findGame = async (how: string) => {
    setMatchStatus("pending");
    const response = await fetch(BACKEND_URL + "/findgame", {
      headers: {
        "Authorization": token,
      },
    });
    const json = await response.json();
    if (response.status === 200) {
      const wsurl = json.wsurl;
      localStorage.setItem('wsurl', wsurl);
      connectToGame(`${wsWsPrefix}${wsurl}`, how);
    } else {
    setMatchStatus("");
      console.log(`Error occured while finding a game ${json}`);
    }
  };
  
  useEffect(() => {
    destSocket();
  }, []);

  return (
    <Flex 
      minH="100vh" 
      bg="linear-gradient(135deg, #1a202c 0%, #2d3748 25%, #4a5568 50%, #2d3748 75%, #1a202c 100%)"
      direction="column" 
      color="white"
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
      <Container maxW="1300px" flex="1" mt={"160px"} py={6}>
        <HStack 
          justifyContent="center" 
          spacing={{ base: 0, lg: 4 }} 
          alignItems="center" 
          w="full" 
          h="full"
        >
          {/* Board Section */}
          <Box display={{ base: "none", lg: "block" }}
            h={{ base: "auto", lg: "542px" }} 
            w={{ base: "auto", lg: "542px" }} 
          >
            <Box position="relative">
              <Image 
                src="/boardbg.png" 
                boxShadow="0 20px 40px rgba(0, 0, 0, 0.4)" 
                w="542px"
                h="542px"
                rounded="xl"
                transition="all 0.3s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)"
                }}
              />
            </Box>
          </Box>

          {/* Game Options Section */}
          <VStack 
            spacing={8} 
            align="center" 
            justify="center" 
            h={{ base: "auto", lg: "542px" }} 
            w={{ base: "auto", lg: "542px" }} 
          >
            {/* Title Section */}
            <VStack w={"full"} spacing={4} textAlign="center">
              <Box position="relative">
                <Text 
                  fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }} 
                  fontWeight="900"
                  bgGradient="linear(to-r, #f6ad55, #ed8936, #dd6b20)"
                  bgClip="text"
                  letterSpacing="tight"
                  textShadow="0 0 20px rgba(237, 137, 54, 0.3)"
                  mb={2}
                >
                  Online Go
                </Text>
                <Box
                  position="absolute"
                  bottom="-8px"
                  left="50%"
                  transform="translateX(-50%)"
                  w="80px"
                  h="4px"
                  bg="linear-gradient(90deg, #f6ad55, #ed8936)"
                  rounded="full"
                />
              </Box>
            </VStack>

            {/* Quick Stats */}
            <HStack 
              spacing={6} 
              pt={4}
              divider={
                <Box w="1px" h="30px" bg="whiteAlpha.300" />
              }
            >
              <VStack spacing={1}>
                <Text fontSize="xl" fontWeight="bold" color="orange.300">
                  24/7
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Online
                </Text>
              </VStack>
              <VStack spacing={1}>
                <Text fontSize="xl" fontWeight="bold" color="blue.300">
                  Fast
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Matchmaking
                </Text>
              </VStack>
              <VStack spacing={1}>
                <Text fontSize="xl" fontWeight="bold" color="green.300">
                  Free
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Forever
                </Text>
              </VStack>
            </HStack>

            {/* Status Box */}
            <Box
              bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
              backdropFilter="blur(12px)"
              rounded="2xl"
              p={4}
              border="2px solid"
              borderColor="whiteAlpha.200"
              boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
              w="full"
            >
              {/* Gradient overlay */}
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bg="linear-gradient(90deg, #f6ad55, #ed8936, #dd6b20, #c05621)"
              />

              {matchStatus === "pending" ? (
                <VStack spacing={4}>
                  <HStack spacing={2} justify="center">
                    <Box
                      w="12px"
                      h="12px"
                      bg="orange.400"
                      borderRadius="full"
                    />
                    <Box
                      w="12px"
                      h="12px"
                      bg="orange.300"
                      borderRadius="full"
                    />
                    <Box
                      w="12px"
                      h="12px"
                      bg="orange.200"
                      borderRadius="full"
                    />
                  </HStack>
                  <Text 
                    fontSize="xl" 
                    color="orange.200"
                    fontWeight="600"
                    textAlign="center"
                  >
                    Finding worthy opponent...
                  </Text>
                </VStack>
              ) : (
                  <VStack spacing={3}>
                    <Box
                      w="8px"
                      h="8px"
                      bg="green.400"
                      borderRadius="full"
                      boxShadow="0 0 10px rgba(72, 187, 120, 0.6)"
                    />
                    <Text 
                      fontSize="lg"
                      color="gray.200"
                      fontWeight="600"
                      textAlign="center"
                    >
                      {token ? "Ready for battle!" : "Log In to Play"}
                    </Text>
                  </VStack>
                )}
            </Box>

            {/* Game Buttons */}
            <VStack spacing={4} w="full">
              <PlayButton
                label={"Play Online"}
                gametype="player"
                handler={play}
              />
              <PlayButton
                label="Against Bot"
                gametype="bot"
                handler={play}
              />
            </VStack>
          </VStack>
        </HStack>
      </Container>
    </Flex>
  );
};

export default Home;
