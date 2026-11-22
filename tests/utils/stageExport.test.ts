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
  position: (next: { x: number; y: number }) => void;
  x: () => number;
  y: () => number;
  batchDraw: () => void;
  container: () => { isConnected: boolean };
  getLayers: () => unknown[];
  toBlob: (config: BlobRenderConfig) => Promise<Blob | null>;
};

type DisplayTransform = {
  size: { width: number; height: number };
  scale: { x: number; y: number };
  position: { x: number; y: number };
};

const readStageDisplay = (stage: FakeStage): DisplayTransform => ({
  size: { width: stage.width(), height: stage.height() },
  scale: { x: stage.scaleX(), y: stage.scaleY() },
  position: { x: stage.x(), y: stage.y() },
});

function createFakeStage(
  render: (config: BlobRenderConfig) => Promise<Blob | null>,
  isAlive: () => boolean = () => true,
) {
  let width = 480;
  let height = 720;
  let scaleX = 1.5;
  let scaleY = 1.5;
  let positionX = 0;
  let positionY = 0;

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
    position: (next) => {
      positionX = next.x;
      positionY = next.y;
    },
    x: () => positionX,
    y: () => positionY,
    batchDraw: () => {
      batchDrawCalls += 1;
    },
    // 살아 있는 Stage: 문서에 붙은 컨테이너와 레이어 1개 이상. 죽은 Stage: 컨테이너가 떨어지고 레이어가 모두 지워짐
    container: () => ({ isConnected: isAlive() }),
    getLayers: () => (isAlive() ? [{}, {}] : []),
    toBlob: render,
  };

  // 화면이 마지막으로 커밋한 표시 변환. 다시 그리기(commitDisplay)가 Stage 값과 함께 바꿉니다.
  let committedDisplay: DisplayTransform = { size: { width, height }, scale: { x: scaleX, y: scaleY }, position: { x: positionX, y: positionY } };
  const getDisplayTransform = () => committedDisplay;
  const commitDisplay = (next: DisplayTransform) => {
    committedDisplay = next;
    stage.size(next.size);
    stage.scale(next.scale);
    stage.position(next.position);
  };

  return { stage, sizeCalls, scaleCalls, getBatchDrawCalls: () => batchDrawCalls, getDisplayTransform, commitDisplay };
}

test("exportStageToBlob은 toBlob으로 렌더하고 첫 실패 시 낮은 pixelRatio로 한 번만 폴백한다", async () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;

  const blobCalls: BlobRenderConfig[] = [];
  const { stage, sizeCalls, scaleCalls, getBatchDrawCalls, getDisplayTransform } = createFakeStage(async (config) => {
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
      getDisplayTransform,
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
  const { stage, getDisplayTransform } = createFakeStage(async (config) => {
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
      getDisplayTransform,
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
    const { stage, sizeCalls, getDisplayTransform } = createFakeStage(async () => {
      blobCalls += 1;
      return new Blob(["ok"], { type: "image/png" });
    }, () => isAlive);
    const originalBatchDraw = stage.batchDraw;
    stage.batchDraw = () => { originalBatchDraw(); isAlive = false; }; // 기다리는 동안 Stage가 지워진 상황

    const result = await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });

    assert.equal(result, null);
    assert.equal(blobCalls, 0, "죽은 Stage를 캡처했습니다");
    assert.deepEqual(sizeCalls[sizeCalls.length - 1], { width: 480, height: 720 }, "Stage 크기를 되돌리지 않았습니다");
  });
});

test("exportStageToBlob은 컨테이너는 붙어 있어도 레이어가 하나도 없으면 캡처하지 않는다", async () => {
  await withImmediateFrames(async () => {
    let blobCalls = 0;
    const { stage, getDisplayTransform } = createFakeStage(async () => {
      blobCalls += 1;
      return new Blob(["ok"], { type: "image/png" });
    });
    stage.getLayers = () => [];

    assert.equal(await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform }), null);
    assert.equal(blobCalls, 0);
  });
});

test("exportStageToBlob은 낮은 pixelRatio로 다시 렌더하기 전에도 Stage가 살아 있는지 확인한다", async () => {
  await withImmediateFrames(async () => {
    let isAlive = true;
    const blobCalls: BlobRenderConfig[] = [];
    const { stage, getDisplayTransform } = createFakeStage(async (config) => {
      blobCalls.push(config);
      isAlive = false; // 첫 렌더가 실패하는 사이 Stage가 지워짐
      throw new Error("initial render failed");
    }, () => isAlive);

    const result = await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });

    assert.equal(result, null);
    assert.equal(blobCalls.length, 1, "죽은 Stage로 낮은 배율 렌더를 시도했습니다");
  });
});

