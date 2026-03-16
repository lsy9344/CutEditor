const HORIZONTAL_MIN_TEXT_BOX_WIDTH = 160;
const TEXT_ALIGN_PADDING = 24;

export const getMinimumTextBoxWidthForMeasuredWidth = ({
  measuredWidth,
  isVertical,
}: {
  measuredWidth: number;
  isVertical: boolean;
}): number => {
  const safeMeasuredWidth = Math.max(1, Math.ceil(measuredWidth));

  if (isVertical) {
    return safeMeasuredWidth;
  }

  return Math.max(
    HORIZONTAL_MIN_TEXT_BOX_WIDTH,
    safeMeasuredWidth + TEXT_ALIGN_PADDING * 2,
  );
};

export const resolveTextBoxWidth = ({
  previousBoxWidth,
  minimumBoxWidth,
  didOrientationChange,
}: {
  previousBoxWidth: number;
  minimumBoxWidth: number;
  didOrientationChange: boolean;
}): number => {
  if (didOrientationChange) {
    return minimumBoxWidth;
  }

  return Math.max(previousBoxWidth, minimumBoxWidth);
};
