import test from "node:test";
import assert from "node:assert/strict";

import { getSlotButtonLabel, getSlotLabel, getStickerAltText, getSwatchName } from "../../src/state/editorLabels.ts";

test("getSwatchName은 프레임 색 8가지에 손님이 아는 이름을 돌려준다", () => {
  const swatchNames: Array<[string, string]> = [
    ["#FFFFFF", "흰색"],
    ["#000000", "검정"],
    ["#DCDCDC", "회색"],
    ["#fe9fb3", "진한 분홍"],
    ["#ffe4c4", "살구색"],
    ["#C8F7DC", "민트"],
    ["#C6E2FF", "하늘색"],
    ["#ffc1cc", "연분홍"],
  ];

  for (const [hex, expectedName] of swatchNames) {
    assert.equal(getSwatchName(hex), expectedName, hex);
  }
});

test("getSwatchName은 대소문자를 가리지 않는다", () => {
  assert.equal(getSwatchName("#ffffff"), "흰색");
  assert.equal(getSwatchName("#FE9FB3"), "진한 분홍");
});

test("getSwatchName은 표에 없는 색을 색 값과 함께 '다른 색'으로 부른다", () => {
  assert.equal(getSwatchName("#123ABC"), "다른 색 (#123ABC)");
});

test("getSlotLabel은 빈 칸, 불러오는 중, 불러오기 실패를 구분한다", () => {
  assert.equal(getSlotLabel({ hasUserImage: false, loadFailed: false }), "눌러서 사진 넣기");
  assert.equal(getSlotLabel({ hasUserImage: true, loadFailed: false }), "사진 불러오는 중");
  assert.equal(getSlotLabel({ hasUserImage: true, loadFailed: true }), "사진을 못 불러왔어요");
});

test("getSlotButtonLabel은 칸 번호를 1부터 세고 사진 유무로 동사를 바꾼다", () => {
  assert.equal(getSlotButtonLabel(0, false), "1번 칸에 사진 넣기");
  assert.equal(getSlotButtonLabel(3, true), "4번 칸 사진 바꾸기");
});

test("getStickerAltText는 분류 이름과 1부터 센 번호를 붙인다", () => {
  assert.equal(getStickerAltText("하트", 0), "하트 스티커 1");
  assert.equal(getStickerAltText("하트", 11), "하트 스티커 12");
});
