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
  toBlob: (config: BlobRenderConfig) => Promise<unknown>;
};

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
}): Promise<Blob> {
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

  const restoreStage = () => {
    stage.size(previousSize);
    stage.scale(previousScale);
    stage.batchDraw();
  };

  const renderBlob = async (pixelRatio: number) => {
    stage.size({ width: frameLayout.canvasWidth, height: frameLayout.canvasHeight });
    stage.scale({ x: 1, y: 1 });
    stage.batchDraw();
    await waitForNextFrame();

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
