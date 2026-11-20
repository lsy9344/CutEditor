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
  container: () => { isConnected: boolean };
  getLayers: () => unknown[];
  toBlob: (config: BlobRenderConfig) => Promise<Blob | null>;
};

function createFakeStage(
  render: (config: BlobRenderConfig) => Promise<Blob | null>,
  isAlive: () => boolean = () => true,
) {
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
    // 살아 있는 Stage: 문서에 붙은 컨테이너와 레이어 1개 이상. 죽은 Stage: 컨테이너가 떨어지고 레이어가 모두 지워짐
    container: () => ({ isConnected: isAlive() }),
    getLayers: () => (isAlive() ? [{}, {}] : []),
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

    assert.ok(blob, "Stage가 살아 있는데 null을 돌려줬습니다");
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

const withImmediateFrames = async (run: () => Promise<void>) => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;
  try {
    await run();
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
};

// UX4-1: 마지막 대기 뒤 Stage가 사라졌으면 캡처하지 않고 null(대기)로 끝냅니다. 레이어가 빈 투명 PNG를 만들지 않습니다.
test("exportStageToBlob은 마지막 대기 뒤 Stage의 컨테이너가 문서에서 떨어졌으면 캡처하지 않고 null을 돌려준다", async () => {
  await withImmediateFrames(async () => {
    let isAlive = true;
    let blobCalls = 0;
    const { stage, sizeCalls } = createFakeStage(async () => {
      blobCalls += 1;
      return new Blob(["ok"], { type: "image/png" });
    }, () => isAlive);
    const originalBatchDraw = stage.batchDraw;
    stage.batchDraw = () => { originalBatchDraw(); isAlive = false; }; // 기다리는 동안 Stage가 지워진 상황

    const result = await exportStageToBlob({ frameType: "4v_1", stage });

    assert.equal(result, null);
    assert.equal(blobCalls, 0, "죽은 Stage를 캡처했습니다");
    assert.deepEqual(sizeCalls[sizeCalls.length - 1], { width: 480, height: 720 }, "Stage 크기를 되돌리지 않았습니다");
  });
});

test("exportStageToBlob은 컨테이너는 붙어 있어도 레이어가 하나도 없으면 캡처하지 않는다", async () => {
  await withImmediateFrames(async () => {
    let blobCalls = 0;
    const { stage } = createFakeStage(async () => {
      blobCalls += 1;
      return new Blob(["ok"], { type: "image/png" });
    });
    stage.getLayers = () => [];

    assert.equal(await exportStageToBlob({ frameType: "4v_1", stage }), null);
    assert.equal(blobCalls, 0);
  });
});

test("exportStageToBlob은 낮은 pixelRatio로 다시 렌더하기 전에도 Stage가 살아 있는지 확인한다", async () => {
  await withImmediateFrames(async () => {
    let isAlive = true;
    const blobCalls: BlobRenderConfig[] = [];
    const { stage } = createFakeStage(async (config) => {
      blobCalls.push(config);
      isAlive = false; // 첫 렌더가 실패하는 사이 Stage가 지워짐
      throw new Error("initial render failed");
    }, () => isAlive);

    const result = await exportStageToBlob({ frameType: "4v_1", stage });

    assert.equal(result, null);
    assert.equal(blobCalls.length, 1, "죽은 Stage로 낮은 배율 렌더를 시도했습니다");
  });
});

test("exportStageToBlob은 살아 있는 Stage면 지금처럼 Blob을 돌려준다", async () => {
  await withImmediateFrames(async () => {
    const { stage } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));
    const result = await exportStageToBlob({ frameType: "4v_1", stage });
    assert.ok(result instanceof Blob);
  });
});
