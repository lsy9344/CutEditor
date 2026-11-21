import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";
import { getCutoutImagesState, getCutoutTargetKey } from "../../src/photo/cutoutTypes.ts";

test("#12 getCutoutTargetKey는 모두 함께와 지점을 구분한다", () => {
  assert.equal(getCutoutTargetKey({ kind: "everyone" }), "everyone");
  assert.equal(getCutoutTargetKey({ kind: "point", x: 0.4, y: 0.25 }), "point:0.4000:0.2500");
});

test("#13 CUTOUT_COPY는 설계 6.4·6.6의 문구를 쓴다", () => {
  assert.equal(CUTOUT_COPY.pickOne, "한 사람만 고르기");
  assert.equal(CUTOUT_COPY.notFound, "사람을 찾지 못했어요. 사람이 크게 나온 사진으로 해 보세요.");
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
