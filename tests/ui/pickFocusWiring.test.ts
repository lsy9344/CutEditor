import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");
const gallerySource = readFileSync("src/canvas/FrameGallery.tsx", "utf8");

const getAppSection = (startMarker: string, endMarker: string): string => {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `App에서 구간을 찾지 못했습니다: ${startMarker}`);
  return appSource.slice(start, end);
};

test("FrameGallery는 컷 수 버튼과 프레임 카드를 누른 방식(:focus-visible)을 App에 알리고 첫 카드에 표식을 둔다", () => {
  const focusVisibleCount = gallerySource.split(":focus-visible").length - 1;
  assert.equal(focusVisibleCount, 3, "컷 수 버튼, 카드 클릭, 카드 키 입력 세 곳에서 키보드 여부를 봐야 합니다");
  assert.ok(gallerySource.includes('data-focus-return={optionIndex === 0 ? "first-frame-card" : undefined}'), "첫 프레임 카드 표식이 없습니다");
});

test("App은 키보드 선택 뒤 포커스 요청을 한 곳에서 남기고 렌더 뒤 한 번 소비한다", () => {
  assert.ok(appSource.includes("getPickFocusTarget("), "목적지 판단 함수를 쓰지 않습니다");
  assert.ok(/pickFocusRequestRef\s*=\s*useRef</.test(appSource), "요청 ref가 없습니다");
  const consumer = getAppSection("const pickFocusTarget = pickFocusRequestRef.current", "\n  });");
  assert.ok(consumer.includes("pickFocusRequestRef.current = 'none'"), "요청을 한 번 쓰고 비우지 않습니다");
  assert.ok(consumer.includes("focusWithoutScrollIfVisible("), "화면 안이면 스크롤하지 않는 포커스 함수를 쓰지 않습니다");
  assert.ok(consumer.includes('[data-focus-return="canvas"]') && consumer.includes('[data-focus-return="first-frame-card"]'), "목적지 요소를 찾지 못합니다");
});

test("프레임 선택은 캔버스가 실제로 나타나는 두 경우에만 요청을 남기고, 확인창·변화 없음에서는 남기지 않는다", () => {
  const handler = getAppSection("const handleFrameSelect = ", "const handleCategoryPick = ");
  const confirmBranch = getAppSection("if (decision.kind === 'confirm')", "return;");
  assert.ok(!confirmBranch.includes("requestPickFocus("), "확인창이 뜨는 경우에 요청을 남깁니다(포커스는 확인창이 가집니다)");
  assert.equal(handler.split("requestPickFocus(").length - 1, 2, "activate-editor와 apply 두 곳에서만 요청해야 합니다");
});

test("컷 수 선택은 키보드일 때만 첫 프레임 카드 요청을 남기고, 둘은 같은 요청 ref를 쓴다", () => {
  const categoryHandler = getAppSection("const handleCategoryPick = ", "const handleImageUpload = ");
  assert.ok(categoryHandler.includes("requestPickFocus('cut-count', isKeyboardFocused)"), "컷 수 선택이 요청을 남기지 않습니다");
  assert.equal(appSource.split("pickFocusRequestRef.current =").length - 1, 2, "요청 쓰기(한 곳)와 소비 뒤 비우기(한 곳)만 있어야 합니다");
});
