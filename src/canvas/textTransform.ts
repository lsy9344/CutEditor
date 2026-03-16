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
