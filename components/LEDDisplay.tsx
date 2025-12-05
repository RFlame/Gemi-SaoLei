import React from 'react';

interface LEDDisplayProps {
  value: number;
}

const LEDDisplay: React.FC<LEDDisplayProps> = ({ value }) => {
  // Clamp value between -99 and 999 for display
  const clamped = Math.max(-99, Math.min(999, value));
  // Format to 3 chars, padding with 0 or handling negative
  const formatted = clamped.toString().padStart(3, '0');

  return (
    <div className="bg-black text-red-600 px-2 py-1 text-3xl font-bold border-2 border-slate-600 rounded digital-font tracking-widest shadow-inner">
      {formatted}
    </div>
  );
};

export default LEDDisplay;
