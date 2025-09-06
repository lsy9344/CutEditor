export type FrameType = "2" | "2v" | "4" | "6" | "9";

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

export const FRAME_LAYOUTS: Record<FrameType, FrameLayout> = {
  "2": {
    id: "2",
    name: "2컷 가로",
    imagePath: "/frame/2_v.png", // ASCII 파일명으로 교체
    canvasWidth: 600,
    canvasHeight: 400,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 50, y: 50, width: 200, height: 300 },
      { id: "slot-2", x: 350, y: 50, width: 200, height: 300 }
    ]
  },
  "2v": {
    id: "2v", 
    name: "2컷 세로",
    imagePath: "/frame/2_v.png",
    canvasWidth: 400,
    canvasHeight: 600,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 50, y: 80, width: 300, height: 180 },
      { id: "slot-2", x: 50, y: 340, width: 300, height: 180 }
    ]
  },
  "4": {
    id: "4",
    name: "4컷",
    imagePath: "/frame/9_v.png", // 임시로 9컷 이미지 사용
    canvasWidth: 600,
    canvasHeight: 600,
    frameColor: "#ffffff",
    slots: [
      { id: "slot-1", x: 50, y: 50, width: 200, height: 200 },
      { id: "slot-2", x: 350, y: 50, width: 200, height: 200 },
      { id: "slot-3", x: 50, y: 350, width: 200, height: 200 },
      { id: "slot-4", x: 350, y: 350, width: 200, height: 200 }
    ]
  },
  "6": {
    id: "6",
    name: "6컷",
    imagePath: "/frame/9_v.png", // 임시로 9컷 이미지 사용
    canvasWidth: 600,
    canvasHeight: 900,
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
  "9": {
    id: "9", 
    name: "9컷",
    imagePath: "/frame/9_v.png",
    canvasWidth: 600,
    canvasHeight: 800,
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
