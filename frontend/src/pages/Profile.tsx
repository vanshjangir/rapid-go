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
  const httpapi = import.meta.env.VITE_HTTP_URL;
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const token = localStorage.getItem('token') || "";
  const [textAreaVis, setTextAreaVis] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>("");

  const getData = async () => {
    try {
      const response = await fetch(httpapi + `/profile?username=${username}`, {
        method: "GET",
      });
      const data = await response.json();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data", error);
    }
  };

  const changeUsername = async () => {
    const response = await fetch(httpapi + `/changeusername`, {
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
      <Flex h="100vh" bg="#222222" flexDir="column" color="white">
        <Flex alignItems="center" justifyContent="center" h="100vh">
          Loading...
        </Flex>
      </Flex>
    );

  return (
    <Flex h="screen" bg="#222222" flexDir="column" color="white">
      <Navbar />
      <Box maxW="5xl" mx="auto" w="full" px={{ base: 4, sm: 6, lg: 8 }} mt="16">
        <Flex alignItems="center" gap="4" mb="6">
          <Box>
            <Flex>
              {textAreaVis === false ? (
                <>
                  <Heading as="h1" size="xl" fontWeight="bold">
                    {userData.name || username}
                  </Heading>
                  <Button
                    onClick={onButtonClick}
                    background={"#222222"}
                    _hover={"#222222"}
                  >
                    <Image src="/editpencil.png" width={"50px"} />
                  </Button>
                </>
              ) : (
                  <>
                    <Input
                      bg="#222222"
                      placeholder="username"
                      autoFocus
                      onChange={(e) => setNewUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") changeUsername();
                      }}
                    />
                    <Button
                      onClick={changeUsername}
                      borderColor="whiteAlpha.500" ml="2"
                      background={"#222222"}
                      _hover={"#222222"}
                    >
                      <Image src="/tick.png" w="50px" />
                    </Button>
                  </>
                )}
            </Flex>
            <Text fontSize={"2xl"} color="gray.300">Rating: {userData.rating}</Text>
          </Box>
        </Flex>

        <Box mb="6">
          <Heading as="h2" size="lg" fontWeight="semibold" mb="4">
            Statistics
          </Heading>
          <Grid
            templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }}
            gap="4"
          >
            <Box textAlign="center" color="black" bg="gray.100" p="4" rounded="lg">
              <Text display="block" fontSize="2xl" fontWeight="bold">
                {userData.gamesPlayed}
              </Text>
              <Text>Games Played</Text>
            </Box>
            <Box textAlign="center" color="black" bg="green.500" p="4" rounded="lg">
              <Text display="block" fontSize="2xl" fontWeight="bold">
                {userData.wins}
              </Text>
              <Text>Wins</Text>
            </Box>
            <Box textAlign="center" color="black" bg="red.500" p="4" rounded="lg">
              <Text display="block" fontSize="2xl" fontWeight="bold">
                {userData.losses}
              </Text>
              <Text>Losses</Text>
            </Box>
            <Box textAlign="center" color="black" bg="blue.400" p="4" rounded="lg">
              <Text display="block" fontSize="2xl" fontWeight="bold">
                {userData.highestRating}
              </Text>
              <Text>Highest Rating</Text>
            </Box>
          </Grid>
        </Box>

        <Box>
          <Heading as="h2" size="lg" fontWeight="semibold" mb="4">
            Recent Games
          </Heading>
          {userData.recentGames && userData.recentGames.length > 0 ? (
            <TableContainer>
              <Table variant="simple" colorScheme="whiteAlpha">
                <Thead>
                  <Tr>
                    <Th fontSize={"2xl"} color="white">Result</Th>
                    <Th fontSize={"2xl"} color="white">Opponent</Th>
                    <Th fontSize={"2xl"} color="white">Date</Th>
                    <Th fontSize={"2xl"} color="white" textAlign="center">Review</Th>
                  </Tr>
                </Thead>
                <Tbody fontSize={"xl"}>
                  {userData.recentGames.map((game, index) => (
                    <Tr key={index}>
                      <Td style={{color: game.result === "Lost" ? "#EF4444" : "#22C55E"}}>
                        {game.result}
                      </Td>
                      <Td>
                        <Link
                          href={"/profile/" + game.opponent}
                          _hover={{ textDecoration: "underline" }}
                        >
                          {game.opponent}
                        </Link>
                      </Td>
                      <Td>
                        {
                          new Date(game.date.split(" ")[0]).toLocaleDateString('en-US', {
                            day: 'numeric', month: 'short', year: 'numeric'
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
              <Text color="gray.600">No recent games played.</Text>
            )}
        </Box>
      </Box>
    </Flex>
  );
}

export default Profile;
