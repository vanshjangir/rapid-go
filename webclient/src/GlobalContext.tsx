import React, { createContext, useContext, useRef, ReactNode } from "react";

interface GlobalContextType {
  player: {
    gameId: string;
    color: number;
  };
  isLoggedIn: boolean;
  username: string;
  setUsername: (username: string) => void;
  connect: (url: string, header: any) => WebSocket;
  getSocket : () => WebSocket | null;
}

interface GlobalProps {
  children: ReactNode;
}

const globalCtx = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<GlobalProps> = ({ children }) => {

  const player = {
    gameId: "",
    color: 1,
  };

  const user = localStorage.getItem('username');
  let username: string = "";
  let isLoggedIn: boolean = false;

  if (user) {
    username = user;
    isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  }

  const setUsername = (user: string) => {
    username = user;
    isLoggedIn = true;
    
    localStorage.setItem('username', user);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const socketRef = useRef<WebSocket | null>(null);
  const getSocket = (): WebSocket | null => socketRef.current;
  const connect = (url: string, header: any): WebSocket => {
    if(!socketRef.current){
      socketRef.current = new WebSocket(url, header);
    }
    return socketRef.current;
  }


  return (
    <globalCtx.Provider value={{connect, getSocket, player, isLoggedIn, username, setUsername}}>
      {children}
    </globalCtx.Provider>
  )
}

export const useGlobalContext = (): GlobalContextType => {
  const context = useContext(globalCtx);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalContextProvider");
  }
  return context;
};
