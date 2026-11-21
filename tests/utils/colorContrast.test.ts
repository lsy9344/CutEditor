import test from "node:test";
import assert from "node:assert/strict";

import { getContrastRatio, getReadableMarkColor } from "../../src/utils/colorContrast.ts";

// UX5-2: 선택된 색 스와치 가운데 ✓는 스와치 바탕과 3:1 이상이어야 합니다(WCAG 1.4.11).
test("흰색 바탕과 검정의 대비는 21:1이다", () => {
  assert.equal(Math.round(getContrastRatio("#FFFFFF", "#000000") * 100) / 100, 21);
});

test("바탕이 밝으면 ✓는 검정, 어두우면 흰색이다", () => {
  assert.equal(getReadableMarkColor("#FFFFFF"), "#000000");
  assert.equal(getReadableMarkColor("#ffe4c4"), "#000000");
  assert.equal(getReadableMarkColor("#000000"), "#FFFFFF");
  assert.equal(getReadableMarkColor("#333333"), "#FFFFFF");
});

test("흰색·검정·베이지·진한 색 바탕 모두 ✓ 색과의 대비가 3:1 이상이다", () => {
  for (const background of ["#FFFFFF", "#000000", "#ffe4c4", "#C8F7DC", "#fe9fb3", "#8B0000", "#1E3A8A", "#777777", "#808080"]) {
    const ratio = getContrastRatio(getReadableMarkColor(background), background);
    assert.ok(ratio >= 3, `${background} 바탕의 ✓ 대비가 ${ratio.toFixed(2)}:1입니다`);
  }
});

test("색 표기가 짧거나 이상해도 읽을 수 있는 색을 돌려준다", () => {
  assert.equal(getReadableMarkColor("#fff"), "#000000");
  assert.equal(getReadableMarkColor("#000"), "#FFFFFF");
  assert.equal(getReadableMarkColor("not-a-color"), "#000000");
});
