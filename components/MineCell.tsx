import React, { useRef } from 'react';
import { CellData, CellState, CellValue } from '../types';

interface MineCellProps {
  data: CellData;
  onClick: (r: number, c: number) => void;
  onContextMenu: (r: number, c: number) => void;
}

const numberColors: Record<number, string> = {
  1: 'text-blue-700',
  2: 'text-green-700',
  3: 'text-red-700',
  4: 'text-purple-800',
  5: 'text-red-900',
  6: 'text-cyan-800',
  7: 'text-black',
  8: 'text-gray-600',
};

const MineCell: React.FC<MineCellProps> = ({ data, onClick, onContextMenu }) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const mouseStartPos = useRef<{ x: number; y: number } | null>(null);

  // Handle right click (flag) - Desktop standard
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(data.row, data.col);
  };

  // --- Touch Events (Mobile) ---

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPress.current = false;
    if (e.touches[0]) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onContextMenu(data.row, data.col);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400); 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches[0]) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;

    if (isLongPress.current) {
       if (e.cancelable) e.preventDefault();
    }
  };

  // --- Mouse Events (Desktop Left-Click Hold) ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only process left click (button 0) for simulated long press
    if (e.button !== 0) return;

    isLongPress.current = false;
    mouseStartPos.current = { x: e.clientX, y: e.clientY };

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onContextMenu(data.row, data.col);
    }, 400);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Detect drag to cancel long press
    if (mouseStartPos.current) {
      const dx = Math.abs(e.clientX - mouseStartPos.current.x);
      const dy = Math.abs(e.clientY - mouseStartPos.current.y);
      if (dx > 5 || dy > 5) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    mouseStartPos.current = null;
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    mouseStartPos.current = null;
  };

  // --- Click Handling ---

  const handleClick = (e: React.MouseEvent) => {
      // If this click was triggered after a long press, ignore the click (reveal) action
      if (isLongPress.current) {
          isLongPress.current = false;
          return;
      }
      onClick(data.row, data.col);
  }

  const getCellContent = () => {
    if (data.state === CellState.FLAGGED) return '🚩';
    if (data.state === CellState.QUESTION) return '?';
    if (data.state === CellState.HIDDEN) return '';
    if (data.value === CellValue.MINE) return '💣';
    if (data.value === 0) return '';
    return data.value;
  };

  const baseClasses = "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-xl font-bold cursor-pointer select-none no-select";
  
  let visualClasses = "";
  if (data.state === CellState.HIDDEN || data.state === CellState.FLAGGED || data.state === CellState.QUESTION) {
    visualClasses = "bg-slate-300 border-t-white border-l-white border-b-slate-600 border-r-slate-600 border-[3px] active:border-slate-400";
  } else {
    // Revealed
    visualClasses = "bg-slate-200 border-slate-300 border-[1px]";
    if (data.isExploded) visualClasses += " bg-red-500";
  }

  const textColor = (data.state === CellState.REVEALED && data.value > 0) 
    ? numberColors[data.value] 
    : 'text-black';

  return (
    <div
      className={`${baseClasses} ${visualClasses} ${textColor}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      
      // Touch
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}

      // Mouse
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {getCellContent()}
    </div>
  );
};

export default React.memo(MineCell);