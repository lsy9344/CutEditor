import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getFocusReturnCandidates, getPickFocusTarget, getTextDeleteFocusTarget, getWrappedFocusIndex, isRectInViewport, pickFocusReturnIndex, setInertOutside, shouldRefocusAfterLayoutChange } from "../../src/state/modalFocus.ts";
import type { FocusCandidate } from "../../src/state/modalFocus.ts";

const NORMAL_CANDIDATE: FocusCandidate = { isConnected: true, isDisabled: false, isInert: false, isHidden: false };
const DISCONNECTED_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isConnected: false };
const DISABLED_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isDisabled: true };
const INERT_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isInert: true };
const HIDDEN_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isHidden: true };

test("포커스할 곳이 하나도 없으면 Tab도 Shift+Tab도 제자리에 둔다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 0, activeIndex: -1, isShiftKey: false }), { kind: "stay" });
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 0, activeIndex: -1, isShiftKey: true }), { kind: "stay" });
});

test("마지막 버튼에서 Tab을 누르면 처음 버튼으로 돌아간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 2, isShiftKey: false }), {
    kind: "move",
    index: 0,
  });
});

test("대화상자 카드에 포커스가 있을 때 Tab을 누르면 처음 버튼으로 간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: -1, isShiftKey: false }), {
    kind: "move",
    index: 0,
  });
});

test("처음 버튼에서 Tab을 누르면 브라우저 기본 이동에 맡긴다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 0, isShiftKey: false }), { kind: "native" });
});

test("처음 버튼에서 Shift+Tab을 누르면 마지막 버튼으로 돌아간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 0, isShiftKey: true }), {
    kind: "move",
    index: 2,
  });
});

test("대화상자 카드에 포커스가 있을 때 Shift+Tab을 누르면 마지막 버튼으로 간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: -1, isShiftKey: true }), {
    kind: "move",
    index: 2,
  });
});

test("마지막 버튼에서 Shift+Tab을 누르면 브라우저 기본 이동에 맡긴다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 2, isShiftKey: true }), { kind: "native" });
});

test("포커스를 돌려줄 후보는 끊김·잠김·inert·숨김을 건너뛰고 첫 정상 후보를 고른다", () => {
  const candidates = [
    DISCONNECTED_CANDIDATE,
    DISABLED_CANDIDATE,
    INERT_CANDIDATE,
    HIDDEN_CANDIDATE,
    NORMAL_CANDIDATE,
    NORMAL_CANDIDATE,
  ];

  assert.equal(pickFocusReturnIndex(candidates), 4);
});

test("쓸 수 있는 후보가 없거나 후보가 빈 배열이면 -1을 돌려준다", () => {
  const unusableCandidates = [DISCONNECTED_CANDIDATE, DISABLED_CANDIDATE, INERT_CANDIDATE, HIDDEN_CANDIDATE];

  assert.equal(pickFocusReturnIndex(unusableCandidates), -1);
  assert.equal(pickFocusReturnIndex([]), -1);
});

// UX1-1: 프레임 시트가 아직 열려 있으면 포커스는 시트 안에 둡니다. 시트 후보는 캔버스·저장 버튼보다 앞입니다.
test("돌려줄 후보는 연 곳, 열린 시트 안 후보, 캔버스, 저장 버튼 순서다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "frame-change", opener: "opener", sheetCandidates: ["sheet-close"], canvas: "canvas", saves: ["save-1", "save-2"] }),
    ["opener", "sheet-close", "canvas", "save-1", "save-2"],
  );
});

test("시트가 없으면 돌려줄 후보는 전과 같이 연 곳, 캔버스, 저장 버튼 순서다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "frame-change", opener: null, sheetCandidates: [], canvas: "canvas", saves: ["save"] }),
    [null, "canvas", "save"],
  );
});

test("연 곳을 못 쓰면 열린 시트의 닫기 버튼이 캔버스와 저장 버튼보다 먼저 고른다", () => {
  const described = [DISCONNECTED_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 1);
});

test("시트가 닫혀 닫기 버튼이 문서에 없으면 캔버스로 돌아간다", () => {
  const described = [DISCONNECTED_CANDIDATE, DISCONNECTED_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 2);
});

test("연 곳을 쓸 수 있으면 열린 시트가 있어도 연 곳이 먼저다", () => {
  const described = [NORMAL_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 0);
});

// UX2-2: 저장에서 시작한 안내는 원래 저장 버튼을 못 쓰면 지금 배치의 저장 버튼으로 돌아간다. 캔버스보다 앞이다.
test("저장에서 시작한 안내는 연 곳, 열린 시트 안 후보, 저장 버튼, 캔버스 순서로 돌려준다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "save", opener: "opener", sheetCandidates: ["sheet-close"], canvas: "canvas", saves: ["save-1", "save-2"] }),
    ["opener", "sheet-close", "save-1", "save-2", "canvas"],
  );
});

