export enum CellValue {
  EMPTY = 0,
  MINE = -1
}

export enum CellState {
  HIDDEN = 'HIDDEN',
  REVEALED = 'REVEALED',
  FLAGGED = 'FLAGGED',
  QUESTION = 'QUESTION'
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST'
}

export interface CellData {
  row: number;
  col: number;
  value: number; // -1 for mine, 0-8 for neighbor count
  state: CellState;
  isExploded?: boolean; // True if this specific mine caused the loss
}

export interface Difficulty {
  name: string;
  rows: number;
  cols: number;
  mines: number;
}

export interface AIHint {
  row: number;
  col: number;
  action: 'reveal' | 'flag';
  reasoning: string;
}
