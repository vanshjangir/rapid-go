import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserProfileData } from "../types/game";
import Navbar from "../components/Navbar";
import {
  Flex,
  Box,
  Heading,
  Button,
  Input,
  Image,
  Text,
  Grid,
  TableContainer,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Link,
} from "@chakra-ui/react"

const Profile = () => {
  const nav = useNavigate();
  const { username } = useParams();
  const BACKEND_URL = import.meta.env.PROD ?
    import.meta.env.VITE_HTTPS_URL :
    import.meta.env.VITE_HTTP_URL;
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const token = localStorage.getItem('token') || "";
  const [textAreaVis, setTextAreaVis] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");

  const getData = async () => {
    try {
      const response = await fetch(BACKEND_URL + `/profile?username=${username}`, {
        method: "GET",
      });
      const data = await response.json();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data", error);
    }
  };

  const changeUsername = async () => {
    const response = await fetch(BACKEND_URL + `/changeusername`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
      body: JSON.stringify({
        "username": username,
        "newusername": newUsername,
      }),
    });

    if(response.status === 200){
      localStorage.setItem('username', newUsername);
    }
    setTextAreaVis(false)
  }

  const onButtonClick = () => {
    setTextAreaVis(true);
  }

  useEffect(() => {
    getData();
  }, []);

