import type { FrameType } from "../types/frame";

type TextPosition = {
  x: number;
  y: number;
};

const DEFAULT_TEXT_POSITIONS: Partial<Record<FrameType, TextPosition>> = {
  "1l": { x: 241.5, y: 100 },
  "1f": { x: 241.5, y: 665 },
  "2h": { x: 620, y: 241.5 },
  "2v_1": { x: 241.5, y: 630 },
  "4v_1": { x: 241.5, y: 630 },
  "4v_2": { x: 241.5, y: 630 },
  "4v_3": { x: 241.5, y: 630 },
  "4v_4": { x: 241.5, y: 630 },
  "4v_5": { x: 241.5, y: 630 },
  "4v_6": { x: 241.5, y: 630 },
  "3v_1": { x: 241.5, y: 630 },
  "6v_1": { x: 241.5, y: 660 },
  "6v_2": { x: 241.5, y: 660 },
  "8v_1": { x: 241.5, y: 630 },
  "8v_2": { x: 241.5, y: 630 },
  "8v_3": { x: 241.5, y: 630 },
  "9v_1": { x: 241.5, y: 650 },
};

export const getDefaultTextPosition = (frameType: FrameType | null): TextPosition => {
  if (!frameType) {
    return { x: 10, y: 10 };
  }

  return DEFAULT_TEXT_POSITIONS[frameType] ?? { x: 10, y: 10 };
};
