import React, { createContext, useContext, useRef, ReactNode } from "react";

interface GlobalContextType {
  connect: (url: string) => WebSocket;
  getSocket : () => WebSocket | null;
  player: {
    gameId: string;
    color: number;
  };
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

  const socketRef = useRef<WebSocket | null>(null);

  const getSocket = (): WebSocket | null => socketRef.current;

  const connect = (url: string): WebSocket => {
    if(!socketRef.current){
      socketRef.current = new WebSocket(url);
    }
    return socketRef.current;
  }


  return (
    <globalCtx.Provider value={{connect, getSocket, player}}>
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
