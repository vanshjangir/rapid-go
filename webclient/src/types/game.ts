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
  type: string;
}

export interface MsgLose {
  type: string;
}

export interface MsgMoveStatus {
  type: "movestatus";
  turnStatus: string;
  moveStatus: string;
  move: string;
}

export interface MsgMove {
  type: "move";
  move: string;
}

export interface GameState {
  gameId: string;
  color: number;
  state: number[][];
  liberty: number[][];
  turn: boolean;
  history: string[];
}
