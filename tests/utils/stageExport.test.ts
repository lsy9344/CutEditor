import test from "node:test";
import assert from "node:assert/strict";

import { exportStageToBlob } from "../../src/utils/stageExport.ts";

type BlobRenderConfig = {
  mimeType?: string;
  pixelRatio?: number;
};

type FakeStage = {
  width: () => number;
  height: () => number;
  size: (next: { width: number; height: number }) => void;
  scale: (next: { x: number; y: number }) => void;
  scaleX: () => number;
  scaleY: () => number;
  batchDraw: () => void;
  toBlob: (config: BlobRenderConfig) => Promise<Blob | null>;
};

function createFakeStage(render: (config: BlobRenderConfig) => Promise<Blob | null>) {
  let width = 480;
  let height = 720;
  let scaleX = 1.5;
  let scaleY = 1.5;

  const sizeCalls: Array<{ width: number; height: number }> = [];
  const scaleCalls: Array<{ x: number; y: number }> = [];
  let batchDrawCalls = 0;

  const stage: FakeStage = {
    width: () => width,
    height: () => height,
    size: (next) => {
      width = next.width;
      height = next.height;
      sizeCalls.push(next);
    },
    scale: (next) => {
      scaleX = next.x;
      scaleY = next.y;
      scaleCalls.push(next);
    },
    scaleX: () => scaleX,
    scaleY: () => scaleY,
    batchDraw: () => {
      batchDrawCalls += 1;
    },
    toBlob: render,
  };

  return { stage, sizeCalls, scaleCalls, getBatchDrawCalls: () => batchDrawCalls };
}

test("exportStageToBlob은 toBlob으로 렌더하고 첫 실패 시 낮은 pixelRatio로 한 번만 폴백한다", async () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;

  const blobCalls: BlobRenderConfig[] = [];
  const { stage, sizeCalls, scaleCalls, getBatchDrawCalls } = createFakeStage(async (config) => {
    blobCalls.push(config);
    if (blobCalls.length === 1) {
      throw new Error("initial render failed");
    }
    return new Blob(["ok"], { type: "image/png" });
  });

  try {
    const blob = await exportStageToBlob({
      frameType: "4v_1",
      stage,
    });

    assert.equal(blob.type, "image/png");
    assert.deepEqual(
      blobCalls,
      [
        { mimeType: "image/png", pixelRatio: 9.8417 },
        { mimeType: "image/png", pixelRatio: 6.4 },
      ],
    );
    assert.deepEqual(sizeCalls, [
      { width: 480, height: 720 },
      { width: 480, height: 720 },
      { width: 480, height: 720 },
    ]);
    assert.deepEqual(scaleCalls, [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1.5, y: 1.5 },
    ]);
    assert.equal(getBatchDrawCalls(), 3);
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

test("exportStageToBlob은 모바일에서 더 낮은 초기 해상도로 시작할 수 있다", async () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;

  const blobCalls: BlobRenderConfig[] = [];
  const { stage } = createFakeStage(async (config) => {
    blobCalls.push(config);
    if (blobCalls.length === 1) {
      throw new Error("initial render failed");
    }
    return new Blob(["ok"], { type: "image/png" });
  });

  try {
    await exportStageToBlob({
      frameType: "4v_1",
      stage,
      initialMaxWidthPx: 3072,
      fallbackMaxWidthPx: 2048,
    });

    assert.deepEqual(
      blobCalls,
      [
        { mimeType: "image/png", pixelRatio: 6.4 },
        { mimeType: "image/png", pixelRatio: 4.2667 },
      ],
    );
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});
