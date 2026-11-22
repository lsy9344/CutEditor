import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const canvasSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

// '바닥 얼룩 지우기'로 바꾼 뒤 옛 사용자 문구가 돌아오지 않게 봅니다. 위치·크기·primary 수는 브라우저 확인(A1-01~A1-03)이 잽니다.
test("옛 얼룩 지우기 문구가 없다", () => {
  const oldPatterns: Array<RegExp | string> = [/>\s*얼룩 지우기\s*</, "사진 보정</h4>", "지울 곳을 손가락"];
  for (const pattern of oldPatterns) {
    const isFound = typeof pattern === "string" ? canvasSource.includes(pattern) : pattern.test(canvasSource);
    assert.ok(!isFound, `CanvasStage에 옛 문구가 남아 있습니다: ${pattern}`);
  }
});
