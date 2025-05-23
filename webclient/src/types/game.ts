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

export interface MsgWin {
  type: "win";
}

export interface MsgLose {
  type: "lose";
}

export interface MsgMoveStatus {
  type: "movestatus";
  turnStatus: string;
  moveStatus: string;
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
    opponent: string;
    result: string;
    date: string;
  }[];
}
