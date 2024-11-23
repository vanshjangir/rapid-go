import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../GlobalContext";
import { MsgStart } from "../types/game";

const Home = () => {
  const nav = useNavigate();
  const { connect, player } = useGlobalContext();
  const [matchStatus, setMatchStatus] = useState("");

  const findMatch = () => {
    const socket = connect("ws://localhost:8080/game");
    socket.onmessage = async (event: MessageEvent) => {
      if(event.data === "pending"){
        setMatchStatus("pending");
      } else {
        const json: MsgStart = await JSON.parse(event.data);
        player.color = json.color;
        player.gameId = json.gameId;
        console.log(json);

        const currentPath = window.location.pathname;
        if(!currentPath.includes(`/game/${json.gameId}`)){
          nav(`/game/${json.gameId}`);
        }
      }
    };
  };

  return (
    <>
      {matchStatus === "pending" ? <p>Pending</p> : <p>Start a game</p>}
      <button onClick={findMatch}>FindMatch</button>
    </>
  );
};

export default Home;
