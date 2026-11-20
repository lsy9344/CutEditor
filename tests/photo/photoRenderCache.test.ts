import test from "node:test";
import assert from "node:assert/strict";

import type { BrushStroke } from "../../src/photo/photoEdits.ts";
import { applyPresetToEdits, createDefaultPhotoEdits } from "../../src/photo/photoEdits.ts";
import {
  getEditedPhotoCacheStats,
  getEditedPhotoCanvas,
  pruneEditedPhotoCanvases,
} from "../../src/photo/photoRenderCache.ts";

type FakeImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

class FakeCanvas {
  width = 0;
  height = 0;
  data = new Uint8ClampedArray(0);

  ensureSize(): void {
    const length = this.width * this.height * 4;
    if (this.data.length !== length) this.data = new Uint8ClampedArray(length);
  }

  getContext(kind: string): FakeContext | null {
    return kind === "2d" ? new FakeContext(this) : null;
  }
}

class FakeImageElement {
  naturalWidth: number;
  naturalHeight: number;
  data: Uint8ClampedArray;

  constructor(naturalWidth: number, naturalHeight: number, data: Uint8ClampedArray) {
    this.naturalWidth = naturalWidth;
    this.naturalHeight = naturalHeight;
    this.data = data;
  }
}

class FakeContext {
  canvas: FakeCanvas;

  constructor(canvas: FakeCanvas) {
    this.canvas = canvas;
  }

  drawImage(
    source: FakeCanvas | FakeImageElement,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void {
    const sourceWidth = source instanceof FakeCanvas ? source.width : source.naturalWidth;
    const sourceHeight = source instanceof FakeCanvas ? source.height : source.naturalHeight;
    const targetWidth = dw === undefined ? sourceWidth : dw;
    const targetHeight = dh === undefined ? sourceHeight : dh;
    this.canvas.ensureSize();

    for (let y = 0; y < targetHeight; y += 1) {
      const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
      const targetY = dy + y;
      if (targetY < 0 || targetY >= this.canvas.height) continue;
      for (let x = 0; x < targetWidth; x += 1) {
        const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
        const targetX = dx + x;
        if (targetX < 0 || targetX >= this.canvas.width) continue;
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
        const targetIndex = (targetY * this.canvas.width + targetX) * 4;
        this.canvas.data[targetIndex] = source.data[sourceIndex];
        this.canvas.data[targetIndex + 1] = source.data[sourceIndex + 1];
        this.canvas.data[targetIndex + 2] = source.data[sourceIndex + 2];
        this.canvas.data[targetIndex + 3] = source.data[sourceIndex + 3];
      }
    }
  }

  getImageData(x: number, y: number, width: number, height: number): FakeImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    const canvasWidth = this.canvas.width;
    for (let row = 0; row < height; row += 1) {
      const sourceStart = ((y + row) * canvasWidth + x) * 4;
      const targetStart = row * width * 4;
      data.set(this.canvas.data.subarray(sourceStart, sourceStart + width * 4), targetStart);
    }
    return { data, width, height };
  }

  putImageData(imageData: FakeImageData, x: number, y: number): void {
    const canvasWidth = this.canvas.width;
    for (let row = 0; row < imageData.height; row += 1) {
      const targetStart = ((y + row) * canvasWidth + x) * 4;
      const sourceStart = row * imageData.width * 4;
      this.canvas.data.set(
        imageData.data.subarray(sourceStart, sourceStart + imageData.width * 4),
        targetStart,
      );
    }
  }
}

let getImageDataCalls = 0;

const documentStub = {
  createElement: () => {
    const canvas = new FakeCanvas();
    const getContext = canvas.getContext.bind(canvas);
    canvas.getContext = (kind: string) => {
      const context = getContext(kind);
      if (!context) return null;
      const getImageData = context.getImageData.bind(context);
      context.getImageData = (x: number, y: number, width: number, height: number) => {
        getImageDataCalls += 1;
        return getImageData(x, y, width, height);
      };
      return context;
    };
    return canvas;
  },
};
(globalThis as unknown as { document: unknown }).document = documentStub;
(globalThis as unknown as { HTMLImageElement: unknown }).HTMLImageElement = FakeImageElement;

const makeSource = (width: number, height: number) =>
  new FakeImageElement(width, height, new Uint8ClampedArray(width * height * 4)) as unknown as HTMLImageElement;

const makeStripeSource = (width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const isRed = (x + Math.floor(y / 5)) % 19 < 9;
      data[index] = isRed ? 255 : 0;
      data[index + 1] = isRed ? 0 : 255;
      data[index + 2] = isRed ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return new FakeImageElement(width, height, data) as unknown as HTMLImageElement;
};

const monoEdits = () => applyPresetToEdits(createDefaultPhotoEdits(), "mono");

