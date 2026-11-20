import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/components/components.css", "utf8");

const getFirstRule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} 규칙이 있어야 한다`);
  return css.slice(start, css.indexOf("}", start) + 1);
};

test("끝없이 움직이는 CSS가 없고 반짝임·깜빡임·나타남은 움직임 허용 블록 안에만 있다", () => {
  assert.doesNotMatch(css, /infinite/);

  const outsideNoPreference = css.replace(/@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?\n\}/g, "");
  assert.doesNotMatch(outsideNoPreference, /animation: tutorial-pulse/);
  assert.doesNotMatch(outsideNoPreference, /animation: bgPulse/);
  assert.doesNotMatch(outsideNoPreference, /animation: linearFadeIn/);
});

test("입력 칸과 선택 칸의 포커스 테두리를 숨기지 않는다", () => {
  assert.doesNotMatch(getFirstRule(".linear-input:focus"), /outline: none/);
  assert.doesNotMatch(getFirstRule(".linear-select:focus"), /outline: none/);
});
