// 단위 변환 유틸리티 (docs/TEMPLATE_SCHEMA.md 변환식 반영)

export const mmToPx = (mm: number, dpi: number): number => {
  return (mm / 25.4) * dpi;
};

export const pxToMm = (px: number, dpi: number): number => {
  return (px * 25.4) / dpi;
};

