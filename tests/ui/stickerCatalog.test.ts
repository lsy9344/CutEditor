import {
  STICKER_EXTENSIONS,
  STICKER_SLOT_COUNT,
  buildStickerSlots,
} from "../../src/ui/stickerCatalog.js";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const slots = buildStickerSlots();

assertEqual(STICKER_SLOT_COUNT, 10, "slot count constant should be 10");
assertEqual(slots.length, 10, "slot list length should be 10");

assertEqual(slots[0].key, "1s", "first slot key should be 1s");
assertEqual(slots[9].key, "10s", "last slot key should be 10s");

assertDeepEqual(STICKER_EXTENSIONS, ["svg", "png", "webp", "jpg", "jpeg"], "extension order should match");
assertDeepEqual(slots[0].candidates, [
  "/stickers/1s.svg",
  "/stickers/1s.png",
  "/stickers/1s.webp",
  "/stickers/1s.jpg",
  "/stickers/1s.jpeg",
], "first slot candidates should match");
assertDeepEqual(slots[9].candidates, [
  "/stickers/10s.svg",
  "/stickers/10s.png",
  "/stickers/10s.webp",
  "/stickers/10s.jpg",
  "/stickers/10s.jpeg",
], "last slot candidates should match");
