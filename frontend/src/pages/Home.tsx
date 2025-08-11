import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";
import Navbar from "../components/Navbar";
import { PlayButton, ReconnectButton } from "../components/Buttons"
import { Flex, Box, Text, Image, VStack } from "@chakra-ui/react";

const TOKEN_TYPE_GUEST = "3";

const Home = () => {
  const nav = useNavigate();
  const { connect, player, getSocket, destSocket } = useGlobalContext();
  const [matchStatus, setMatchStatus] = useState("");
  const [recon, setRecon] = useState(false);
  const token = localStorage.getItem("token") || "";
  const httpapi = import.meta.env.VITE_HTTP_URL

  const getWsurl = async (authtoken: string) => {
    const response = await fetch(httpapi + "/getwsurl", {
      headers: { Authorization : authtoken }
    });

    const json = await response.json();
    return json.wsurl || "";
  }

  const play = async (how: string) => {
    const authtoken = token || TOKEN_TYPE_GUEST;
    if (how === "bot") {
      const wsurl = await getWsurl(authtoken);
      connectToGame("ws://" + wsurl, authtoken, how);
    } else {
      findGame(authtoken, how);
    }
  }

  const connectToGame = (wsurl: string, token: string, how: string) => {
    const uri = (how === "bot" ? "/againstbot" : "/game")
      + "?type=new&token=" + token;
    
    const socket = connect(wsurl + uri);
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

  const findGame = async (token: string, how: string) => {
    setMatchStatus("Finding game ...");
    const response = await fetch(httpapi + "/findgame", {
      headers: {
        "Authorization": token,
      },
    });
    const json = await response.json();
    if (response.status === 200) {
      const wsurl = json.wsurl;
      localStorage.setItem('wsurl', wsurl);
      connectToGame("ws://" + wsurl, token, how);
    } else {
      console.log(`Error occured while finding a game ${json}`);
    }
  };

  const reconnect = async () => {
    const wsurl = localStorage.getItem('wsurl');
    if (!wsurl) return;

    if (getSocket()) {
      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/game/${player.gameId}`)) {
        nav(`/game/${player.gameId}`);
      }
      return;
    }

    const rectype = localStorage.getItem("rectype") || "player" ;
    const gameType = (rectype === "player" ? "game" : "againstbot");
    const socket = connect(
      `ws://${wsurl}/${gameType}?type=reconnect&token=${token}`
    );

    socket.onmessage = async (event: MessageEvent) => {
      const json: MsgStart = await JSON.parse(event.data);
      player.color = json.color;
      player.gameId = json.gameId;

      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/game/${json.gameId}`)) {
        nav(`/game/${json.gameId}`);
      }
    };
  };

  const checkOngoing = async () => {
    const username = localStorage.getItem("username");
    if (!username) return;

    const wsurl = localStorage.getItem('wsurl');
    if (!wsurl) return;

    const response = await fetch("http://" + wsurl + `/ispending?username=${username}`, {
      method: "GET",
      headers: {
        "Authorization": token,
      },
    });

    if (response.status === 200) {
      const json:{status: string}  = await response.json();
      if (json.status === "present") {
        setRecon(true);
      } else {
        setRecon(false);
      }
    }
  }
  

  useEffect(() => {
    destSocket();
    checkOngoing();
  }, []);

  return (
    <Flex h="100vh" bg="#222222" direction="column" color="white">
      <Navbar />
      <Flex
        direction={{ base: "column", lg: "row" }}
        w="full"
        justify="center"
        align="center"
      >
        <Box
          display={{ base: "none", lg: "inline-flex" }}
          pt={{ lg: "200px" }}
          mr={8}
        >
          <Image src="/boardbg.png" boxShadow="lg" w="464px" rounded="md" />
        </Box>
        <VStack spacing={8} pt={"266px"} align="center">
          <Text fontSize="5xl" fontWeight="bold">Online Go!</Text>
          {matchStatus === "pending" ? (
            <Text fontSize="lg">Finding an opponent...</Text>
          ) : (
              <Text fontSize="lg">
                {token ? "Ready to start a game!" : "Login or play as guest"}
              </Text>
            )}
          <PlayButton
            label={token ? "Play" : "Play as Guest"}
            gametype="player"
            handler={play}
          />
          <PlayButton
            label="Against Bot"
            gametype="bot"
            handler={play}
          />
          {recon === true && <ReconnectButton handler={reconnect} />}
        </VStack>
      </Flex>
    </Flex>
  );
};

export default Home;
