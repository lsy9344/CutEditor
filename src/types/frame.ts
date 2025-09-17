export type FrameType =
  | "1l" | "1f"
  | "2" | "2h" | "2v"
  | "4" | "4v"
  | "6" | "6v"
  | "9" | "9v";

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

// 원본 문서 기준 사이즈
const HORIZONTAL = { width: 719, height: 483 }; // 가로
const VERTICAL = { width: 483, height: 719 };   // 세로 (기본)

export const FRAME_LAYOUTS: Record<FrameType, FrameLayout> = {

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
      { id: "slot-1", x: 9, y: 46, width: 465, height: 276 },
      { id: "slot-2", x: 9, y: 331, width: 465, height: 276 }
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
      { id: "slot-1", x: 30, y: 20, width: 200, height: 300 },
      { id: "slot-2", x: 252, y: 20, width: 200, height: 300 },
      { id: "slot-3", x: 30, y: 340, width: 200, height: 300 },
      { id: "slot-4", x: 252, y: 340, width: 200, height: 300 }
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
  "9v": {
    id: "9v",
    name: "9컷 세로",
    imagePath: "/frame/9_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 20, y: 60, width: 140, height: 180 },
      { id: "slot-2", x: 172, y: 60, width: 140, height: 180 },
      { id: "slot-3", x: 324, y: 60, width: 140, height: 180 },
      { id: "slot-4", x: 20, y: 252, width: 140, height: 180 },
      { id: "slot-5", x: 172, y: 252, width: 140, height: 180 },
      { id: "slot-6", x: 324, y: 252, width: 140, height: 180 },
      { id: "slot-7", x: 20, y: 444, width: 140, height: 180 },
      { id: "slot-8", x: 172, y: 444, width: 140, height: 180 },
      { id: "slot-9", x: 324, y: 444, width: 140, height: 180 }
    ]
  },
  // 호환: "9"는 세로로 매핑
  "9": {
    id: "9",
    name: "9컷",
    imagePath: "/frame/9_v.png",
    canvasWidth: VERTICAL.width,
    canvasHeight: VERTICAL.height,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 80, y: 80, width: 130, height: 130 },
      { id: "slot-2", x: 235, y: 80, width: 130, height: 130 },
      { id: "slot-3", x: 390, y: 80, width: 130, height: 130 },
      { id: "slot-4", x: 80, y: 235, width: 130, height: 130 },
      { id: "slot-5", x: 235, y: 235, width: 130, height: 130 },
      { id: "slot-6", x: 390, y: 235, width: 130, height: 130 },
      { id: "slot-7", x: 80, y: 390, width: 130, height: 130 },
      { id: "slot-8", x: 235, y: 390, width: 130, height: 130 },
      { id: "slot-9", x: 390, y: 390, width: 130, height: 130 }
    ]
  }
};
