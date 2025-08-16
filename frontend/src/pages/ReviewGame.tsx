import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";

const ReviewGame = () => {
  const [moves, setMoves] = useState<string[]>([]);
  const { gameid } = useParams();
  const fetchGame = async () => {
    const BACKEND_URL = import.meta.env.PROD ?
      import.meta.env.VITE_HTTPS_URL :
      import.meta.env.VITE_HTTP_URL;
    const token = localStorage.getItem('token') || "";
    const response = await fetch(`${BACKEND_URL}/review?gameid=${gameid}`, {
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
    <div className="h-screen bg-linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 100%) text-white flex flex-col">
      <Navbar />
      <p>{moves}</p>
    </div>
  );
};

export default ReviewGame;