if (!userData)
    return (
      <Flex 
        h="100vh" 
        bg="linear-gradient(135deg, #1a202c 0%, #2d3748 25%, #4a5568 50%, #2d3748 75%, #1a202c 100%)"
        flexDir="column" 
        color="white"
        position="relative"
        overflow="hidden"
      >
        {/* Background pattern for loading */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          opacity="0.05"
          backgroundImage="radial-gradient(circle at 25% 25%, #f6ad55 0%, transparent 50%), radial-gradient(circle at 75% 75%, #ed8936 0%, transparent 50%)"
          backgroundSize="100px 100px"
        />
        
        <Flex alignItems="center" justifyContent="center" h="100vh">
          <Box textAlign="center">
            <Box
              w="60px"
              h="60px"
              border="4px solid transparent"
              borderTopColor="#f6ad55"
              borderRadius="full"
              animation="spin 1s linear infinite"
              mx="auto"
              mb={4}
            />
            <Text 
              fontSize="xl" 
              fontWeight="600"
              bgGradient="linear(to-r, #f6ad55, #ed8936)"
              bgClip="text"
            >
              Loading...
            </Text>
          </Box>
        </Flex>
      </Flex>
    );

  return (
    <Flex 
      minH="100vh" 
      bg="linear-gradient(135deg, #1a202c 0%, #2d3748 25%, #4a5568 50%, #2d3748 75%, #1a202c 100%)"
      flexDir="column" 
      color="white"
      position="relative"
      overflow="hidden"
    >
      <Navbar />
      <Box 
        maxW="7xl" 
        mx="auto" 
        w="full" 
        px={{ base: 4, sm: 6, lg: 8 }} 
        py={8}
        position="relative"
        zIndex={1}
      >
        {/* Profile Header */}
        <Box
          bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
          backdropFilter="blur(20px)"
          rounded="3xl"
          p={{ base: 6, md: 8 }}
          border="2px solid"
          borderColor="whiteAlpha.200"
          boxShadow="0 25px 50px rgba(0, 0, 0, 0.4)"
          mb={8}
          position="relative"
          overflow="hidden"
        >
          {/* Gradient accent line */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            h="4px"
            bg="linear-gradient(90deg, #f6ad55, #ed8936, #dd6b20, #c05621)"
          />
          
          <Flex alignItems="center" gap="6" mb="8">
            <Box>
              <Flex alignItems="center" gap={4}>
                {textAreaVis === false ? (
                  <>
                    <Heading 
                      as="h1" 
                      size="2xl" 
                      fontWeight="900"
                      bgGradient="linear(to-r, #f6ad55, #ed8936, #dd6b20)"
                      bgClip="text"
                      textShadow="0 0 20px rgba(237, 137, 54, 0.3)"
                    >
                      {userData.name || username}
                    </Heading>
                    <Button
                      onClick={onButtonClick}
                      bg="linear-gradient(135deg, rgba(246, 173, 85, 0.2), rgba(237, 137, 54, 0.2))"
                      _hover={{
                        bg: "linear-gradient(135deg, rgba(246, 173, 85, 0.3), rgba(237, 137, 54, 0.3))",
                        transform: "scale(1.1)",
                        boxShadow: "0 8px 25px rgba(246, 173, 85, 0.25)"
                      }}
                      rounded="xl"
                      p={3}
                      transition="all 0.3s ease"
                      border="2px solid"
                      borderColor="whiteAlpha.300"
                    >
                      <Image src="/editpencil.png" width={"24px"} />
                    </Button>
                  </>
                ) : (
                    <>
                      <Input
                        bg="linear-gradient(135deg, rgba(26, 32, 44, 0.8), rgba(45, 55, 72, 0.8))"
                        border="2px solid"
                        borderColor="whiteAlpha.300"
                        _focus={{
                          borderColor: "orange.400",
                          boxShadow: "0 0 0 1px #ed8936, 0 0 20px rgba(237, 137, 54, 0.3)"
                        }}
                        placeholder="username"
                        autoFocus
                        onChange={(e) => setNewUsername(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") changeUsername();
                        }}
                        rounded="xl"
                        fontSize="lg"
                        py={3}
                        color="white"
                        _placeholder={{ color: "gray.400" }}
                      />
                      <Button
                        onClick={changeUsername}
                        bg="linear-gradient(135deg, #22c55e, #16a34a)"
                        _hover={{
                          bg: "linear-gradient(135deg, #16a34a, #15803d)",
                          transform: "scale(1.1)",
                          boxShadow: "0 8px 25px rgba(34, 197, 94, 0.4)"
                        }}
                        ml="3"
                        rounded="xl"
                        p={3}
                        transition="all 0.3s ease"
                        border="2px solid"
                        borderColor="green.400"
                      >
                        <Image src="/tick.png" w="24px" />
                      </Button>
                    </>
                  )}
              </Flex>
              <Text 
                fontSize={"2xl"} 
                color="orange.200"
                fontWeight="600"
                mt={3}
              >
                Rating: {userData.rating}
              </Text>
            </Box>
          </Flex>
        </Box>

        {/* Statistics Section */}
        <Box mb="8">
          <Heading 
            as="h2" 
            size="xl" 
            fontWeight="900" 
            mb="6"
            bgGradient="linear(to-r, #f6ad55, #ed8936, #dd6b20)"
            bgClip="text"
            textShadow="0 0 20px rgba(237, 137, 54, 0.3)"
          >
            Statistics
          </Heading>
          <Grid
            templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }}
            gap="6"
          >
            <Box 
              textAlign="center" 
              bg="linear-gradient(135deg, rgba(26, 32, 44, 0.8), rgba(45, 55, 72, 0.8))"
              backdropFilter="blur(12px)"
              p="6" 
              rounded="2xl"
              border="2px solid"
              borderColor="whiteAlpha.200"
              transition="all 0.3s ease"
              _hover={{
                transform: "translateY(-5px)",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                borderColor: "whiteAlpha.300"
              }}
            >
              <Text display="block" fontSize="3xl" fontWeight="900" color="white">
                {userData.gamesPlayed}
              </Text>
              <Text color="gray.300" fontWeight="600">Games Played</Text>
            </Box>
            <Box 
              textAlign="center" 
              bg="linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.2))" 
              backdropFilter="blur(12px)"
              p="6" 
              rounded="2xl"
              border="2px solid"
              borderColor="green.400"
              transition="all 0.3s ease"
              _hover={{
                transform: "translateY(-5px)",
                boxShadow: "0 20px 40px rgba(34, 197, 94, 0.3)"
              }}
            >
              <Text display="block" fontSize="3xl" fontWeight="900" color="white">
                {userData.wins}
              </Text>
              <Text color="green.200" fontWeight="600">Wins</Text>
            </Box>
            <Box 
              textAlign="center" 
              bg="linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))" 
              backdropFilter="blur(12px)"
              p="6" 
              rounded="2xl"
              border="2px solid"
              borderColor="red.400"
              transition="all 0.3s ease"
              _hover={{
                transform: "translateY(-5px)",
                boxShadow: "0 20px 40px rgba(239, 68, 68, 0.3)"
              }}
            >
              <Text display="block" fontSize="3xl" fontWeight="900" color="white">
                {userData.losses}
              </Text>
              <Text color="red.200" fontWeight="600">Losses</Text>
            </Box>
            <Box 
              textAlign="center" 
              bg="linear-gradient(135deg, rgba(246, 173, 85, 0.2), rgba(237, 137, 54, 0.2))" 
              backdropFilter="blur(12px)"
              p="6" 
              rounded="2xl"
              border="2px solid"
              borderColor="orange.400"
              transition="all 0.3s ease"
              _hover={{
                transform: "translateY(-5px)",
                boxShadow: "0 20px 40px rgba(246, 173, 85, 0.4)"
              }}
            >
              <Text display="block" fontSize="3xl" fontWeight="900" color="white">
                {userData.highestRating}
              </Text>
              <Text color="orange.200" fontWeight="600">Highest Rating</Text>
            </Box>
          </Grid>
        </Box>

        {/* Recent Games Section */}
        <Box
          bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
          backdropFilter="blur(20px)"
          rounded="3xl"
          p={{ base: 6, md: 8 }}
          border="2px solid"
          borderColor="whiteAlpha.200"
          boxShadow="0 25px 50px rgba(0, 0, 0, 0.4)"
          position="relative"
          overflow="hidden"
        >
          {/* Gradient accent line */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            h="4px"
            bg="linear-gradient(90deg, #f6ad55, #ed8936, #dd6b20, #c05621)"
          />
          
          <Heading 
            as="h2" 
            size="xl" 
            fontWeight="900" 
            mb="6"
            bgGradient="linear(to-r, #f6ad55, #ed8936, #dd6b20)"
            bgClip="text"
            textShadow="0 0 20px rgba(237, 137, 54, 0.3)"
          >
            Recent Games
          </Heading>
          {userData.recentGames && userData.recentGames.length > 0 ? (
            <TableContainer>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th 
                      fontSize={"xl"} 
                      color="orange.200" 
                      fontWeight="700"
                      textTransform="none"
                      letterSpacing="normal"
                    >
                      Result
                    </Th>
                    <Th 
                      fontSize={"xl"} 
                      color="orange.200" 
                      fontWeight="700"
                      textTransform="none"
                      letterSpacing="normal"
                    >
                      Opponent
                    </Th>
                    <Th 
                      fontSize={"xl"} 
                      color="orange.200" 
                      fontWeight="700"
                      textTransform="none"
                      letterSpacing="normal"
                    >
                      Date
                    </Th>
                    <Th 
                      fontSize={"xl"} 
                      color="orange.200" 
                      textAlign="center"
                      fontWeight="700"
                      textTransform="none"
                      letterSpacing="normal"
                    >
                      Review
                    </Th>
                  </Tr>
                </Thead>
                <Tbody fontSize={"lg"}>
                  {userData.recentGames.map((game, index) => (
                    <Tr 
                      key={index}
                      _hover={{
                        bg: "whiteAlpha.100",
                      }}
                      transition="all 0.2s ease"
                    >
                      <Td 
                        style={{
                          color: game.result === "Lost" ? "#ef4444" : "#22c55e",
                          fontWeight: "600"
                        }}
                      >
                        {game.result}
                      </Td>
                      <Td>
                        <Link
                          href={"/profile/" + game.opponent}
                          color="orange.200"
                          _hover={{ 
                            textDecoration: "none",
                            color: "orange.100",
                            transform: "translateX(4px)"
                          }}
                          fontWeight="500"
                          transition="all 0.2s ease"
                        >
                          {game.opponent}
                        </Link>
                      </Td>
                      <Td color="gray.300" fontWeight="500">
                        {
                          new Date(game.created_at.split(" ")[0])
                          .toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }).replace(/(\d+)/, (day: any) => {
                            const s = ["th", "st", "nd", "rd"];
                            const v = day % 100;
                            return day + (s[(v - 20) % 10] || s[v] || s[0]);
                          })
                        }
                      </Td>
                      <Td textAlign="center">
                        <Button
                          onClick={() => {
                            nav(`/review/${game.gameid}`);
                          }}
                          size="sm"
                          bg="linear-gradient(135deg, #f6ad55, #ed8936)"
                          color="white"
                          _hover={{ 
                            bg: "linear-gradient(135deg, #ed8936, #dd6b20)",
                            transform: "translateY(-2px)",
                            boxShadow: "0 8px 25px rgba(246, 173, 85, 0.4)"
                          }}
                          rounded="lg"
                          px={4}
                          py={2}
                          fontWeight="600"
                          transition="all 0.3s ease"
                          border="1px solid"
                          borderColor="orange.400"
                        >
                          Review
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          ) : (
              <Text 
                color="gray.400" 
                fontSize="lg" 
                textAlign="center"
                py={8}
                fontWeight="500"
              >
                No recent games played.
              </Text>
            )}
        </Box>
      </Box>
    </Flex>
  );
}

export default Profile;
