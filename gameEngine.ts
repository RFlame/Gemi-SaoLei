import { CellData, CellState, CellValue, Difficulty } from './types';

export const createEmptyBoard = (rows: number, cols: number): CellData[][] => {
  const board: CellData[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        value: CellValue.EMPTY,
        state: CellState.HIDDEN,
      });
    }
    board.push(row);
  }
  return board;
};

// Places mines avoiding the first clicked cell (safe start)
export const placeMines = (
  board: CellData[][],
  difficulty: Difficulty,
  safeRow: number,
  safeCol: number
): CellData[][] => {
  const newBoard = JSON.parse(JSON.stringify(board)); // Deep copy
  let minesPlaced = 0;
  const totalCells = difficulty.rows * difficulty.cols;
  
  // Create a pool of available indices, excluding the safe starting zone (cell + neighbors)
  const safeZone = new Set<string>();
  for (let r = safeRow - 1; r <= safeRow + 1; r++) {
    for (let c = safeCol - 1; c <= safeCol + 1; c++) {
      safeZone.add(`${r},${c}`);
    }
  }

  while (minesPlaced < difficulty.mines) {
    const r = Math.floor(Math.random() * difficulty.rows);
    const c = Math.floor(Math.random() * difficulty.cols);
    
    if (newBoard[r][c].value !== CellValue.MINE && !safeZone.has(`${r},${c}`)) {
      newBoard[r][c].value = CellValue.MINE;
      minesPlaced++;
    }
  }

  // Calculate numbers
  for (let r = 0; r < difficulty.rows; r++) {
    for (let c = 0; c < difficulty.cols; c++) {
      if (newBoard[r][c].value === CellValue.MINE) continue;
      
      let count = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const nr = r + i;
          const nc = c + j;
          if (nr >= 0 && nr < difficulty.rows && nc >= 0 && nc < difficulty.cols) {
            if (newBoard[nr][nc].value === CellValue.MINE) count++;
          }
        }
      }
      newBoard[r][c].value = count;
    }
  }

  return newBoard;
};

// BFS to reveal empty areas
export const revealCell = (board: CellData[][], row: number, col: number): { board: CellData[][], hitMine: boolean } => {
  const newBoard = [...board];
  const cell = newBoard[row][col];

  if (cell.state !== CellState.HIDDEN) {
    return { board: newBoard, hitMine: false };
  }

  if (cell.value === CellValue.MINE) {
    newBoard[row][col] = { ...cell, state: CellState.REVEALED, isExploded: true };
    return { board: newBoard, hitMine: true };
  }

  const queue = [[row, col]];
  
  // Mark initial as revealed
  newBoard[row][col] = { ...cell, state: CellState.REVEALED };

  let head = 0;
  while(head < queue.length){
    const [currR, currC] = queue[head++];
    const currentCell = newBoard[currR][currC];

    // If it's empty (0), check neighbors
    if (currentCell.value === 0) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const nr = currR + i;
          const nc = currC + j;
          
          if (nr >= 0 && nr < newBoard.length && nc >= 0 && nc < newBoard[0].length) {
            const neighbor = newBoard[nr][nc];
            if (neighbor.state === CellState.HIDDEN) {
              // Reveal logic
              newBoard[nr][nc] = { ...neighbor, state: CellState.REVEALED };
              // If neighbor is also empty, add to queue
              if (neighbor.value === 0) {
                 // Check if already in queue to prevent dupes (simple optimization)
                 // Ideally use a visited Set, but changing state acts as visited here
                 queue.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  }

  return { board: newBoard, hitMine: false };
};

export const checkWin = (board: CellData[][], mines: number): boolean => {
  let hiddenOrFlaggedCount = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.state === CellState.HIDDEN || cell.state === CellState.FLAGGED) {
        hiddenOrFlaggedCount++;
      }
    }
  }
  return hiddenOrFlaggedCount === mines;
};

export const revealAllMines = (board: CellData[][]): CellData[][] => {
  return board.map(row => row.map(cell => {
    if (cell.value === CellValue.MINE) {
      return { ...cell, state: CellState.REVEALED };
    }
    return cell;
  }));
};
