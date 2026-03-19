import type { FrameType } from "../types/frame";

type FrameSelectionDecision =
  | { kind: "noop" }
  | { kind: "activate-editor" }
  | { kind: "confirm"; frameType: FrameType }
  | { kind: "apply"; frameType: FrameType };

type FrameSelectionParams = {
  rawFrameType: string | null;
  selectedFrame: FrameType | null;
  hasContent: boolean;
};

type CategorySelectionOutcome = {
  nextCategory: string | null;
  nextCanvasMode: "gallery";
  autoSelectFrame: null;
};

const LEGACY_FRAME_MAP: Record<string, FrameType> = {
  "2": "2v_1",
  "2v": "2v_1",
  "4": "4v_1",
  "4v": "4v_1",
  "6": "6v_1",
  "6v": "6v_1",
  "9": "9v_1",
  "9v": "9v_1",
};

export const normalizeFrameType = (rawFrameType: string | null): FrameType | null => {
  if (!rawFrameType) return null;
  return (LEGACY_FRAME_MAP[rawFrameType] || rawFrameType) as FrameType;
};

export const getFrameSelectionDecision = ({
  rawFrameType,
  selectedFrame,
  hasContent,
}: FrameSelectionParams): FrameSelectionDecision => {
  const frameType = normalizeFrameType(rawFrameType);
  if (!frameType) {
    return { kind: "noop" };
  }

  if (selectedFrame === frameType) {
    return { kind: "activate-editor" };
  }

  if (selectedFrame && hasContent) {
    return {
      kind: "confirm",
      frameType,
    };
  }

  return {
    kind: "apply",
    frameType,
  };
};

export const hasFrameContent = ({
  textCount,
  stickerCount,
  userImageCount,
}: {
  textCount: number;
  stickerCount: number;
  userImageCount: number;
}): boolean => textCount > 0 || stickerCount > 0 || userImageCount > 0;

export const getCategorySelectionOutcome = ({
  selectedCategory,
  category,
}: {
  selectedCategory: string | null;
  category: string;
}): CategorySelectionOutcome => {
  if (selectedCategory === category) {
    return {
      nextCategory: null,
      nextCanvasMode: "gallery",
      autoSelectFrame: null,
    };
  }

  return {
    nextCategory: category,
    nextCanvasMode: "gallery",
    autoSelectFrame: null,
  };
};
