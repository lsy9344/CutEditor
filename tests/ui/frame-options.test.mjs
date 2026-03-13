import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("8컷 옵션 목록에서 8컷 세로 3은 제거되어야 한다", () => {
  const source = readFileSync("src/ui/SidebarLeft.tsx", "utf8");

  assert.match(source, /"8컷": \[/);
  assert.doesNotMatch(source, /value:\s*"8v_3"/);
  assert.doesNotMatch(source, /label:\s*"8컷 세로 3"/);
});