test("저장에서 시작했고 원래 저장 버튼이 사라졌으면 지금 배치의 저장 버튼이 캔버스보다 먼저 고른다", () => {
  const candidates = getFocusReturnCandidates({ origin: "save", opener: "old-save", sheetCandidates: [], canvas: "canvas", saves: ["phone-save"] });
  const described = candidates.map((candidate) => (candidate === "old-save" ? DISCONNECTED_CANDIDATE : NORMAL_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "phone-save");
});

test("저장에서 시작했어도 저장 버튼을 모두 못 쓰면 캔버스로 돌아간다", () => {
  const candidates = getFocusReturnCandidates({ origin: "save", opener: null, sheetCandidates: [], canvas: "canvas", saves: ["hidden-save"] });
  const described = candidates.map((candidate) => (candidate === "canvas" ? NORMAL_CANDIDATE : DISCONNECTED_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "canvas");
});

test("프레임 바꾸기에서 시작한 안내는 연 곳을 못 쓰면 저장 버튼이 있어도 캔버스로 돌아간다", () => {
  const candidates = getFocusReturnCandidates({ origin: "frame-change", opener: "frame-card", sheetCandidates: [], canvas: "canvas", saves: ["save"] });
  const described = candidates.map((candidate) => (candidate === "frame-card" ? DISCONNECTED_CANDIDATE : NORMAL_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "canvas");
});

// UX5-5: 저장이 끝난 뒤 배치가 바뀌어 포커스가 사라졌을 때만 지금 배치의 저장 버튼으로 돌려줍니다.
test("저장에서 온 복귀 요청이 남아 있고 활성 요소가 body이면 배치가 바뀐 뒤 다시 돌려준다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: true, isConnected: true } }), true);
});

test("저장에서 온 복귀 요청이 남아 있고 활성 요소가 사라졌으면 다시 돌려준다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: false, isConnected: false } }), true);
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: null }), true);
});

test("활성 요소가 문서에 남아 있는 다른 요소이면 포커스를 뺏지 않는다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: false, isConnected: true } }), false);
});

test("복귀 요청이 없으면 활성 요소가 body여도 돌려주지 않는다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: false, activeElement: { isBody: true, isConnected: true } }), false);
});

// 글씨 지우기: 키보드로 눌렀을 때만 포커스를 옮깁니다. 지운 글씨가 선택에서 빠져 눌렀던 버튼이 잠기기 때문입니다.
test("글씨 지우기를 키보드로 누르면 되돌리기로, 그 버튼이 없으면 글씨 입력 칸으로 가고 마우스·터치로 누르면 옮기지 않는다", () => {
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: true, hasUndoButton: true }), "undo");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: true, hasUndoButton: false }), "text-input");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: false, hasUndoButton: true }), "none");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: false, hasUndoButton: false }), "none");
});

test("컷 수 버튼을 키보드로 누르면 첫 프레임 카드로, 프레임 카드를 키보드로 누르면 캔버스로 포커스를 보낸다", () => {
  assert.equal(getPickFocusTarget({ pressed: "cut-count", isKeyboardFocused: true }), "first-frame-card");
  assert.equal(getPickFocusTarget({ pressed: "frame-card", isKeyboardFocused: true }), "canvas");
});

test("마우스·터치로 누르면 컷 수 버튼도 프레임 카드도 포커스를 옮기지 않는다", () => {
  assert.equal(getPickFocusTarget({ pressed: "cut-count", isKeyboardFocused: false }), "none");
  assert.equal(getPickFocusTarget({ pressed: "frame-card", isKeyboardFocused: false }), "none");
});

// 배경 격리: 각 잠금은 자기가 새로 잠근 요소만 풉니다(UX6-1).
const makeInertChild = (inert = false) => ({ inert });

test("이미 inert였던 요소는 잠금을 풀어도 inert로 남고, 새로 잠근 요소만 풀린다", () => {
  const alreadyInert = makeInertChild(true);
  const target = makeInertChild();
  const restore = setInertOutside({ container: { children: [alreadyInert, target] }, keep: [] });
  assert.deepEqual([alreadyInert.inert, target.inert], [true, true]);
  restore();
  assert.deepEqual([alreadyInert.inert, target.inert], [true, false]);
});

