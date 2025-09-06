// 상태/도메인 타입 정의 (docs/STATE_MODEL.md 반영)

export type Mm = number;
export type Dpi = 600;

export type Template = {
  id: string;
  name: string;
  canvas: {
    width_mm: Mm;
    height_mm: Mm;
    dpi: Dpi;
    bleed_mm: Mm;
    safe_mm: Mm;
    background: string;
  };
  overlay: string;
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
};

export type TextBox = {
  id: string;
  x_mm: Mm;
  y_mm: Mm;
  w_mm: Mm;
  h_mm: Mm;
  align: "left" | "center" | "right";
  style: {
    font: string;
    size_pt: number;
    italic_deg: number;
    letter: number;
    line: number;
    stroke?: { width: number; color: string };
    shadow?: { blur: number; offsetX: number; offsetY: number; color: string };
  };
  value: string;
};

