import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CellData, CellState, Difficulty, GameStatus, AIHint } from './types';
import { createEmptyBoard, placeMines, revealCell, checkWin, revealAllMines } from './gameEngine';
import MineCell from './components/MineCell';
import LEDDisplay from './components/LEDDisplay';
import { getAIHint } from './services/geminiService';
import { Sparkles, HelpCircle } from 'lucide-react';

// Difficulty Presets
const DIFFICULTIES: Record<string, Difficulty> = {
  BEGINNER: { name: '初级', rows: 9, cols: 9, mines: 10 },
  INTERMEDIATE: { name: '中级', rows: 16, cols: 16, mines: 40 },
  EXPERT: { name: '高级', rows: 16, cols: 30, mines: 99 },
};

const App: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES.BEGINNER);
  const [board, setBoard] = useState<CellData[][]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [minesLeft, setMinesLeft] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiHint, setAiHint] = useState<AIHint | null>(null);

  // Fix: Use ReturnType<typeof setInterval> instead of NodeJS.Timer to support browser environments without Node types
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Draggable Board State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDown = useRef(false);
  const isDragging = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const startScrollPos = useRef({ left: 0, top: 0 });

  // Initialize Board
  const initGame = useCallback(() => {
    const newBoard = createEmptyBoard(difficulty.rows, difficulty.cols);
    setBoard(newBoard);
    setGameStatus(GameStatus.IDLE);
    setMinesLeft(difficulty.mines);
    setTimer(0);
    setAiHint(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [difficulty]);

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [initGame]);

  // Timer Logic
  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING) {
      timerRef.current = setInterval(() => {
        setTimer(t => Math.min(t + 1, 999));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [gameStatus]);

  // Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click drags
    if (e.button !== 0 || !scrollContainerRef.current) return;
    
    isMouseDown.current = true;
    isDragging.current = false;
    startMousePos.current = { x: e.pageX, y: e.pageY };
    startScrollPos.current = { 
      left: scrollContainerRef.current.scrollLeft, 
      top: scrollContainerRef.current.scrollTop 
    };

    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !scrollContainerRef.current) return;
    e.preventDefault();

    const xDiff = e.pageX - startMousePos.current.x;
    const yDiff = e.pageY - startMousePos.current.y;

    // If moved more than 5 pixels, consider it a drag operation
    if (Math.abs(xDiff) > 5 || Math.abs(yDiff) > 5) {
      isDragging.current = true;
    }

    scrollContainerRef.current.scrollLeft = startScrollPos.current.left - xDiff;
    scrollContainerRef.current.scrollTop = startScrollPos.current.top - yDiff;
  };

  const handleMouseUp = () => {
    isMouseDown.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
    }
    // Delay resetting dragging flag slightly so click handlers can read it
    setTimeout(() => {
      isDragging.current = false;
    }, 50);
  };

  const handleMouseLeave = () => {
    isMouseDown.current = false;
    isDragging.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
    }
  };

  // Right Click / Flag Handler - Memoized
  // We define this BEFORE handleCellClick so we can use it inside handleCellClick if needed
  const handleCellContext = useCallback((r: number, c: number) => {
    if (gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST) return;
    
    const cell = board[r][c];
    if (cell.state === CellState.REVEALED) return;

    const newBoard = [...board];
    
    if (cell.state === CellState.HIDDEN) {
      newBoard[r][c] = { ...cell, state: CellState.FLAGGED };
      setMinesLeft(m => m - 1);
    } else if (cell.state === CellState.FLAGGED) {
      newBoard[r][c] = { ...cell, state: CellState.HIDDEN };
      setMinesLeft(m => m + 1);
    }

    setBoard(newBoard);
  }, [board, gameStatus]);

  // Click Handler
  const handleCellClick = useCallback((r: number, c: number) => {
    // If we were dragging the map, ignore the click
    if (isDragging.current) return;

    if (gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST) return;
    
    // If cell is flagged, clicking it should toggle the flag (cancel it)
    if (board[r][c].state === CellState.FLAGGED) {
      handleCellContext(r, c);
      return;
    }

    let currentBoard = [...board];
    
    // First Move Protection
    if (gameStatus === GameStatus.IDLE) {
      setGameStatus(GameStatus.PLAYING);
      // Generate mines now, ensuring (r,c) is safe
      currentBoard = placeMines(currentBoard, difficulty, r, c);
    }

    const { board: nextBoard, hitMine } = revealCell(currentBoard, r, c);
    setBoard(nextBoard);

    if (hitMine) {
      setGameStatus(GameStatus.LOST);
      setBoard(revealAllMines(nextBoard));
    } else {
      if (checkWin(nextBoard, difficulty.mines)) {
        setGameStatus(GameStatus.WON);
        setMinesLeft(0);
      }
    }
    setAiHint(null); // Clear hint on move

  }, [board, gameStatus, difficulty, handleCellContext]);

  // AI Hint Handler - Memoized
  const handleAskAI = useCallback(async () => {
    if (gameStatus !== GameStatus.PLAYING && gameStatus !== GameStatus.IDLE) return;
    if (isAiThinking) return;

    setIsAiThinking(true);
    setAiHint(null);

    const hint = await getAIHint(board, minesLeft);
    if (hint) {
      setAiHint(hint);
    }
    setIsAiThinking(false);
  }, [board, minesLeft, gameStatus, isAiThinking]);

  const faceEmoji = () => {
    if (gameStatus === GameStatus.WON) return '😎';
    if (gameStatus === GameStatus.LOST) return '😵';
    return '🙂'; // Default
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 font-sans">
      
      {/* Game Window */}
      <div className="bg-slate-300 p-1 sm:p-2 border-t-white border-l-white border-b-slate-500 border-r-slate-500 border-4 shadow-2xl max-w-full flex flex-col max-h-[90vh]">
        
        {/* Header (Controls + Info) */}
        <div className="flex flex-col gap-4 mb-4 border-b-white border-r-white border-t-slate-500 border-l-slate-500 border-4 p-3 bg-slate-200 shrink-0">
          
          {/* Top Bar: Select & AI */}
          <div className="flex justify-between items-center w-full mb-2">
            <select 
              className="px-2 py-1 bg-white border-2 border-slate-400 text-sm focus:outline-none font-bold text-slate-700"
              value={Object.keys(DIFFICULTIES).find(key => DIFFICULTIES[key].name === difficulty.name) || 'BEGINNER'}
              onChange={(e) => {
                const key = e.target.value as keyof typeof DIFFICULTIES;
                setDifficulty(DIFFICULTIES[key]);
              }}
            >
              {Object.keys(DIFFICULTIES).map(k => (
                <option key={k} value={k}>{DIFFICULTIES[k].name}</option>
              ))}
            </select>

            <button 
              onClick={handleAskAI}
              disabled={isAiThinking || gameStatus === GameStatus.WON || gameStatus === GameStatus.LOST}
              className={`flex items-center gap-1 px-3 py-1 text-sm font-bold text-white rounded shadow-md transition-colors 
                ${isAiThinking ? 'bg-purple-400 cursor-wait' : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700'}`}
            >
              <Sparkles size={14} />
              {isAiThinking ? '思考中...' : 'AI 提示'}
            </button>
          </div>

          {/* Game Stats Bar */}
          <div className="flex justify-between items-center w-full">
            <LEDDisplay value={minesLeft} />
            
            <button 
              onClick={initGame}
              className="w-12 h-12 text-3xl flex items-center justify-center bg-slate-200 border-t-white border-l-white border-b-slate-600 border-r-slate-600 border-4 active:border-t-slate-600 active:border-l-slate-600 active:border-b-white active:border-r-white"
            >
              {faceEmoji()}
            </button>

            <LEDDisplay value={timer} />
          </div>

          {/* AI Hint Text */}
          {aiHint && (
            <div className="mt-2 text-sm bg-yellow-100 border border-yellow-400 text-yellow-800 p-2 rounded flex items-start gap-2 animate-pulse">
               <HelpCircle size={16} className="mt-0.5 shrink-0" />
               <div>
                 <span className="font-bold">Gemini 分析: </span>
                 {aiHint.reasoning} 
                 <span className="block text-xs mt-1 text-slate-500">
                    建议操作: {aiHint.action === 'reveal' ? '揭示' : '标记'} (行 {aiHint.row + 1}, 列 {aiHint.col + 1})
                 </span>
               </div>
            </div>
          )}
        </div>

        {/* Board Container */}
        {/* We attach drag handlers here. 'cursor-grab' signals functionality. 'no-scrollbar' hides bars. */}
        <div 
          ref={scrollContainerRef}
          className="overflow-auto border-t-slate-500 border-l-slate-500 border-b-white border-r-white border-4 bg-slate-400 cursor-grab no-scrollbar relative flex-1"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div 
            className="grid gap-0"
            style={{ 
              // 'auto' forces cells to respect their internal w/h, avoiding shrinking on large grids
              gridTemplateColumns: `repeat(${difficulty.cols}, auto)`,
              width: 'max-content' // Ensures the grid expands horizontally beyond container
            }}
          >
            {board.map((row, rIndex) => (
              row.map((cell, cIndex) => {
                // Highlight hint cell
                const isHintTarget = aiHint?.row === rIndex && aiHint?.col === cIndex;
                
                return (
                  <div key={`${rIndex}-${cIndex}`} className={`relative ${isHintTarget ? 'z-10 ring-4 ring-yellow-400' : ''}`}>
                    <MineCell 
                      data={cell} 
                      onClick={handleCellClick} 
                      onContextMenu={handleCellContext} 
                    />
                  </div>
                );
              })
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-slate-500 text-xs text-center max-w-md">
        <p>手机端或电脑端长按格子均可标记地雷。</p>
        <p>Powered by React & Google Gemini</p>
      </div>

    </div>
  );
};

export default App;