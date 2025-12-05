import { GoogleGenAI, Type } from "@google/genai";
import { CellData, CellState, CellValue, AIHint } from '../types';

// Helper to convert board to a string representation for the LLM
const boardToString = (board: CellData[][]): string => {
  return board.map(row => {
    return row.map(cell => {
      if (cell.state === CellState.REVEALED) {
        return cell.value.toString();
      }
      if (cell.state === CellState.FLAGGED) {
        return 'F';
      }
      return 'H'; // Hidden
    }).join(' ');
  }).join('\n');
};

export const getAIHint = async (board: CellData[][], minesTotal: number): Promise<AIHint | null> => {
  if (!process.env.API_KEY) {
    console.error("No API KEY found");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const boardStr = boardToString(board);
  const prompt = `
    你是一个扫雷游戏专家。
    以下是当前棋盘状态：
    - 'H' 代表隐藏的格子。
    - 'F' 代表已标记为地雷的格子。
    - '0'-'8' 代表已揭示的数字，表示周围地雷的数量。
    
    剩余地雷数: ${minesTotal}.
    
    当前棋盘矩阵:
    ${boardStr}
    
    请分析棋盘。找到最安全的一步（揭示 reveal）或者一个确定的地雷（标记 flag）。
    如果不存在绝对确定的步骤，请给出一个概率上最安全的猜测。
    请用中文简短地说明推理过程。
    返回的坐标请使用 0-indexed (row, col)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            row: { type: Type.INTEGER },
            col: { type: Type.INTEGER },
            action: { type: Type.STRING, enum: ['reveal', 'flag'] },
            reasoning: { type: Type.STRING },
          },
          required: ['row', 'col', 'action', 'reasoning']
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return null;
    
    return JSON.parse(jsonText) as AIHint;

  } catch (error) {
    console.error("Gemini AI Error:", error);
    return null;
  }
};