test("keep에 든 요소와 null은 잠그지 않는다", () => {
  const sheet = makeInertChild();
  const other = makeInertChild();
  setInertOutside({ container: { children: [sheet, other] }, keep: [sheet, null] });
  assert.deepEqual([sheet.inert, other.inert], [false, true]);
});

test("시트가 건 배경 격리 위에 누끼 잠금을 걸었다 풀어도 시트 배경은 격리된 채 시트만 풀린다", () => {
  const toolbar = makeInertChild();
  const main = makeInertChild();
  const sheet = makeInertChild();
  const container = { children: [toolbar, main, sheet] };
  const restoreSheetLock = setInertOutside({ container, keep: [sheet, null] });
  assert.deepEqual([toolbar.inert, main.inert, sheet.inert], [true, true, false]);

  const cutoutLock = makeInertChild();
  const restoreCutoutLock = setInertOutside({ container: { children: [toolbar, main, sheet, cutoutLock] }, keep: [cutoutLock] });
  assert.deepEqual([toolbar.inert, main.inert, sheet.inert], [true, true, true]);

  restoreCutoutLock(); // 누끼 취소·실패
  assert.deepEqual([toolbar.inert, main.inert, sheet.inert], [true, true, false]);

  restoreSheetLock(); // 시트 닫기
  assert.deepEqual([toolbar.inert, main.inert, sheet.inert], [false, false, false]);
});

test("시트를 먼저 닫아도 누끼 잠금이 푸는 것은 자기가 건 시트뿐이다", () => {
  const toolbar = makeInertChild();
  const sheet = makeInertChild();
  const container = { children: [toolbar, sheet] };
  const restoreSheetLock = setInertOutside({ container, keep: [sheet] });
  const restoreCutoutLock = setInertOutside({ container, keep: [] });
  restoreSheetLock();
  assert.deepEqual([toolbar.inert, sheet.inert], [false, true]);
  restoreCutoutLock();
  assert.deepEqual([toolbar.inert, sheet.inert], [false, false]);
});

test("App에는 inert를 직접 대입하는 코드가 없고 모든 배경 격리가 setInertOutside를 거친다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  assert.ok(!/\.inert\s*=[^=]/.test(appSource), "App에 inert 직접 대입이 남아 있습니다");
  assert.ok(appSource.includes("setInertOutside({ container, keep: [lock] })"), "누끼 잠금이 setInertOutside를 쓰지 않습니다");
});

// 포커스를 돌려줄 요소가 화면 안에 보이면 스크롤하지 않고, 보이지 않을 때만 브라우저가 보이게 합니다(UX6-2).
test("화면 높이 안에 모두 들어오는 요소는 화면 안에 있다고 본다", () => {
  assert.equal(isRectInViewport({ rect: { top: 738, bottom: 844 }, viewportHeight: 844 }), true);
  assert.equal(isRectInViewport({ rect: { top: 0, bottom: 44 }, viewportHeight: 844 }), true);
});

test("위나 아래로 조금이라도 벗어나면 화면 안이 아니다", () => {
  assert.equal(isRectInViewport({ rect: { top: -10, bottom: 34 }, viewportHeight: 844 }), false);
  assert.equal(isRectInViewport({ rect: { top: 800, bottom: 850 }, viewportHeight: 844 }), false);
  assert.equal(isRectInViewport({ rect: { top: 900, bottom: 944 }, viewportHeight: 844 }), false);
});

test("소수점 반올림으로 1px 안쪽만 벗어난 경우는 화면 안으로 본다", () => {
  assert.equal(isRectInViewport({ rect: { top: 737.5, bottom: 844.4 }, viewportHeight: 844 }), true);
  assert.equal(isRectInViewport({ rect: { top: 737.5, bottom: 845.5 }, viewportHeight: 844 }), false);
});

// 시트 카드에 첫 포커스를 줄 때도 닫힘 복귀와 같은 규칙을 씁니다(UX26a-1). 화면 안이면 스크롤하지 않고, 밖일 때만 브라우저가 보이게 합니다.
test("시트 카드 첫 포커스는 복귀와 같은 한 함수를 거치고 맨 focus()가 남지 않는다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  assert.ok(/focusWithoutScrollIfVisible\(mobileSheetCardRef\.current\)/.test(appSource), "시트 카드 포커스가 공용 함수를 거치지 않습니다");
  assert.ok(!/mobileSheetCardRef\.current\??\.focus\(/.test(appSource), "시트 카드에 맨 focus()가 남아 있습니다");
  assert.ok(!appSource.includes("focusReturnElement"), "옛 이름 focusReturnElement가 남아 있습니다");
  assert.equal(appSource.match(/const focusWithoutScrollIfVisible = /g)?.length, 1, "함수가 하나가 아닙니다");
});
