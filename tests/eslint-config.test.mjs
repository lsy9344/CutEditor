import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("eslint 설정은 작업용 보조 폴더를 무시한다", () => {
  const source = readFileSync("eslint.config.mjs", "utf8");

  assert.match(source, /"\*\*\/\.agent\/\*\*"/);
  assert.match(source, /"\*\*\/\.tmp-tests\/\*\*"/);
});

test("eslint 설정은 scripts와 tests의 mjs 파일에 Node 전역을 적용한다", () => {
  const source = readFileSync("eslint.config.mjs", "utf8");

  assert.match(source, /"\*\*\/\{scripts,config\}\/\*\*\/\*\.\{js,cjs,mjs,ts\}"/);
  assert.match(source, /"\*\*\/tests\/\*\*\/\*\.\{js,cjs,mjs,ts\}"/);
});
