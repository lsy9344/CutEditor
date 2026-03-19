const LEGACY_FRAME_MAP = {
    "2": "2v_1",
    "2v": "2v_1",
    "4": "4v_1",
    "4v": "4v_1",
    "6": "6v_1",
    "6v": "6v_1",
    "9": "9v_1",
    "9v": "9v_1",
};
export const normalizeFrameType = (rawFrameType) => {
    if (!rawFrameType)
        return null;
    return (LEGACY_FRAME_MAP[rawFrameType] || rawFrameType);
};
export const getFrameSelectionDecision = ({ rawFrameType, selectedFrame, hasContent, }) => {
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
export const hasFrameContent = ({ textCount, stickerCount, userImageCount, }) => textCount > 0 || stickerCount > 0 || userImageCount > 0;
export const getCategorySelectionOutcome = ({ selectedCategory, category, }) => {
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
