import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("3v_1 slot-1 좌표/크기가 기대값과 일치한다", () => {
  const source = readFileSync("src/types/frame.ts", "utf8");

  const pattern =
    /"3v_1":\s*{[\s\S]*?slots:\s*\[[\s\S]*?\{\s*id:\s*"slot-1",\s*x:\s*13,\s*y:\s*13,\s*width:\s*216,\s*height:\s*178\s*}/;

  assert.match(source, pattern);
});
