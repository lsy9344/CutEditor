import test from "node:test";
import assert from "node:assert/strict";

import { getNextTutorialStep, getTutorialSteps, getTutorialTooltipLayout } from "../../src/ui/tutorialSteps.ts";

test("누끼 메뉴가 있으면 튜토리얼은 다섯 단계이고 넷째가 내 사진 스티커다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: true });
  assert.deepEqual(steps.map((step) => step.target), ["frames", "text", "sticker", "cutout", "save"]);
  assert.equal(steps[3].title, "④ 내 사진 스티커 만들기");
  assert.equal(steps[3].description, "넣은 사진을 오려서 스티커로 붙일 수 있어요.");
  assert.equal(steps[4].title, "⑤ 저장");
  assert.equal(steps[4].description, "다 꾸몄으면 [저장]을 눌러요.");
  assert.equal(steps[0].description.includes("\n"), true);
});

test("다음 단계는 마지막에서 닫히고 누끼 메뉴가 없으면 네 단계다", () => {
  assert.equal(getNextTutorialStep({ step: 3, stepCount: 5 }), 4);
  assert.equal(getNextTutorialStep({ step: 4, stepCount: 5 }), null);
  const steps = getTutorialSteps({ hasCutoutMenu: false });
  assert.deepEqual(steps.map((step) => step.target), ["frames", "text", "sticker", "save"]);
  assert.equal(steps[steps.length - 1].title, "④ 저장");
  assert.equal(getNextTutorialStep({ step: 3, stepCount: 4 }), null);
});

test("휴대폰 세로 말풍선은 버튼 위 가운데이고 자리가 모자라면 위 16px에 붙는다", () => {
  const input = { placement: "above" as const, rect: { top: 741, left: 228, width: 52, height: 52 }, tooltipHeight: 200, viewport: { width: 390, height: 844 } };
  assert.deepEqual(getTutorialTooltipLayout(input), { top: 525, left: 142, arrowOffset: 112 });
  assert.equal(getTutorialTooltipLayout({ ...input, rect: { ...input.rect, top: 100 } }).top, 16);
});

test("낮은 가로 말풍선은 툴바 버튼 왼쪽, 데스크톱은 레일 오른쪽이다", () => {
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "left", rect: { top: 291, left: 775, width: 58, height: 67 }, tooltipHeight: 200, viewport: { width: 844, height: 390 } }),
    { top: 174, left: 535, arrowOffset: 150.5 },
  );
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "right", rect: { top: 301, left: 35, width: 53, height: 97 }, tooltipHeight: 200, viewport: { width: 1920, height: 1080 } }),
    { top: 249.5, left: 85, arrowOffset: 100 },
  );
});