function assertSamePixels(expected: Uint8ClampedArray, actual: Uint8ClampedArray): void {
  assert.equal(actual.length, expected.length);
  let differentPixels = 0;
  let firstDifference = -1;
  for (let index = 0; index < expected.length; index += 4) {
    if (
      expected[index] !== actual[index]
      || expected[index + 1] !== actual[index + 1]
      || expected[index + 2] !== actual[index + 2]
      || expected[index + 3] !== actual[index + 3]
    ) {
      differentPixels += 1;
      if (firstDifference < 0) firstDifference = index / 4;
    }
  }
  assert.equal(
    differentPixels,
    0,
    `다른 픽셀 ${differentPixels}개, 첫 번째 인덱스 ${firstDifference}`,
  );
}

test("기본값이 된 사진은 렌더 캐시에서 결과와 작업용 캔버스를 함께 지운다", () => {
  pruneEditedPhotoCanvases(new Set(), null);
  const source = makeSource(800, 1200);
  const canvas = getEditedPhotoCanvas("img-1", source, monoEdits(), 4096, true);

  assert.ok(canvas);
  assert.deepEqual(getEditedPhotoCacheStats(), [
    { imageId: "img-1", width: 800, height: 1200, hasBase: true },
  ]);

  pruneEditedPhotoCanvases(new Set(["img-1"]), "img-1", new Set());

  assert.deepEqual(getEditedPhotoCacheStats(), []);
});

test("보정이 남은 사진은 선택이 바뀌어도 결과를 유지하고 작업용 캔버스만 지운다", () => {
  pruneEditedPhotoCanvases(new Set(), null);
  const source = makeSource(800, 1200);
  getEditedPhotoCanvas("img-1", source, monoEdits(), 4096, true);
  getEditedPhotoCanvas("img-2", source, monoEdits(), 4096, true);

  pruneEditedPhotoCanvases(new Set(["img-1", "img-2"]), "img-2", new Set(["img-1", "img-2"]));

  assert.deepEqual(getEditedPhotoCacheStats(), [
    { imageId: "img-1", width: 800, height: 1200, hasBase: false },
    { imageId: "img-2", width: 800, height: 1200, hasBase: true },
  ]);
});

test("보정이 기본값이면 지우기 결과 캔버스를 그대로 쓰고 보정 단계를 다시 읽지 않는다", () => {
  pruneEditedPhotoCanvases(new Set(), null);
  const source = makeSource(800, 1200);
  const edits = {
    ...createDefaultPhotoEdits(),
    erase: [{ points: [0.5, 0.5], radius: 0.01 }],
  };
  getImageDataCalls = 0;

  const canvas = getEditedPhotoCanvas("img-erase", source, edits, 4096, true);

  assert.ok(canvas);
  assert.equal(getImageDataCalls, 1);
  assert.deepEqual(getEditedPhotoCacheStats(), [
    { imageId: "img-erase", width: 800, height: 1200, hasBase: true },
  ]);
});

test("짧은 변이 1px로 잘려야 하는 극단 비율 사진은 렌더 실패로 보고 캐시에 남기지 않는다", () => {
  pruneEditedPhotoCanvases(new Set(), null);
  const source = makeSource(1, 8193);
  const canvas = getEditedPhotoCanvas("img-extreme", source, monoEdits(), 4096, false);

  assert.equal(canvas, null);
  assert.deepEqual(getEditedPhotoCacheStats(), []);
});

// P3-6 재현 입력: 400×300 줄무늬 PNG, 너비의 0.13 반지름, 이어지는 두 획과 떨어진 셋째 획.
const p36Strokes: BrushStroke[] = [
  { points: [0.13, 0.19, 0.87, 0.19], radius: 0.13 },
  { points: [0.13, 0.19, 0.13, 0.81], radius: 0.13 },
  {
    points: [0.43485886269062757, 0.6042529325382785, 0.6048588626906276, 0.6042529325382785],
    radius: 0.13,
  },
];

test("P3-6 제품 캐시는 한 획씩 그린 결과와 한 번에 그린 결과가 픽셀 단위로 같다", () => {
  pruneEditedPhotoCanvases(new Set(), null);
  const source = makeStripeSource(400, 300);
  const defaultEdits = createDefaultPhotoEdits();
  let sequential: FakeCanvas | null = null;

  for (let count = 1; count <= p36Strokes.length; count += 1) {
    sequential = getEditedPhotoCanvas(
      "codex-sequential",
      source,
      { ...defaultEdits, erase: p36Strokes.slice(0, count) },
      4096,
      true,
    ) as unknown as FakeCanvas | null;
  }

  const atOnce = getEditedPhotoCanvas(
    "codex-at-once",
    source,
    { ...defaultEdits, erase: p36Strokes },
    4096,
    true,
  ) as unknown as FakeCanvas | null;

  assert.ok(sequential);
  assert.ok(atOnce);
  assert.equal(sequential.width, 400);
  assert.equal(sequential.height, 300);
  assertSamePixels(sequential.data, atOnce.data);
});
