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

// 폰트를 받기 전에는 대체 폰트로 잰 너비를 잠시 쓴다.
// 그 너비가 남지 않도록, 대체 폰트로 재기 전의 너비를 boxWidthBeforeFontLoad에 기록해 둔다.
export const resolveFontAwareTextBoxWidth = ({
  previousBoxWidth,
  boxWidthBeforeFontLoad,
  hasExplicitBoxWidth,
  minimumBoxWidth,
  didOrientationChange,
  isFontReady,
}: {
  previousBoxWidth: number;
  boxWidthBeforeFontLoad?: number;
  hasExplicitBoxWidth: boolean;
  minimumBoxWidth: number;
  didOrientationChange: boolean;
  isFontReady: boolean;
}): { boxWidth: number; boxWidthBeforeFontLoad?: number } => {
  const baseBoxWidth = !hasExplicitBoxWidth && boxWidthBeforeFontLoad !== undefined
    ? boxWidthBeforeFontLoad
    : previousBoxWidth;
  const boxWidth = resolveTextBoxWidth({
    previousBoxWidth: baseBoxWidth,
    minimumBoxWidth,
    didOrientationChange,
  });

  if (isFontReady) {
    return { boxWidth };
  }

  // 방향을 바꾸면 이전 폭을 버리고 최소 폭으로 맞추므로, 받은 뒤의 기준 폭도 0(최소 폭만 사용)으로 둔다.
  return { boxWidth, boxWidthBeforeFontLoad: didOrientationChange ? 0 : baseBoxWidth };
};

type FontAwareTextBox = {
  fontFamily: string;
  boxWidth: number;
  boxWidthBeforeFontLoad?: number;
};

export const applyLoadedFontBoxWidths = <TText extends FontAwareTextBox>(
  texts: TText[],
  {
    isFontReady,
    getMinimumBoxWidth,
  }: {
    isFontReady: (fontFamily: string) => boolean;
    getMinimumBoxWidth: (text: TText) => number;
  },
): TText[] => {
  let didChange = false;
  const nextTexts = texts.map((text) => {
    if (text.boxWidthBeforeFontLoad === undefined || !isFontReady(text.fontFamily)) {
      return text;
    }

    didChange = true;
    const { boxWidthBeforeFontLoad, ...textWithoutPendingWidth } = text;
    return {
      ...textWithoutPendingWidth,
      boxWidth: resolveTextBoxWidth({
        previousBoxWidth: boxWidthBeforeFontLoad,
        minimumBoxWidth: getMinimumBoxWidth(text),
        didOrientationChange: false,
      }),
    } as TText;
  });

  return didChange ? nextTexts : texts;
};
