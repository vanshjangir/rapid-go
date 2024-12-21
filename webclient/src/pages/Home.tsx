import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";
import Navbar from "../components/Navbar";

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
    if (how === "guest") {
      findMatch(TOKEN_TYPE_GUEST);
    } else {
      if (token) {
        findMatch(token);
      }
    }
  }

  const findMatch = (token: string) => {
    console.log("Token", token);
    const socket = connect(wsapi + "/game?type=new", ["Authorization", token]);

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
    const socket = connect(wsapi + "/game?type=reconnect", ["Authorization", token]);

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
        <div className="hidden lg:inline-flex lg:pt-[12vw]">
          <img src="/whitestone.png"/>
        </div>
        <div>
          <div className="flex flex-col items-center justify-center pt-[12vw] space-y-4">
            {matchStatus === "pending" ? (
              <p className="text-lg">Finding an opponent...</p>
            ) : (
                <p className="text-lg">Ready to start a game?</p>
              )}
            <button
              onClick={() => play("player")}
              className="w-[200px] py-3 bg-blue-600 rounded hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
            >
              Play
            </button>
            <button
              onClick={() => play("guest")}
              className="w-[200px] py-3 bg-blue-600 rounded hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
            >
              Play as Guest
            </button>
            {recon === true ? (
              <button
                onClick={reconnect}
                className="w-[200px] py-3 bg-red-600 rounded hover:bg-red-500 focus:outline-none focus:ring focus:ring-blue-300"
              >
                Reconnect
              </button>
            ):(
                <></>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
