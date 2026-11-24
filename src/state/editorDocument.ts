import type { UserImage } from "../types/frame";
import type { CutoutSource } from "../photo/cutoutTypes";
import { pushHistory } from "./history.ts";
import type { History } from "./history.ts";

export type TextAlign = "left" | "center" | "right";

export type CanvasText = {
  id: string;
  text: string;
  x: number;
  y: number;
  boxWidth: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  isBold: boolean;
  isItalic: boolean;
  isVertical: boolean;
  textAlign: TextAlign;
  rotation: number;
  boxWidthBeforeFontLoad?: number; // 글꼴을 받기 전 기준 폭. 받으면 이 폭으로 다시 잽니다
};

export type CanvasSticker = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  tintColor: string | null;
  cutout?: CutoutSource;
};

export type EditorDocument = {
  userImages: UserImage[];
  texts: CanvasText[];
  stickers: CanvasSticker[];
  frameColor: string;
};

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof Blob !== "undefined" && a instanceof Blob && b instanceof Blob) return true;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray || bIsArray) {
    if (!aIsArray || !bIsArray) return false;
    if (a.length !== b.length) return false;
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord).filter((key) => aRecord[key] !== undefined);
  const bKeys = new Set(Object.keys(bRecord).filter((key) => bRecord[key] !== undefined));
  if (aKeys.length !== bKeys.size) return false;
  return aKeys.every((key) => bKeys.has(key) && isDeepEqual(aRecord[key], bRecord[key]));
}

export function isSameEditorDocument(a: EditorDocument, b: EditorDocument): boolean {
  return isDeepEqual(a, b);
}

export function hasEditorObject(document: EditorDocument, objectId: string): boolean {
  return (
    document.userImages.some((image) => image.id === objectId)
    || document.texts.some((text) => text.id === objectId)
    || document.stickers.some((sticker) => sticker.id === objectId)
  );
}

// 글씨 지우기 한 번의 기록입니다. base는 지우기 직전 기록 맨 위 문서 객체, deleted는 지운 직후 문서입니다(설계 9장, UR-2).
export type TextDeleteRecord = { base: EditorDocument; deleted: EditorDocument };

// 지금 문서까지 기록에 넣었을 때 맨 위가 그 지우기일 때만 지우기 안내의 [되돌리기]가 유효합니다.
// 문서 값만 비교하지 않습니다. 기록을 초기화하는 프레임 변경 뒤에는 base가 past에 없어 거짓입니다.
export function canUndoTextDelete({
  record,
  history,
  currentDocument,
}: {
  record: TextDeleteRecord | null;
  history: History<EditorDocument>;
  currentDocument: EditorDocument;
}): boolean {
  if (record === null) return false;
  const flushedHistory = pushHistory(history, currentDocument, isSameEditorDocument);
  const topPastDocument = flushedHistory.past[flushedHistory.past.length - 1];
  return topPastDocument === record.base && isSameEditorDocument(flushedHistory.present, record.deleted);
}

// 글씨 목록 보정을 문서에 적용하는 함수를 만듭니다. 같은 문서 객체는 늘 같은 결과 객체로 바꿔,
// 기록과 글씨 지우기 기록(base 객체 비교)에 함께 적용해도 서로 맞습니다. 바뀐 글씨가 없으면 문서를 그대로 돌려줍니다.
export function createDocumentTextsMapper(
  mapTexts: (texts: CanvasText[]) => CanvasText[],
): (document: EditorDocument) => EditorDocument {
  const mappedDocuments = new WeakMap<EditorDocument, EditorDocument>();
  return (document) => {
    const cachedDocument = mappedDocuments.get(document);
    if (cachedDocument) return cachedDocument;
    const nextTexts = mapTexts(document.texts);
    const nextDocument = nextTexts === document.texts ? document : { ...document, texts: nextTexts };
    mappedDocuments.set(document, nextDocument);
    return nextDocument;
  };
}

export function mapTextDeleteRecord(
  record: TextDeleteRecord | null,
  mapDocument: (document: EditorDocument) => EditorDocument,
): TextDeleteRecord | null {
  if (record === null) return null;
  const base = mapDocument(record.base);
  const deleted = mapDocument(record.deleted);
  return base === record.base && deleted === record.deleted ? record : { base, deleted };
}

export function collectObjectUrls(document: EditorDocument): Set<string> {
  const urls = new Set<string>();
  document.userImages.forEach((image) => urls.add(image.url));
  document.stickers.forEach((sticker) => {
    if (sticker.src.startsWith("blob:")) urls.add(sticker.src);
  });
  return urls;
}

export function collectUrlsToRevoke(
  trackedUrls: Iterable<string>,
  liveDocuments: EditorDocument[],
): string[] {
  const liveUrls = new Set<string>();
  liveDocuments.forEach((document) => {
    collectObjectUrls(document).forEach((url) => liveUrls.add(url));
  });

  const urlsToRevoke = new Set<string>();
  for (const url of trackedUrls) {
    if (!liveUrls.has(url)) urlsToRevoke.add(url);
  }
  return Array.from(urlsToRevoke).sort();
}
