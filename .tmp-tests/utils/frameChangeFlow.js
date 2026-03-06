const LEGACY_FRAME_MAP = {
    "2": "2v",
    "4": "4v",
    "6": "6v",
    "9": "9v",
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
export const getCategorySelectionOutcome = ({ selectedCategory, category, options, }) => {
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
        autoSelectFrame: options.length === 1 ? options[0] : null,
    };
};
