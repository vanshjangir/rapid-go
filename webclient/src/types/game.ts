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
  selfTime: number;
  opTime: number;
}

export interface MsgMove {
  type: "move";
  move: string;
  selfTime: number;
  opTime: number;
}

export interface MsgSync {
  type: "sync";
  gameId: string;
  color: number;
  state: number[][];
  liberty: number[][];
  turn: boolean;
  history: string[];
  selfTime: number;
  opTime: number;
}

export interface GameState {
  gameId: string;
  color: number;
  state: number[][];
  liberty: number[][];
  turn: boolean;
  history: string[];
}
