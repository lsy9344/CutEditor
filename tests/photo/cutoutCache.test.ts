import test from "node:test";
import assert from "node:assert/strict";

import {
  getCutoutWorkingCanvas,
  hasCutoutWorkingCanvas,
  pruneCutoutCache,
  peekCutoutConfidence,
  rememberCutoutConfidence,
  setCutoutWorkingCanvas,
} from "../../src/photo/cutoutCache.ts";

function createCanvas(): HTMLCanvasElement {
  return {} as HTMLCanvasElement;
}

test("최근에 쓴 스티커 3개만 남기고 가장 오래 쓴 스티커부터 버린다", () => {
  pruneCutoutCache(new Set());

  setCutoutWorkingCanvas("s1", createCanvas());
  setCutoutWorkingCanvas("s2", createCanvas());
  setCutoutWorkingCanvas("s3", createCanvas());
  getCutoutWorkingCanvas("s1");
  setCutoutWorkingCanvas("s4", createCanvas());

  assert.equal(hasCutoutWorkingCanvas("s1"), true);
  assert.equal(hasCutoutWorkingCanvas("s2"), false);
  assert.equal(hasCutoutWorkingCanvas("s3"), true);
  assert.equal(hasCutoutWorkingCanvas("s4"), true);
});

test("스티커마다 최근 마스크 2개만 두고, 작업 캔버스가 없는 스티커에는 마스크를 넣지 않는다", () => {
  pruneCutoutCache(new Set());

  setCutoutWorkingCanvas("s1", createCanvas());
  const everyone = new Float32Array([0.1, 0.2]);
  const firstPoint = new Float32Array([0.3, 0.4]);
  const secondPoint = new Float32Array([0.5, 0.6]);
  const orphan = new Float32Array([0.7, 0.8]);

  rememberCutoutConfidence("s1", { kind: "everyone" }, everyone);
  rememberCutoutConfidence("s1", { kind: "point", x: 0.1, y: 0.1 }, firstPoint);
  rememberCutoutConfidence("s1", { kind: "point", x: 0.2, y: 0.2 }, secondPoint);
  rememberCutoutConfidence("s9", { kind: "everyone" }, orphan);

  assert.equal(peekCutoutConfidence("s1", { kind: "everyone" }), null);
  assert.deepEqual(
    peekCutoutConfidence("s1", { kind: "point", x: 0.1, y: 0.1 }),
    firstPoint,
  );
  assert.deepEqual(
    peekCutoutConfidence("s1", { kind: "point", x: 0.2, y: 0.2 }),
    secondPoint,
  );
  assert.equal(peekCutoutConfidence("s9", { kind: "everyone" }), null);
  assert.equal(hasCutoutWorkingCanvas("s9"), false);
});

test("남길 스티커 목록에 없는 항목만 캐시에서 지운다", () => {
  pruneCutoutCache(new Set());

  setCutoutWorkingCanvas("s1", createCanvas());
  setCutoutWorkingCanvas("s2", createCanvas());
  pruneCutoutCache(new Set(["s2"]));

  assert.equal(hasCutoutWorkingCanvas("s1"), false);
  assert.equal(hasCutoutWorkingCanvas("s2"), true);
});