test("exportStageToBlob은 살아 있는 Stage면 지금처럼 Blob을 돌려준다", async () => {
  await withImmediateFrames(async () => {
    const { stage, getDisplayTransform } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));
    const result = await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
    assert.ok(result instanceof Blob);
  });
});

// UX5-1: 기다리는 사이 화면 맞춤이 Stage 표시 크기·배율을 덮어써도 캡처는 렌더 계획의 크기·배율로 합니다.
const OVERWRITTEN_SIZE = { width: 142, height: 212 };
const OVERWRITTEN_SCALE = { x: 0.2938, y: 0.2938 };
const OVERWRITTEN_DISPLAY: DisplayTransform = { size: OVERWRITTEN_SIZE, scale: OVERWRITTEN_SCALE, position: { x: 0, y: 0 } };

// 기다리는 사이 화면이 다시 그려져 새 표시 변환을 커밋하는 상황입니다.
const withCommittingFrames = async (commitDisplay: (next: DisplayTransform) => void, next: DisplayTransform, run: () => Promise<void>) => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    commitDisplay(next);
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;
  try {
    await run();
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
};

test("exportStageToBlob은 기다리는 사이 Stage 크기·배율이 덮어써져도 캡처 직전에 렌더 계획 값으로 되돌린다", async () => {
  const captured: Array<{ width: number; height: number; scaleX: number; scaleY: number; pixelRatio?: number }> = [];
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async (config) => {
    captured.push({ width: stage.width(), height: stage.height(), scaleX: stage.scaleX(), scaleY: stage.scaleY(), pixelRatio: config.pixelRatio });
    return new Blob(["ok"], { type: "image/png" });
  });

  await withCommittingFrames(commitDisplay, OVERWRITTEN_DISPLAY, async () => {
    const result = await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
    assert.ok(result instanceof Blob);
  });

  assert.deepEqual(captured, [{ width: 480, height: 720, scaleX: 1, scaleY: 1, pixelRatio: 9.8417 }]);
});

test("exportStageToBlob은 낮은 pixelRatio로 다시 렌더할 때도 캡처 직전에 계획 값을 확인한다", async () => {
  const captured: Array<{ width: number; scaleX: number; pixelRatio?: number }> = [];
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async (config) => {
    captured.push({ width: stage.width(), scaleX: stage.scaleX(), pixelRatio: config.pixelRatio });
    if (captured.length === 1) throw new Error("initial render failed");
    return new Blob(["ok"], { type: "image/png" });
  });

  await withCommittingFrames(commitDisplay, OVERWRITTEN_DISPLAY, async () => {
    const result = await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
    assert.ok(result instanceof Blob);
  });

  assert.deepEqual(captured, [
    { width: 480, scaleX: 1, pixelRatio: 9.8417 },
    { width: 480, scaleX: 1, pixelRatio: 6.4 },
  ]);
});

test("exportStageToBlob은 캡처 뒤 Stage를 저장 중 마지막으로 들어온 표시 크기·배율로 돌린다", async () => {
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));

  await withCommittingFrames(commitDisplay, OVERWRITTEN_DISPLAY, async () => {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  });

  assert.deepEqual({ width: stage.width(), height: stage.height() }, OVERWRITTEN_SIZE, "옛 표시 크기로 되돌렸습니다");
  assert.deepEqual({ x: stage.scaleX(), y: stage.scaleY() }, OVERWRITTEN_SCALE, "옛 표시 배율로 되돌렸습니다");
});

test("exportStageToBlob은 덮어쓰기가 없으면 크기·배율을 더 만지지 않고 처음 표시 값으로 돌린다", async () => {
  await withImmediateFrames(async () => {
    const { stage, sizeCalls, scaleCalls, getDisplayTransform } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));

    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });

    assert.equal(sizeCalls.length, 2, "계획 값 설정과 복원 말고 Stage 크기를 더 바꿨습니다");
    assert.equal(scaleCalls.length, 2, "계획 값 설정과 복원 말고 Stage 배율을 더 바꿨습니다");
    assert.deepEqual({ width: stage.width(), height: stage.height() }, { width: 480, height: 720 });
    assert.deepEqual({ x: stage.scaleX(), y: stage.scaleY() }, { x: 1.5, y: 1.5 });
  });
});

