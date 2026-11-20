import test from "node:test";
import assert from "node:assert/strict";

import { getRenderedTextWidth } from "../../src/canvas/textTransform.ts";

test("글씨가 그려지는 폭은 세로 글씨는 측정한 폭, 가로 글씨는 저장된 상자 폭이다", () => {
  const verticalText = {
    text: "가나",
    fontSize: 40,
    fontFamily: "serif",
    isBold: false,
    isItalic: false,
    isVertical: true,
    boxWidth: 24,
  };

  // 세로 글씨는 저장된 boxWidth(24)가 아니라 그려지는 폭(글자 크기 40)
  assert.equal(getRenderedTextWidth(verticalText), 40);
  // 가로 글씨는 저장된 boxWidth
  assert.equal(getRenderedTextWidth({ ...verticalText, isVertical: false }), 24);
});
