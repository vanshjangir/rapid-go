export interface MsgStart {
  type: string;
  start: number;
  color: number;
  gameId: string;
}

export interface MsgStop {
  type: string;
}

export interface MsgPass {
  type: string;
}

export interface MsgAbort {
  type: string;
}

export interface MsgGameover {
  type: "gameover";
  winner: number;
  message: string;
}

export interface MsgMoveStatus {
  type: "movestatus";
  turnStatus: boolean;
  moveStatus: boolean;
  move: string;
  state: string;
  selfTime: number;
  opTime: number;
}

export interface MsgMove {
  type: "move";
  move: string;
  state: string;
  selfTime: number;
  opTime: number;
}

export interface MsgSync {
  type: "sync";
  gameId: string;
  color: number;
  state: string;
  turn: boolean;
  history: string[];
  selfTime: number;
  opTime: number;
}

export interface MsgChat {
  type: "chat";
  message: string;
}

export interface GameState {
  gameId: string;
  color: number;
  state: number[][];
  turn: boolean;
  history: string[];
}

export interface ChatMessage {
  type: "sent" | "received";
  text: string;
}

export interface UserProfileData {
  name: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  highestRating: number;
  recentGames: {
    gameid: string;
    opponent: string;
    result: string;
    date: string;
  }[];
}
