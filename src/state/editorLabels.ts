const SWATCH_NAMES: Record<string, string> = {
  "#ffffff": "흰색",
  "#000000": "검정",
  "#dcdcdc": "회색",
  "#fe9fb3": "진한 분홍",
  "#ffe4c4": "살구색",
  "#c8f7dc": "민트",
  "#c6e2ff": "하늘색",
  "#ffc1cc": "연분홍",
};

export const getSwatchName = (hex: string): string => SWATCH_NAMES[hex.toLowerCase()] ?? `다른 색 (${hex})`;

export const getSlotLabel = ({ hasUserImage, loadFailed }: { hasUserImage: boolean; loadFailed: boolean }): string => {
  if (loadFailed) return "사진을 못 불러왔어요";
  if (hasUserImage) return "사진 불러오는 중";
  return "눌러서 사진 넣기";
};

export const getSlotButtonLabel = (slotIndex: number, hasImage: boolean): string =>
  hasImage ? `${slotIndex + 1}번 칸 사진 바꾸기` : `${slotIndex + 1}번 칸에 사진 넣기`;

export const getStickerAltText = (categoryLabel: string, stickerIndex: number): string =>
  `${categoryLabel} 스티커 ${stickerIndex + 1}`;

export const getToggleButtonLabel = (label: string, isOn: boolean): string => (isOn ? `✓ ${label}` : label);
