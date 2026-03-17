import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("모바일 편집 판정은 화면 폭을 우선하고 maxTouchPoints 단독 사용을 피한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /return viewportWidth <= 768 \|\| \(hasCoarsePointer && viewportWidth <= 1024\);/
  );
  assert.doesNotMatch(source, /navigator\.maxTouchPoints/);
  assert.doesNotMatch(source, /touchPoints > 0/);
});
