import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";

test("흰 테두리는 켜짐/꺼짐 없이 한 이름만 쓴다", () => {
  assert.equal(CUTOUT_COPY.outline, "흰 테두리");
  assert.equal("outlineOn" in CUTOUT_COPY, false);
  assert.equal("outlineOff" in CUTOUT_COPY, false);
});

test("손님 문구에 누끼·사물과 옛 사람 전용 안내가 없고 두 칸 이름이 있다", () => {
  const copyTexts = Object.values(CUTOUT_COPY).map((value) => (typeof value === "function" ? value(2) : value));
  for (const copyText of copyTexts) {
    assert.ok(!copyText.includes("누끼"), `손님 문구에 '누끼'가 있습니다: ${copyText}`);
    assert.ok(!copyText.includes("사물"), `손님 문구에 '사물'이 있습니다: ${copyText}`);
    assert.ok(!copyText.includes("사람을 찾지 못했어요"), `옛 사람 전용 안내가 있습니다: ${copyText}`);
  }
  assert.equal(CUTOUT_COPY.subjectPerson, "사람");
  assert.equal(CUTOUT_COPY.subjectThing, "반려동물·물건");
});
