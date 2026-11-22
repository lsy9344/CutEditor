import { FRAME_LAYOUTS, type FrameType } from "../types/frame.ts";
import { getExportRenderPlan } from "./exportBehavior.ts";

type StageSize = {
  width: number;
  height: number;
};

type StageScale = {
  x: number;
  y: number;
};

type StagePosition = {
  x: number;
  y: number;
};

// 화면에 보이는 Stage의 크기·배율·위치를 한 묶음으로 다룹니다(보정표 D-13).
export type StageDisplayTransform = {
  size: StageSize;
  scale: StageScale;
  position: StagePosition;
};

type BlobRenderConfig = {
  mimeType?: string;
  pixelRatio?: number;
};

export type StageExportTarget = {
  width: () => number;
  height: () => number;
  size: (next: StageSize) => void;
  scale: (next: StageScale) => void;
  scaleX: () => number;
  scaleY: () => number;
  position: (next: StagePosition) => void;
  x: () => number;
  y: () => number;
  batchDraw: () => void;
  container: () => { isConnected: boolean };
  getLayers: () => ReadonlyArray<unknown>;
  toBlob: (config: BlobRenderConfig) => Promise<unknown>;
};

// 컨테이너가 문서에서 떨어졌거나 레이어가 모두 지워진 Stage는 투명한 PNG만 만듭니다(UX4-1).
const isStageAlive = (stage: StageExportTarget): boolean => stage.container().isConnected && stage.getLayers().length > 0;

const waitForNextFrame = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => resolve());
    return;
  }

  setTimeout(resolve, 0);
});

export async function exportStageToBlob({
  frameType,
  stage,
  getDisplayTransform,
  initialMaxWidthPx,
  fallbackMaxWidthPx = 3072,
}: {
  frameType: FrameType;
  stage: StageExportTarget;
  // 화면이 마지막으로 커밋한 표시 변환. 비어 있으면 저장을 시작할 때의 Stage 값으로 되돌립니다.
  getDisplayTransform: () => StageDisplayTransform | null;
  initialMaxWidthPx?: number;
  fallbackMaxWidthPx?: number;
}): Promise<Blob | null> {
  const frameLayout = FRAME_LAYOUTS[frameType];
  const renderPlan = getExportRenderPlan({
    frameType,
    logicalCanvasWidth: frameLayout.canvasWidth,
    logicalCanvasHeight: frameLayout.canvasHeight,
    initialMaxWidthPx,
    fallbackMaxWidthPx,
  });
  const startDisplay: StageDisplayTransform = {
    size: { width: stage.width(), height: stage.height() },
    scale: { x: stage.scaleX(), y: stage.scaleY() },
    position: { x: stage.x(), y: stage.y() },
  };
  const planSize = { width: frameLayout.canvasWidth, height: frameLayout.canvasHeight };
  const planScale = { x: 1, y: 1 };
  // 지우기 모드 확대로 Stage가 옮겨져 있어도 캡처는 원점에서 합니다(보정표 D-8).
  const planPosition = { x: 0, y: 0 };

  // 기다리는 사이 화면이 다시 그려졌을 수 있으니 끝날 때 최신 표시 변환을 한 묶음으로 읽어 되돌립니다(UX5-1, 보정표 D-13).
  const restoreStage = () => {
    const display = getDisplayTransform() ?? startDisplay;
    stage.size(display.size);
    stage.scale(display.scale);
    stage.position(display.position);
    stage.batchDraw();
  };

  const isStageAtPlan = (): boolean => stage.width() === planSize.width && stage.height() === planSize.height
    && stage.scaleX() === planScale.x && stage.scaleY() === planScale.y
    && stage.x() === planPosition.x && stage.y() === planPosition.y;

  // 마지막 대기 뒤 캡처 직전에 Stage가 살아 있는지 봅니다. 아니면 캡처하지 않고 null(대기)로 끝냅니다. 낮은 배율 재렌더도 같습니다.
  const renderBlob = async (pixelRatio: number): Promise<Blob | null> => {
    stage.size(planSize);
    stage.scale(planScale);
    stage.position(planPosition);
    stage.batchDraw();
    await waitForNextFrame();
    if (!isStageAlive(stage)) return null;

    // 기다리는 사이 다시 그리기가 표시 크기·배율·위치를 덮어썼으면 계획 값을 그 자리에서 다시 설정합니다.
    // 이 아래에는 await가 없어야 합니다(캡처 전에 또 덮어쓸 틈을 주지 않음).
    if (!isStageAtPlan()) {
      stage.size(planSize);
      stage.scale(planScale);
      stage.position(planPosition);
    }

    const blobResult = await stage.toBlob({
      mimeType: "image/png",
      pixelRatio,
    });

    if (!(blobResult instanceof Blob)) {
      throw new Error("PNG Blob 생성에 실패했습니다.");
    }

    return blobResult;
  };

  try {
    try {
      return await renderBlob(renderPlan.initialPixelRatio);
    } catch (initialError) {
      if (renderPlan.fallbackPixelRatio == null) {
        throw initialError;
      }

      return await renderBlob(renderPlan.fallbackPixelRatio);
    }
  } finally {
    restoreStage();
  }
}
