export type TextTransformBase = {
  boxWidth: number;
  fontSize: number;
};

export type TextTransformNodeState = {
  x: number;
  y: number;
  rotation: number;
  width: number;
  scaleX: number;
  scaleY: number;
};

export type TextTransformResult = {
  x: number;
  y: number;
  rotation: number;
  boxWidth: number;
  fontSize: number;
};

export const getNextTextTransformState = (
  base: TextTransformBase,
  node: TextTransformNodeState,
): TextTransformResult => {
  const safeBaseWidth = Math.max(base.boxWidth, 1);
  const safeNodeWidth = Math.max(node.width, 1);
  const appliedScaleX = Math.abs(node.scaleX) || 1;
  const appliedScaleY = Math.abs(node.scaleY) || 1;
  const nextBoxWidth = Math.max(10, safeNodeWidth * appliedScaleX);
  const widthScale = nextBoxWidth / safeBaseWidth;
  const nextScale = Math.max(widthScale, appliedScaleY);

  return {
    x: node.x,
    y: node.y,
    rotation: node.rotation,
    boxWidth: nextBoxWidth,
    fontSize: Math.max(1, Math.round(base.fontSize * nextScale)),
  };
};

// 텍스트 크기 계산 유틸리티 함수(CanvasStage에서 옮김). Node에는 document가 없어 근사치 계산으로 갑니다.
export const getTextDimensions = (text: string, fontSize: number, fontFamily: string, isBold: boolean, isItalic: boolean, isVertical: boolean) => {
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');

  const formattedText = isVertical ? text.replace(/\n/g, ' ').split('').join('\n') : text;
  const lines = formattedText.split('\n');

  if (ctx) {
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    return {
      width: isVertical ? Math.max(maxWidth, fontSize) : maxWidth, // 세로쓰기는 최소 fontSize 너비 확보
      height: fontSize * (isVertical ? 1.2 : 1) * lines.length
    };
  }

  // 폴백: 근사치 계산
  const maxLength = Math.max(1, ...lines.map(line => line.length));
  return {
    width: isVertical ? fontSize : maxLength * fontSize * 0.6,
    height: fontSize * lines.length * (isVertical ? 1.2 : 1)
  };
};

// CanvasStage가 글씨를 그리는 폭과 같은 값입니다(세로 글씨는 측정한 폭, 가로 글씨는 boxWidth).
// 글씨 손잡이(CanvasStage onTransformEnd)와 글씨 '크게 하기'/'작게 하기'(EditorPanel)가 같은 폭을 기준으로 삼습니다(UP-6).
export type RenderedTextInput = {
  text: string;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isVertical: boolean;
  boxWidth: number;
};

export const getRenderedTextWidth = (textItem: RenderedTextInput): number => {
  const dimensions = getTextDimensions(textItem.text, textItem.fontSize, textItem.fontFamily, textItem.isBold, textItem.isItalic, textItem.isVertical);
  return textItem.isVertical ? dimensions.width : textItem.boxWidth;
};
