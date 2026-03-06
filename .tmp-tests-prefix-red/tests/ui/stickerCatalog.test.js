import { STICKER_CATEGORIES, STICKER_EXTENSIONS, STICKER_SLOT_COUNT, } from "../../src/ui/stickerCatalog.js";
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
const basicCategory = STICKER_CATEGORIES[0];
const decoCategory = STICKER_CATEGORIES[1];
const basicSlots = basicCategory.stickers;
const decoSlots = decoCategory.stickers;
assertEqual(STICKER_SLOT_COUNT, 10, "slot count constant should be 10");
assertEqual(basicSlots.length, 10, "basic slot list length should be 10");
assertEqual(decoSlots.length, 10, "deco slot list length should be 10");
assertEqual(basicSlots[0].key, "1s_1ss", "basic first slot key should be 1s_1ss");
assertEqual(basicSlots[9].key, "1s_10ss", "basic last slot key should be 1s_10ss");
assertEqual(decoSlots[0].key, "2s_1ss", "deco first slot key should be 2s_1ss");
assertEqual(decoSlots[9].key, "2s_10ss", "deco last slot key should be 2s_10ss");
assertDeepEqual(STICKER_EXTENSIONS, ["svg", "png", "webp", "jpg", "jpeg"], "extension order should match");
assertDeepEqual(basicSlots[0].candidates, [
    "/stickers/1s_1ss.svg",
    "/stickers/1s_1ss.png",
    "/stickers/1s_1ss.webp",
    "/stickers/1s_1ss.jpg",
    "/stickers/1s_1ss.jpeg",
], "basic first slot candidates should match");
assertDeepEqual(basicSlots[9].candidates, [
    "/stickers/1s_10ss.svg",
    "/stickers/1s_10ss.png",
    "/stickers/1s_10ss.webp",
    "/stickers/1s_10ss.jpg",
    "/stickers/1s_10ss.jpeg",
], "basic last slot candidates should match");
assertDeepEqual(decoSlots[0].candidates, [
    "/stickers/2s_1ss.svg",
    "/stickers/2s_1ss.png",
    "/stickers/2s_1ss.webp",
    "/stickers/2s_1ss.jpg",
    "/stickers/2s_1ss.jpeg",
], "deco first slot candidates should match");
assertDeepEqual(decoSlots[9].candidates, [
    "/stickers/2s_10ss.svg",
    "/stickers/2s_10ss.png",
    "/stickers/2s_10ss.webp",
    "/stickers/2s_10ss.jpg",
    "/stickers/2s_10ss.jpeg",
], "deco last slot candidates should match");
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
