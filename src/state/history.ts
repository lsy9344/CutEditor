export type History<T> = { past: T[]; present: T; future: T[] };

export const HISTORY_LIMIT = 50;
export const HISTORY_CAPTURE_DELAY_MS = 400;

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(
  history: History<T>,
  next: T,
  isSame: (a: T, b: T) => boolean,
  limit: number = HISTORY_LIMIT,
): History<T> {
  if (isSame(history.present, next)) return history;

  const past = [...history.past, history.present];
  return {
    past: past.slice(Math.max(0, past.length - limit)),
    present: next,
    future: [],
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;

  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;

  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export type HistoryShortcutInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isEditableTarget: boolean;
};

export function getHistoryShortcut(input: HistoryShortcutInput): "undo" | "redo" | null {
  if (input.isEditableTarget) return null;

  const key = input.key.toLowerCase();
  if (key === "z" && (input.ctrlKey || input.metaKey)) {
    return input.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && input.ctrlKey && !input.metaKey) return "redo";
  return null;
}
