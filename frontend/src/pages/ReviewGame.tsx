import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";

const ReviewGame = () => {
  const [moves, setMoves] = useState<string[]>([]);
  const { gameid } = useParams();
  const fetchGame = async () => {
    const httpapi = import.meta.env.VITE_HTTP_URL
    const token = localStorage.getItem('token') || "";
    const response = await fetch(`${httpapi}/review?gameid=${gameid}`, {
      headers: {
        "Authorization": token
      }
    });

    if (response.status !== 200) {
      return (
        <div>
          Game not found
        </div>
      )
    }

    const json = await response.json();
    setMoves(json.moves.split("/"));
  }

  useEffect(() => {
    fetchGame();
  }, []);

  return (
    <div className="h-screen bg-[#222222] text-white flex flex-col">
      <Navbar />
      <p>{moves}</p>
    </div>
  );
};

export default ReviewGame;
