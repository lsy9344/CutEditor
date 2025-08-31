# State Model (TypeScript)

type Mm = number;
type Dpi = 600;

export type Template = {
  id: string;
  name: string;
  canvas: {
    width_mm: Mm;
    height_mm: Mm;
    dpi: Dpi;          // MVP는 600 고정
    bleed_mm: Mm;
    safe_mm: Mm;
    background: string; // #ffffff
  };
  overlay: string;      // /overlays/..png
  slots: Slot[];
  texts: TextBox[];
};

export type Slot = {
  id: string;
  x_mm: Mm;
  y_mm: Mm;
  w_mm: Mm;
  h_mm: Mm;
  rotation: number;
  mode: "fill" | "contain" | "cover";
  image?: PlacedImage;
};

export type PlacedImage = {
  fileName: string;
  objectUrl: string;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type TextBox = {
  id: string;
  x_mm: Mm;
  y_mm: Mm;
  w_mm: Mm;
  h_mm: Mm;
  align: "left"|"center"|"right";
  style: {
    font: string;     // Noto Sans KR
    size_pt: number;  // 8~48
    italic_deg: number; // -20~+20
    letter: number;   // 자간
    line: number;     // 행간 배수
    stroke?: { width: number; color: string };
    shadow?: { blur: number; offsetX: number; offsetY: number; color: string };
  };
  value: string;
};