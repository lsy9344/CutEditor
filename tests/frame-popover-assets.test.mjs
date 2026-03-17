import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("1컷 첫 번째 버튼 팝오버 자산이 실제 파일과 일치한다", () => {
  const source = readFileSync("src/ui/SidebarLeft.tsx", "utf8");
  const match = source.match(/\{\s*value:\s*"1l",\s*label:\s*"사진에 글씨새기기",\s*image:\s*"([^"]+)"/);

  assert.ok(match);
  assert.equal(existsSync(`public/popover/${match[1]}`), true);
});
