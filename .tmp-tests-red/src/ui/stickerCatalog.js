export const STICKER_SLOT_COUNT = 10;
export const STICKER_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"];
export function buildStickerSlots() {
    return Array.from({ length: STICKER_SLOT_COUNT }, (_, index) => {
        const key = `${index + 1}s`;
        return {
            key,
            candidates: STICKER_EXTENSIONS.map((extension) => `/stickers/${key}.${extension}`),
        };
    });
}
// Temporary mock categories for the new UI
export const STICKER_CATEGORIES = [
    {
        id: "basic",
        label: "기본 스티커",
        description: "다양한 기본 도형과 기호",
        previewImage: "/stickers/1s.svg", // Use the first sticker as preview
        stickers: buildStickerSlots(),
    },
    {
        id: "deco",
        label: "꾸미기 스티커",
        description: "귀여운 장식용 스티커",
        previewImage: "/stickers/2s.svg", // Mock preview
        stickers: buildStickerSlots(), // Reuse for now, ideally different SVGs
    }
];
