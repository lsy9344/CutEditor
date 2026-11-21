// 색 스와치 위에 올리는 표시(✓)의 색을 고르는 계산입니다. WCAG 상대 휘도와 대비 식을 씁니다(1.4.11 비텍스트 대비 3:1).

const BLACK = "#000000";
const WHITE = "#FFFFFF";

type Rgb = { r: number; g: number; b: number };

// #rgb, #rrggbb만 읽습니다. 그 밖의 표기는 null입니다.
const parseHexColor = (hex: string): Rgb | null => {
  const digits = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!digits) return null;
  const full = digits.length === 3 ? digits.split("").map((digit) => digit + digit).join("") : digits;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const toLinearChannel = (channel: number): number => {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
};

const getRelativeLuminance = ({ r, g, b }: Rgb): number => 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b);

// 두 색의 대비 비율(1~21). 읽을 수 없는 색 표기는 패널 바탕인 흰색으로 봅니다(스와치가 그려지지 않으면 패널이 비칩니다).
export const getContrastRatio = (firstHex: string, secondHex: string): number => {
  const first = getRelativeLuminance(parseHexColor(firstHex) ?? { r: 255, g: 255, b: 255 });
  const second = getRelativeLuminance(parseHexColor(secondHex) ?? { r: 255, g: 255, b: 255 });
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

// 바탕색 위에서 더 잘 보이는 검정·흰색을 고릅니다. 둘 중 큰 쪽이라 대비는 언제나 4.5:1 안팎 이상입니다.
export const getReadableMarkColor = (backgroundHex: string): string => (
  getContrastRatio(BLACK, backgroundHex) >= getContrastRatio(WHITE, backgroundHex) ? BLACK : WHITE
);
