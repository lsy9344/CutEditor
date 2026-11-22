import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";
import { getCutoutImagesState, getCutoutTargetKey } from "../../src/photo/cutoutTypes.ts";
import type { CutoutSource } from "../../src/photo/cutoutTypes.ts";
import type { BrushStroke } from "../../src/photo/photoEdits.ts";

test("#12 getCutoutTargetKey는 모두 함께와 지점을 구분한다", () => {
  assert.equal(getCutoutTargetKey({ kind: "everyone" }), "everyone");
  assert.equal(getCutoutTargetKey({ kind: "point", x: 0.4, y: 0.25 }), "point:0.4000:0.2500");
});

test("#13 CUTOUT_COPY는 2단계 설계 6장의 문구를 쓴다", () => {
  assert.equal(CUTOUT_COPY.pickOne, "눌러서 고르기");
  assert.equal(CUTOUT_COPY.notFound, "스티커로 만들 것을 사진에서 눌러 주세요");
  assert.equal(
    CUTOUT_COPY.missingStickers(2),
    "불러오지 못한 스티커 2개는 저장 그림에 들어가지 않아요.",
  );
});

test("#19 getCutoutImagesState는 옛 src의 실패를 새 src의 결과로 치지 않는다", () => {
  assert.deepEqual(
    getCutoutImagesState([{ id: "s1", src: "blob:A", loadedSrc: null, failedSrc: "blob:A" }]),
    { kind: "failed", stickerIds: ["s1"] },
  );
  assert.deepEqual(
    getCutoutImagesState([{ id: "s1", src: "blob:B", loadedSrc: null, failedSrc: "blob:A" }]),
    { kind: "loading" },
  );
  assert.deepEqual(
    getCutoutImagesState([{ id: "s1", src: "blob:B", loadedSrc: "blob:B", failedSrc: "blob:A" }]),
    { kind: "ready" },
  );
});

test("#20 getCutoutImagesState는 읽는 중을 실패보다 먼저 본다", () => {
  assert.deepEqual(getCutoutImagesState([]), { kind: "ready" });
  assert.deepEqual(
    getCutoutImagesState([
      { id: "s1", src: "blob:A", loadedSrc: null, failedSrc: "blob:A" },
      { id: "s2", src: "blob:C", loadedSrc: null, failedSrc: null },
    ]),
    { kind: "loading" },
  );
  assert.deepEqual(
    getCutoutImagesState([
      { id: "s1", src: "blob:A", loadedSrc: null, failedSrc: "blob:A" },
      { id: "s2", src: "blob:C", loadedSrc: "blob:C", failedSrc: null },
    ]),
    { kind: "failed", stickerIds: ["s1"] },
  );
  assert.deepEqual(
    getCutoutImagesState([
      { id: "s1", src: "blob:B", loadedSrc: "blob:A", failedSrc: null },
    ]),
    { kind: "loading" },
  );
});

test("#25 종류와 clip이 있는 획과 없는 옛 획은 JSON 왕복 뒤에도 같다", () => {
  const source: CutoutSource = {
    sourceImageId: "img-1",
    target: { kind: "everyone" },
    outline: false,
    eraseStrokes: [
      { points: [0.1, 0.1], radius: 0.02 },
      { points: [0.2, 0.3, 0.25, 0.35], radius: 0.03, action: "erase" },
      { points: [0.4, 0.5], radius: 0.01, action: "restore", clip: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 } },
    ],
    crop: { x: 10, y: 20, width: 300, height: 400 },
    workingSize: { width: 1000, height: 800 },
  };

  assert.deepEqual(JSON.parse(JSON.stringify(source)), source);

  // @ts-expect-error 사진 지우개 획에는 종류가 없습니다.
  const photoStroke: BrushStroke = { points: [0.5, 0.5], radius: 0.01, action: "erase" };
  assert.equal(photoStroke.points.length, 2);
});
