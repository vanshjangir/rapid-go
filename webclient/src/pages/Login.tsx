import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { useGlobalContext } from "../GlobalContext";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const { setUsername } = useGlobalContext();

  const handleLogin = async () => {
    const response = await fetch('http://localhost:8080/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "type": "email",
        "email": email,
        "password": password,
        "credential": "",
      }),
    });

    if (response.status === 200){
      const json = await response.json();
      console.log("Login successful");
      localStorage.setItem("token", json.token);
      localStorage.setItem("username", json.username);
      setUsername(json.username);
      nav("/");
    } else {
      setError("Login unsuccessful");
      console.log("Login unsuccessful");
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if(!credentialResponse.credential){
      setError("Google Login unsuccessful");
      console.log("Google Login unsuccessful");
      return
    }

    const response = await fetch('http://localhost:8080/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "type": "google-token",
        "email": "",
        "password": "",
        "credential": credentialResponse.credential,
      }),
    });

    if (response.status === 200){
      const json = await response.json();
      console.log("Login successful");
      localStorage.setItem("token", json.token);
      setUsername(json.username);
      nav("/");
    } else {
      setError("Google Login unsuccessful");
      console.log("Google Login unsuccessful");
    }
  }

  return (
    <div className="h-screen bg-[#222222] text-white flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 space-y-6">
        <h1 className="text-3xl font-semibold text-center">Login</h1>
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
            <div className="flex justify-center">
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring focus:ring-blue-300"
              >
                Login
              </button>
            </div>
            <div className="flex items-center my-6">
              <hr className="flex-grow border-t border-gray-600" />
              <span className="mx-4 text-gray-400">OR</span>
              <hr className="flex-grow border-t border-gray-600" />
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  handleGoogleLogin(credentialResponse);
                }}
                onError={() => {
                  console.log("Google Login Failed");
                  setError("Google Login unsuccessful");
                }}
                useOneTap
              />
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-gray-400">
          <p>Don't have an account? <a href="/signup" className="text-blue-400 hover:underline">Sign Up</a></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
