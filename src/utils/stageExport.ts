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
  initialMaxWidthPx,
  fallbackMaxWidthPx = 3072,
}: {
  frameType: FrameType;
  stage: StageExportTarget;
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
  const previousSize = { width: stage.width(), height: stage.height() };
  const previousScale = { x: stage.scaleX(), y: stage.scaleY() };
  const planSize = { width: frameLayout.canvasWidth, height: frameLayout.canvasHeight };
  const planScale = { x: 1, y: 1 };
  // 끝난 뒤 돌려놓을 표시 값. 기다리는 사이 화면 맞춤이 새 값을 넣었으면 그 값으로 바뀝니다(UX5-1).
  let displaySize = previousSize;
  let displayScale = previousScale;

  const restoreStage = () => {
    stage.size(displaySize);
    stage.scale(displayScale);
    stage.batchDraw();
  };

  const isStageAtPlan = (): boolean => stage.width() === planSize.width
    && stage.height() === planSize.height
    && stage.scaleX() === planScale.x
    && stage.scaleY() === planScale.y;

  // 마지막 대기 뒤 캡처 직전에 Stage가 살아 있는지 봅니다. 아니면 캡처하지 않고 null(대기)로 끝냅니다. 낮은 배율 재렌더도 같습니다.
  const renderBlob = async (pixelRatio: number): Promise<Blob | null> => {
    stage.size(planSize);
    stage.scale(planScale);
    stage.batchDraw();
    await waitForNextFrame();
    if (!isStageAlive(stage)) return null;

    // 기다리는 사이 화면 맞춤이 표시 크기·배율을 덮어썼으면 그 값을 표시 값으로 기억하고, 계획 값을 그 자리에서 다시 설정합니다.
    // 이 아래에는 await가 없어야 합니다(캡처 전에 또 덮어쓸 틈을 주지 않음).
    if (!isStageAtPlan()) {
      displaySize = { width: stage.width(), height: stage.height() };
      displayScale = { x: stage.scaleX(), y: stage.scaleY() };
      stage.size(planSize);
      stage.scale(planScale);
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
