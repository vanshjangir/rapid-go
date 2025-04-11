import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";
import Navbar from "../components/Navbar";
import { PlayButton, ReconnectButton } from "../components/Buttons"

const TOKEN_TYPE_GUEST = "3";

const Home = () => {
  const nav = useNavigate();
  const { connect, player, destSocket } = useGlobalContext();
  const [matchStatus, setMatchStatus] = useState("");
  const [recon, setRecon] = useState(false);
  const token = localStorage.getItem("token");
  const wsapi = import.meta.env.VITE_WS_URL
  const httpapi = import.meta.env.VITE_HTTP_URL

  const play = (how: string) => {
    if (token) {
      findMatch(token, how);
    } else {
      findMatch(TOKEN_TYPE_GUEST, how);
    }
  }

  const findMatch = (token: string, how: string) => {
    console.log("Token", token);
    const uri = (how === "bot" ? "/againstbot" : "/game") +
      "?type=new&token=" + token;
    const socket = connect(wsapi + uri);
    localStorage.setItem("rectype", how);

    socket.onmessage = async (event: MessageEvent) => {
      if (event.data === "pending") {
        setMatchStatus("pending");
      } else {
        const json: MsgStart = await JSON.parse(event.data);
        player.color = json.color;
        player.gameId = json.gameId;
        console.log(json);

        const currentPath = window.location.pathname;
        if (!currentPath.includes(`/game/${json.gameId}`)) {
          nav(`/game/${json.gameId}`);
        }
      }
    };
  };

  const reconnect = () => {
    console.log("Token", token);
    const rectype = localStorage.getItem("rectype") ?
      localStorage.getItem("rectype") : "player" ;
    const socket = connect(wsapi +
      `/game?type=reconnect&rectype=${rectype}&token=${token}`);

    socket.onmessage = async (event: MessageEvent) => {
      const json: MsgStart = await JSON.parse(event.data);
      player.color = json.color;
      player.gameId = json.gameId;
      console.log(json);

      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/game/${json.gameId}`)) {
        nav(`/game/${json.gameId}`);
      }
    };
  };

  const checkOngoing = async () => {
    const username = localStorage.getItem("username");
    if (!username) return;

    const response = await fetch(httpapi + `/isPending?username=${username}`, {
      method: "GET",
      headers: {
        username: username,
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
    <div className="h-screen bg-[#222222] flex flex-col text-white">
      <Navbar />
      <div className="flex flex-col w-full justify-center items-center lg:flex-row">
        <div className="hidden lg:inline-flex lg:pt-[200px] mr-8">
          <img src="/boardbg.png" className="shadow-black w-[400px] rounded"/>
        </div>
        <div>
          <div className="flex flex-col items-center justify-center pt-[224px] space-y-8">
            <p className="text-5xl font-bold">Online Go!</p>
            {matchStatus === "pending" ? (
              <p className="text-lg">Finding an opponent...</p>
            ) : (
                <p className="text-lg">
                  {token ? "Ready to start a game!" : "Login or play as guest"}
                </p>
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
            {recon === true ? <ReconnectButton handler={reconnect} /> :''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
