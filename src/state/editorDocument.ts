import type { UserImage } from "../types/frame";

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
