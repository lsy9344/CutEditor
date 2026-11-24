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

// 기록의 모든 값에 같은 보정을 적용합니다. 편집이 아닌 보정(글꼴 도착 뒤 글씨 상자 폭 재측정)을 새 단계 없이 반영할 때 씁니다.
// 바뀐 값이 없으면 같은 기록 객체를 돌려줍니다.
export function mapHistory<T>(history: History<T>, mapValue: (value: T) => T): History<T> {
  const past = history.past.map(mapValue);
  const present = mapValue(history.present);
  const future = history.future.map(mapValue);
  const didChange = present !== history.present
    || past.some((value, index) => value !== history.past[index])
    || future.some((value, index) => value !== history.future[index]);
  return didChange ? { past, present, future } : history;
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
