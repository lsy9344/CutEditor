export type FrameType =
  | "1l" | "1f"
  | "2" | "2h" | "2v"
  | "3v_1"
  | "4" | "4v" | "4v_1" | "4v_2" | "4v_3" | "4v_4" | "4v_5" | "4v_6"
  | "6" | "6v" | "6v_1" | "6v_2"
  | "8v_1" | "8v_2" | "8v_3"
  | "9" | "9v";

export type FrameOption = {
  value: FrameType;
  label: string;
  image: string; // 기존 팝오버용 이미지 파일명 (갤러리에서도 재활용)
  orientation?: 'vertical' | 'horizontal'; // 방향성 아이콘 노출용
  description?: string; // 부가 설명 텍스트
};

export type SlotPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
};

export type FrameLayout = {
  id: FrameType;
  name: string;
  imagePath: string;
  slots: SlotPosition[];
  canvasWidth: number;
  canvasHeight: number;
  frameColor: string;
};

export type UserImage = {
  id: string;
  file: File;
  url: string;
  slotId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

// 기존 좌표 데이터가 맞춰져 있는 레거시 기준 캔버스
const LEGACY_HORIZONTAL: CanvasSize = { width: 719, height: 483 };
const LEGACY_VERTICAL: CanvasSize = { width: 483, height: 719 };

// 화면/저장 기준으로 사용할 정확한 2:3 캔버스
export const EXACT_HORIZONTAL_CANVAS: CanvasSize = { width: 720, height: 480 };
export const EXACT_VERTICAL_CANVAS: CanvasSize = { width: 480, height: 720 };

const HORIZONTAL = LEGACY_HORIZONTAL;
const VERTICAL = LEGACY_VERTICAL;

const scaleSlotToCanvas = (
  slot: SlotPosition,
  from: CanvasSize,
  to: CanvasSize,
): SlotPosition => {
  const left = Math.round((slot.x / from.width) * to.width);
  const top = Math.round((slot.y / from.height) * to.height);
  const right = Math.round(((slot.x + slot.width) / from.width) * to.width);
  const bottom = Math.round(((slot.y + slot.height) / from.height) * to.height);

  return {
    ...slot,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const normalizeFrameLayout = (layout: FrameLayout): FrameLayout => {
  const from = { width: layout.canvasWidth, height: layout.canvasHeight };
  const to = from.width >= from.height ? EXACT_HORIZONTAL_CANVAS : EXACT_VERTICAL_CANVAS;

  return {
    ...layout,
    canvasWidth: to.width,
    canvasHeight: to.height,
    slots: layout.slots.map((slot) => scaleSlotToCanvas(slot, from, to)),
  };
};

const RAW_FRAME_LAYOUTS: Record<FrameType, FrameLayout> = {

  // 1컷
  "1l": {
    id: "1l",
    name: "1컷 레터링",
    imagePath: "/frame/1_l.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 0, y: 0, width: 483, height: 725 }
    ]
  },

  "1f": {
    id: "1f",
    name: "1컷 프레임",
    imagePath: "/frame/1_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 30, y: 16, width: 420, height: 630 }
    ]
  },

  // 2컷
  "2h": {
    id: "2h",
    name: "2컷 가로",
    imagePath: "/frame/2_h.png",
    canvasWidth: HORIZONTAL.width,
    canvasHeight: HORIZONTAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 16, y: 16, width: 300, height: 452 },
      { id: "slot-2", x: 331, y: 16, width: 300, height: 452 }
    ]
  },
  "2v": {
    id: "2v",
    name: "2컷 세로",
    imagePath: "/frame/2_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 24, y: 46, width: 435, height: 276 },
      { id: "slot-2", x: 24, y: 331, width: 435, height: 276 }
    ]
  },
  // 호환: 키워드 미기재 시 세로로 간주
  "2": {
    id: "2",
    name: "2컷",
    imagePath: "/frame/2_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 8, y: 90, width: 384, height: 200 },
      { id: "slot-2", x: 50, y: 340, width: 300, height: 180 }
    ]
  },

  // 4컷
  /*  "4h": {
      id: "4h",
      name: "4컷 가로",
      imagePath: "/frame/9_v.png",
      canvasWidth: HORIZONTAL.width,
      canvasHeight: HORIZONTAL.height,
      frameColor: "#ffffff",
      slots: [
        { id: "slot-1", x: 50, y: 50, width: 200, height: 200 },
        { id: "slot-2", x: 350, y: 50, width: 200, height: 200 },
        { id: "slot-3", x: 50, y: 250, width: 200, height: 200 },
        { id: "slot-4", x: 350, y: 250, width: 200, height: 200 }
      ]
    },*/
  "4v": {
    id: "4v",
    name: "4컷 세로",
    imagePath: "/frame/4_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
      { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
      { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
      { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
    ]
  },
  // 호환: "4"는 세로로 매핑 (가로/세로 미기재 시 세로 간주)
  "4": {
    id: "4",
    name: "4컷",
    imagePath: "/frame/4_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 9, y: 46, width: 100, height: 200 },
      { id: "slot-2", x: 350, y: 50, width: 200, height: 200 },
      { id: "slot-3", x: 9, y: 331, width: 200, height: 200 },
      { id: "slot-4", x: 350, y: 350, width: 200, height: 200 }
    ]
  },

  // 6컷
  /*"6h": {
    id: "6h",
    name: "6컷 가로",
    imagePath: "/frame/9_v.png",
    canvasWidth: HORIZONTAL.width,
    canvasHeight: HORIZONTAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 50, y: 30, width: 200, height: 140 },
      { id: "slot-2", x: 350, y: 30, width: 200, height: 140 },
      { id: "slot-3", x: 50, y: 180, width: 200, height: 140 },
      { id: "slot-4", x: 350, y: 180, width: 200, height: 140 },
      { id: "slot-5", x: 50, y: 330, width: 200, height: 140 },
      { id: "slot-6", x: 350, y: 330, width: 200, height: 140 }
    ]
  },*/
  "6v": {
    id: "6v",
    name: "6컷 세로",
    imagePath: "/frame/6_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 10, y: 20, width: 224, height: 200 },
      { id: "slot-2", x: 249, y: 20, width: 224, height: 200 },
      { id: "slot-3", x: 10, y: 230, width: 224, height: 200 },
      { id: "slot-4", x: 249, y: 230, width: 224, height: 200 },
      { id: "slot-5", x: 10, y: 440, width: 224, height: 200 },
      { id: "slot-6", x: 249, y: 440, width: 224, height: 200 }
    ]
  },
  // 호환: "6"는 세로로 매핑
  "6": {
    id: "6",
    name: "6컷",
    imagePath: "/frame/9_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 50, y: 50, width: 200, height: 200 },
      { id: "slot-2", x: 350, y: 50, width: 200, height: 200 },
      { id: "slot-3", x: 50, y: 300, width: 200, height: 200 },
      { id: "slot-4", x: 350, y: 300, width: 200, height: 200 },
      { id: "slot-5", x: 50, y: 550, width: 200, height: 200 },
      { id: "slot-6", x: 350, y: 550, width: 200, height: 200 }
    ]
  },

  // 9컷
  /*"9h": {
    id: "9h",
    name: "9컷 가로",
    imagePath: "/frame/9_v.png",
    canvasWidth: HORIZONTAL.width,
    canvasHeight: HORIZONTAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 60, y: 40, width: 180, height: 120 },
      { id: "slot-2", x: 270, y: 40, width: 180, height: 120 },
      { id: "slot-3", x: 480, y: 40, width: 180, height: 120 },
      { id: "slot-4", x: 60, y: 170, width: 180, height: 120 },
      { id: "slot-5", x: 270, y: 170, width: 180, height: 120 },
      { id: "slot-6", x: 480, y: 170, width: 180, height: 120 },
      { id: "slot-7", x: 60, y: 300, width: 180, height: 120 },
      { id: "slot-8", x: 270, y: 300, width: 180, height: 120 },
      { id: "slot-9", x: 480, y: 300, width: 180, height: 120 }
    ]
  },*/
  // 9컷 (기존)
  "9v": {
    id: "9v", name: "9컷 세로", imagePath: "/frame/9_v.png", canvasWidth: VERTICAL.width, canvasHeight: VERTICAL.height, frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 20, y: 60, width: 140, height: 180 }, { id: "slot-2", x: 172, y: 60, width: 140, height: 180 }, { id: "slot-3", x: 324, y: 60, width: 140, height: 180 },
      { id: "slot-4", x: 20, y: 252, width: 140, height: 180 }, { id: "slot-5", x: 172, y: 252, width: 140, height: 180 }, { id: "slot-6", x: 324, y: 252, width: 140, height: 180 },
      { id: "slot-7", x: 20, y: 444, width: 140, height: 180 }, { id: "slot-8", x: 172, y: 444, width: 140, height: 180 }, { id: "slot-9", x: 324, y: 444, width: 140, height: 180 }
    ]
  },
  "9": {
    id: "9", name: "9컷", imagePath: "/frame/9_v.png", canvasWidth: VERTICAL.width, canvasHeight: VERTICAL.height, frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 80, y: 80, width: 130, height: 130 }, { id: "slot-2", x: 235, y: 80, width: 130, height: 130 }, { id: "slot-3", x: 390, y: 80, width: 130, height: 130 },
      { id: "slot-4", x: 80, y: 235, width: 130, height: 130 }, { id: "slot-5", x: 235, y: 235, width: 130, height: 130 }, { id: "slot-6", x: 390, y: 235, width: 130, height: 130 },
      { id: "slot-7", x: 80, y: 390, width: 130, height: 130 }, { id: "slot-8", x: 235, y: 390, width: 130, height: 130 }, { id: "slot-9", x: 390, y: 390, width: 130, height: 130 }
    ]
  },

  // 신규 추가된 컷 지원 (UI 확인용) - 실제 좌표값은 추후 수정 필요
  "3v_1": {
    id: "3v_1",
    name: "3컷 세로 1",
    imagePath: "/frame/3_v_1.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 13, y: 13, width: 216, height: 178 },
      { id: "slot-2", x: 13, y: 196, width: 216, height: 178 },
      { id: "slot-3", x: 13, y: 379, width: 216, height: 178 },
      { id: "slot-4", x: 254, y: 13, width: 216, height: 178 },
      { id: "slot-5", x: 254, y: 196, width: 216, height: 178 },
      { id: "slot-6", x: 254, y: 379, width: 216, height: 178 }
    ]
  },
  "4v_1": {
    id: "4v_1",
    name: "4컷 세로 1",
    imagePath: "/frame/4_v_1.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
      { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
      { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
      { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
    ]
  },
  "4v_2": {
    id: "4v_2",
    name: "4컷 세로 2",
    imagePath: "/frame/4_v_2.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 20, y: 33, width: 215, height: 320 },
      { id: "slot-2", x: 20, y: 361, width: 215, height: 320 },
      { id: "slot-3", x: 248, y: 48, width: 215, height: 320 },
      { id: "slot-4", x: 248, y: 375, width: 215, height: 320 }
    ]
  },
  "4v_3": {
    id: "4v_3",
    name: "4컷 세로 3",
    imagePath: "/frame/4_v_3.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 28, y: 31, width: 201, height: 301 },
      { id: "slot-2", x: 28, y: 353, width: 201, height: 301 },
      { id: "slot-3", x: 254, y: 31, width: 201, height: 301 },
      { id: "slot-4", x: 254, y: 353, width: 201, height: 301 }
    ]
  },
  "4v_4": {
    id: "4v_4",
    name: "4컷 세로 4",
    imagePath: "/frame/4_v_4.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 16, y: 12, width: 208, height: 150 },
      { id: "slot-2", x: 16, y: 177, width: 208, height: 150 },
      { id: "slot-3", x: 16, y: 342, width: 208, height: 150 },
      { id: "slot-4", x: 16, y: 505, width: 208, height: 150 },
      { id: "slot-5", x: 258, y: 12, width: 208, height: 150 },
      { id: "slot-6", x: 258, y: 177, width: 208, height: 150 },
      { id: "slot-7", x: 258, y: 342, width: 208, height: 150 },
      { id: "slot-8", x: 258, y: 505, width: 208, height: 150 }
    ]
  },
  "4v_5": {
    id: "4v_5",
    name: "4컷 세로 5",
    imagePath: "/frame/4_v_5.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 38, y: 28, width: 201, height: 374 },
      { id: "slot-2", x: 20, y: 508, width: 161, height: 180 },
      { id: "slot-3", x: 263, y: 100, width: 204, height: 242 },
      { id: "slot-4", x: 203, y: 434, width: 259, height: 199 }
    ]
  },
  "4v_6": {
    id: "4v_6",
    name: "4컷 세로 6",
    imagePath: "/frame/4_v_6.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 24, y: 38, width: 205, height: 303 },
      { id: "slot-2", x: 24, y: 377, width: 205, height: 303 },
      { id: "slot-3", x: 254, y: 38, width: 205, height: 303 },
      { id: "slot-4", x: 254, y: 377, width: 205, height: 303 }
    ]
  },
  "6v_1": {
    id: "6v_1",
    name: "6컷 세로 1",
    imagePath: "/frame/6_v_1.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 10, y: 20, width: 224, height: 200 },
      { id: "slot-2", x: 249, y: 20, width: 224, height: 200 },
      { id: "slot-3", x: 10, y: 230, width: 224, height: 200 },
      { id: "slot-4", x: 249, y: 230, width: 224, height: 200 },
      { id: "slot-5", x: 10, y: 440, width: 224, height: 200 },
      { id: "slot-6", x: 249, y: 440, width: 224, height: 200 }
    ]
  },
  "6v_2": {
    id: "6v_2",
    name: "6컷 세로 2",
    imagePath: "/frame/6_v_2.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 10, y: 10, width: 228, height: 178 },
      { id: "slot-2", x: 10, y: 195, width: 228, height: 178 },
      { id: "slot-3", x: 10, y: 380, width: 228, height: 178 },
      { id: "slot-4", x: 246, y: 10, width: 228, height: 178 },
      { id: "slot-5", x: 246, y: 195, width: 228, height: 178 },
      { id: "slot-6", x: 246, y: 380, width: 228, height: 178 }
    ]
  },
  "8v_1": {
    id: "8v_1",
    name: "8컷 세로 1",
    imagePath: "/frame/8_v_1.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 26, y: 37, width: 197, height: 158 },
      { id: "slot-2", x: 26, y: 198, width: 197, height: 158 },
      { id: "slot-3", x: 26, y: 359, width: 197, height: 158 },
      { id: "slot-4", x: 26, y: 520, width: 197, height: 158 },
      { id: "slot-5", x: 268, y: 37, width: 197, height: 158 },
      { id: "slot-6", x: 268, y: 198, width: 197, height: 158 },
      { id: "slot-7", x: 268, y: 359, width: 197, height: 158 },
      { id: "slot-8", x: 268, y: 520, width: 197, height: 158 }
    ]
  },
  "8v_2": {
    id: "8v_2",
    name: "8컷 세로 2",
    imagePath: "/frame/8_v_2.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 10, y: 10, width: 228, height: 146 },
      { id: "slot-2", x: 10, y: 162, width: 228, height: 146 },
      { id: "slot-3", x: 10, y: 314, width: 228, height: 146 },
      { id: "slot-4", x: 10, y: 466, width: 228, height: 146 },
      { id: "slot-5", x: 246, y: 10, width: 228, height: 146 },
      { id: "slot-6", x: 246, y: 162, width: 228, height: 146 },
      { id: "slot-7", x: 246, y: 314, width: 228, height: 146 },
      { id: "slot-8", x: 246, y: 466, width: 228, height: 146 }
    ]
  },
  "8v_3": {
    id: "8v_3",
    name: "8컷 세로 3",
    imagePath: "/frame/8_v_3.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 20, y: 20, width: 100, height: 100 },
      { id: "slot-2", x: 140, y: 20, width: 100, height: 100 },
      { id: "slot-3", x: 260, y: 20, width: 100, height: 100 },
      { id: "slot-4", x: 380, y: 20, width: 100, height: 100 },
      { id: "slot-5", x: 20, y: 140, width: 100, height: 100 },
      { id: "slot-6", x: 140, y: 140, width: 100, height: 100 },
      { id: "slot-7", x: 260, y: 140, width: 100, height: 100 },
      { id: "slot-8", x: 380, y: 140, width: 100, height: 100 }
    ]
  }
};

export const FRAME_LAYOUTS: Record<FrameType, FrameLayout> = Object.fromEntries(
  Object.entries(RAW_FRAME_LAYOUTS).map(([frameType, layout]) => [
    frameType,
    normalizeFrameLayout(layout),
  ]),
) as Record<FrameType, FrameLayout>;
