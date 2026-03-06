import { STICKER_CATEGORIES, STICKER_EXTENSIONS, STICKER_SLOT_COUNT, buildStickerSlots, } from "../../src/ui/stickerCatalog.js";
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
    }
}
function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
}
const slots = buildStickerSlots();
assertEqual(STICKER_SLOT_COUNT, 10, "slot count constant should be 10");
assertEqual(slots.length, 10, "slot list length should be 10");
assertEqual(slots[0].key, "1ss", "first slot key should be 1ss");
assertEqual(slots[9].key, "10ss", "last slot key should be 10ss");
assertDeepEqual(STICKER_EXTENSIONS, ["svg", "png", "webp", "jpg", "jpeg"], "extension order should match");
assertDeepEqual(slots[0].candidates, [
    "/stickers/1ss.svg",
    "/stickers/1ss.png",
    "/stickers/1ss.webp",
    "/stickers/1ss.jpg",
    "/stickers/1ss.jpeg",
], "first slot candidates should match");
assertDeepEqual(slots[9].candidates, [
    "/stickers/10ss.svg",
    "/stickers/10ss.png",
    "/stickers/10ss.webp",
    "/stickers/10ss.jpg",
    "/stickers/10ss.jpeg",
], "last slot candidates should match");
assertDeepEqual(STICKER_CATEGORIES[0].previewCandidates, [
    "/stickers/1s.svg",
    "/stickers/1s.png",
    "/stickers/1s.webp",
    "/stickers/1s.jpg",
    "/stickers/1s.jpeg",
], "basic preview candidates should use 1s");
assertDeepEqual(STICKER_CATEGORIES[1].previewCandidates, [
    "/stickers/2s.svg",
    "/stickers/2s.png",
    "/stickers/2s.webp",
    "/stickers/2s.jpg",
    "/stickers/2s.jpeg",
], "deco preview candidates should use 2s");
