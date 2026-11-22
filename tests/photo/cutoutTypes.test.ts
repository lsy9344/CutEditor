import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";
import { getCutoutImagesState, getCutoutTargetKey } from "../../src/photo/cutoutTypes.ts";

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
