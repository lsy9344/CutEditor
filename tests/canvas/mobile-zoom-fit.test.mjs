import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("모바일 편집 모드에서는 너비 우선 zoom 계산을 사용한다", () => {
  const source = readFileSync("src/canvas/zoomSizing.ts", "utf8");

  assert.match(source, /fitMode\?: "contain" \| "width"/);
  assert.match(source, /fitMode = "contain"/);
  assert.match(source, /const ratio = fitMode === "width" \? ratioX : Math\.min\(ratioX, ratioY\);/);
});