// 보정표 D-8: 지우기 모드에서 확대해 Stage 위치가 0이 아니어도 캡처는 원점에서 하고, 끝나면 표시 위치로 돌립니다.
test("exportStageToBlob은 캡처 때 Stage 위치를 원점(0, 0)으로 두고 캡처 뒤 표시 위치로 되돌린다", async () => {
  const capturedPositions: Array<{ x: number; y: number }> = [];
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async () => {
    capturedPositions.push({ x: stage.x(), y: stage.y() });
    return new Blob(["ok"], { type: "image/png" });
  });
  commitDisplay({ ...getDisplayTransform(), position: { x: 37, y: -12 } });

  await withImmediateFrames(async () => {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  });

  assert.deepEqual(capturedPositions, [{ x: 0, y: 0 }], "캡처 때 Stage 위치가 원점이 아닙니다");
  assert.deepEqual({ x: stage.x(), y: stage.y() }, { x: 37, y: -12 }, "처음 표시 위치로 되돌리지 않았습니다");

  // 기다리는 사이 다시 그리기가 위치를 덮어쓰면, 캡처는 원점에서 하고 끝나면 마지막으로 들어온 표시 위치로 돌립니다.
  const OVERWRITTEN_POSITION = { x: 5, y: 9 };
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    commitDisplay({ ...getDisplayTransform(), position: OVERWRITTEN_POSITION });
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;
  try {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }

  assert.deepEqual(capturedPositions, [{ x: 0, y: 0 }, { x: 0, y: 0 }], "덮어쓴 위치로 캡처했습니다");
  assert.deepEqual({ x: stage.x(), y: stage.y() }, OVERWRITTEN_POSITION, "옛 표시 위치로 되돌렸습니다");
});

// 보정표 D-13(ST2-2): 끝나면 호출부가 마지막으로 커밋한 표시 변환을 한 묶음으로 되돌립니다. 값마다 비교해 섞지 않습니다.
const CAPTURE_PLAN_DISPLAY: DisplayTransform = { size: { width: 480, height: 720 }, scale: { x: 1, y: 1 }, position: { x: 0, y: 0 } };

test("exportStageToBlob은 캡처와 PNG 완료 사이에 표시 변환이 바뀌면 최신 표시 변환으로 되돌린다", async () => {
  const LATEST_DISPLAY: DisplayTransform = { size: { width: 160, height: 240 }, scale: { x: 0.3333, y: 0.3333 }, position: { x: 20, y: 10 } };
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async () => {
    commitDisplay(LATEST_DISPLAY); // PNG를 만드는 동안 화면이 다시 그려짐
    return new Blob(["ok"], { type: "image/png" });
  });

  await withImmediateFrames(async () => {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  });

  assert.deepEqual(readStageDisplay(stage), LATEST_DISPLAY);
});

test("exportStageToBlob은 새 표시 변환이 캡처용 값(계획 크기·배율·원점)과 같아도 그 값으로 되돌린다", async () => {
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));
  commitDisplay({ size: OVERWRITTEN_SIZE, scale: OVERWRITTEN_SCALE, position: { x: 20, y: 10 } });

  await withCommittingFrames(commitDisplay, CAPTURE_PLAN_DISPLAY, async () => {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  });

  assert.deepEqual(readStageDisplay(stage), CAPTURE_PLAN_DISPLAY);
});

test("exportStageToBlob은 새 표시 크기만 캡처용 크기와 같고 배율이 달라도 옛 크기와 새 배율을 섞지 않는다", async () => {
  const LATEST_DISPLAY: DisplayTransform = { size: { width: 480, height: 720 }, scale: { x: 0.5, y: 0.5 }, position: { x: 0, y: 0 } };
  const { stage, getDisplayTransform, commitDisplay } = createFakeStage(async () => new Blob(["ok"], { type: "image/png" }));
  commitDisplay(OVERWRITTEN_DISPLAY);

  await withCommittingFrames(commitDisplay, LATEST_DISPLAY, async () => {
    await exportStageToBlob({ frameType: "4v_1", stage, getDisplayTransform });
  });

  assert.deepEqual(readStageDisplay(stage), LATEST_DISPLAY);
});
