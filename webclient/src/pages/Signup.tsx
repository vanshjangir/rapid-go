import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Signup: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const httpapi = import.meta.env.VITE_HTTP_URL

  const handleSignup = async () => {
    const response = await fetch(httpapi + '/signup', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "email": email,
        "password": password,
        "username": username,
      }),
    });

    if (response.status === 200){
      console.log("Signup successful");
      nav("/");
    } else {
      setError("Signup unsuccessful");
      console.log("Signup unsuccessful");
    }
  };

  return (
    <div className="h-screen bg-[#222222] text-white flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 space-y-6">
        <h1 className="text-3xl font-semibold text-center">Sign Up</h1>
        {error && <p className="text-red-500">{error}</p>}
        <div className="w-full max-w-md bg-[#333333] p-8 rounded-lg">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-lg">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-[#444444] text-white rounded-lg border border-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="username" className="text-lg">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-[#444444] text-white rounded-lg border border-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-lg">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-[#444444] text-white rounded-lg border border-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-lg">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-[#444444] text-white rounded-lg border border-[#555555] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm your password"
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleSignup}
                className="w-full py-3 bg-blue-600 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-gray-400">
          <p>Already have an account? <a href="/login" className="text-blue-400 hover:underline">Log In</a></p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
