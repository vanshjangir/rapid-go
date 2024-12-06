import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";
import Navbar from "../components/Navbar";

const Home = () => {
  const nav = useNavigate();
  const { connect, player } = useGlobalContext();
  const [matchStatus, setMatchStatus] = useState("");
  const token = localStorage.getItem("token");

  const findMatch = () => {
    console.log("Token", token);
    const socket = connect("ws://localhost:8080/game?type=new", ["Authorization", token]);

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
    const socket = connect("ws://localhost:8080/game?type=reconnect", ["Authorization", token]);

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

  return (
    <div className="h-screen bg-[#222222] text-white">
      <Navbar />
      <div className="flex flex-col items-center justify-center pt-[20vw] space-y-4">
        {matchStatus === "pending" ? (
          <p className="text-lg">Finding an opponent...</p>
        ) : (
          <p className="text-lg">Ready to start a game?</p>
        )}
        <button
          onClick={findMatch}
          className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
        >
          Find Match
        </button>
        <button
          onClick={reconnect}
          className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
};

export default Home;
