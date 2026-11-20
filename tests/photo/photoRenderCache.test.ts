import test from "node:test";
import assert from "node:assert/strict";

import { applyPresetToEdits, createDefaultPhotoEdits } from "../../src/photo/photoEdits.ts";
import {
  getEditedPhotoCacheStats,
  getEditedPhotoCanvas,
  pruneEditedPhotoCanvases,
} from "../../src/photo/photoRenderCache.ts";

type FakeCanvas = {
  width: number;
  height: number;
  getContext: (kind: string) => unknown;
};

let getImageDataCalls = 0;

const createFakeCanvas = (): FakeCanvas => ({
  width: 0,
  height: 0,
  getContext: () => ({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      getImageDataCalls += 1;
      return {
        data: new Uint8ClampedArray(width * height * 4),
      };
    },
    putImageData: () => {},
  }),
});

class FakeImageElement {
  naturalWidth: number;
  naturalHeight: number;

  constructor(naturalWidth: number, naturalHeight: number) {
    this.naturalWidth = naturalWidth;
    this.naturalHeight = naturalHeight;
  }
}

const documentStub = { createElement: () => createFakeCanvas() };
(globalThis as unknown as { document: unknown }).document = documentStub;
(globalThis as unknown as { HTMLImageElement: unknown }).HTMLImageElement = FakeImageElement;

const makeSource = (width: number, height: number) => new FakeImageElement(width, height) as unknown as HTMLImageElement;
const monoEdits = () => applyPresetToEdits(createDefaultPhotoEdits(), "mono");

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
