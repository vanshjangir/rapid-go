import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UserProfileData } from "../types/game";
import Navbar from "../components/Navbar";

const Profile = () => {
  const { username } = useParams();
  const httpapi = import.meta.env.VITE_HTTP_URL;
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const token = localStorage.getItem('token');
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
      },
      body: JSON.stringify({
        "token": token,
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
      <div className="h-screen bg-[#222222] flex flex-col text-white">
        <div className="flex items-center justify-center h-screen">Loading...</div>
      </div>
    );

  return (
    <div className="h-screen bg-[#222222] flex flex-col text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-16">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <div className="flex">
              {textAreaVis === false ?
                (
                  <>
                    <h1 className="text-2xl font-bold">{userData.name || username}</h1>
                    <button onClick={onButtonClick}>
                      <img src="/editpencil.png" width={30} />
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      className="bg-[#222222]"
                      placeholder="username"
                      autoFocus
                      onChange={(e) => setNewUsername(e.target.value)}
                      onKeyDown={(e) => {if(e.key === "Enter") changeUsername();}}
                    />
                    <button onClick={changeUsername} className="border-white-50 ml-2">
                      <img src="/tick.png" className="w-[20px]" />
                    </button>
                  </>
                )
              }
            </div>
            <p className="text-gray-300">Rating: {userData.rating}</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center text-black bg-gray-100 p-4 rounded-lg">
              <span className="block text-2xl font-bold">{userData.gamesPlayed}</span>
              <span>Games Played</span>
            </div>
            <div className="text-center text-black bg-green-500 p-4 rounded-lg">
              <span className="block text-2xl font-bold">{userData.wins}</span>
              <span>Wins</span>
            </div>
            <div className="text-center text-black bg-red-500 p-4 rounded-lg">
              <span className="block text-2xl font-bold">{userData.losses}</span>
              <span>Losses</span>
            </div>
            <div className="text-center text-black bg-blue-400 p-4 rounded-lg">
              <span className="block text-2xl font-bold">{userData.highestRating}</span>
              <span>Highest Rating</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Games</h2>
          {(userData.recentGames && userData.recentGames.length > 0) ? (
            <ul className="space-y-4">
              {userData.recentGames.map((game, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center p-1 font-bold rounded-lg shadow-white"
                >
                  <span>{game.result}</span>
                  <span>
                    <a href={"/profile/"+game.opponent} className="hover:underline">
                      {game.opponent}
                    </a>
                  </span>
                  <span>{new Date(game.date.split(' ')[0]).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No recent games played.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
