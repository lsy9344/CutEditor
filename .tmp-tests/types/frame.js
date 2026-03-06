// 원본 문서 기준 사이즈
const HORIZONTAL = { width: 719, height: 483 }; // 가로
const VERTICAL = { width: 483, height: 719 }; // 세로 (기본)
export const FRAME_LAYOUTS = {
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
            { id: "slot-1", x: 50, y: 50, width: 383, height: 180 },
            { id: "slot-2", x: 50, y: 250, width: 383, height: 180 },
            { id: "slot-3", x: 50, y: 450, width: 383, height: 180 }
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
            { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
            { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
            { id: "slot-3", x: 17, y: 365, width: 217, height: 325 },
            { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
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
            { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
            { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
            { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
            { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
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
            { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
            { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
            { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
            { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
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
            { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
            { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
            { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
            { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
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
            { id: "slot-1", x: 32, y: 20, width: 205, height: 305 },
            { id: "slot-2", x: 245, y: 20, width: 205, height: 305 },
            { id: "slot-3", x: 32, y: 335, width: 205, height: 305 },
            { id: "slot-4", x: 245, y: 335, width: 205, height: 305 }
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
            { id: "slot-1", x: 10, y: 20, width: 224, height: 200 },
            { id: "slot-2", x: 249, y: 20, width: 224, height: 200 },
            { id: "slot-3", x: 10, y: 230, width: 224, height: 200 },
            { id: "slot-4", x: 249, y: 230, width: 224, height: 200 },
            { id: "slot-5", x: 10, y: 440, width: 224, height: 200 },
            { id: "slot-6", x: 249, y: 440, width: 224, height: 200 }
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
            { id: "slot-1", x: 22, y: 47, width: 197, height: 157 },
            { id: "slot-2", x: 22, y: 209, width: 197, height: 157 },
            { id: "slot-3", x: 22, y: 371, width: 197, height: 157 },
            { id: "slot-4", x: 22, y: 533, width: 197, height: 157 },
            { id: "slot-5", x: 264, y: 47, width: 197, height: 157 },
            { id: "slot-6", x: 264, y: 209, width: 197, height: 157 },
            { id: "slot-7", x: 264, y: 371, width: 197, height: 157 },
            { id: "slot-8", x: 264, y: 533, width: 197, height: 157 }
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
            { id: "slot-1", x: 20, y: 20, width: 100, height: 100 },
            { id: "slot-2", x: 140, y: 20, width: 100, height: 100 },
            { id: "slot-3", x: 260, y: 20, width: 100, height: 100 },
            { id: "slot-4", x: 380, y: 20, width: 100, height: 100 },
            { id: "slot-5", x: 20, y: 140, width: 100, height: 100 },
            { id: "slot-6", x: 140, y: 140, width: 100, height: 100 },
            { id: "slot-7", x: 260, y: 140, width: 100, height: 100 },
            { id: "slot-8", x: 380, y: 140, width: 100, height: 100 }
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
