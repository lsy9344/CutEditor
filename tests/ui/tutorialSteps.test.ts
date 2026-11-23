import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getNextTutorialStep, getTutorialDemoImage, getTutorialSteps, getTutorialTooltipLayout } from "../../src/ui/tutorialSteps.ts";

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

test("시연 그림은 ④ 내 사진 스티커 단계에서만 움직이는 그림을 고정 크기로 그린다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: true });
  const images = steps.map((step) => getTutorialDemoImage({ target: step.target, placement: "right", prefersReducedMotion: false }));
  assert.deepEqual(images, [null, null, null, { src: "/tutorial/cutout-demo.webp", width: 186, height: 132 }, null]);
  assert.equal(getTutorialDemoImage({ target: "cutout", placement: "above", prefersReducedMotion: false })?.src, "/tutorial/cutout-demo.webp");
});

test("낮은 가로(말풍선이 버튼 왼쪽)에서는 ④ 단계여도 시연 그림을 그리지 않는다", () => {
  assert.equal(getTutorialDemoImage({ target: "cutout", placement: "left", prefersReducedMotion: false }), null);
  assert.equal(getTutorialDemoImage({ target: "cutout", placement: "left", prefersReducedMotion: true }), null);
});

test("움직임 줄이기 설정이면 ④ 시연 그림은 같은 크기의 정지 PNG다", () => {
  assert.deepEqual(
    getTutorialDemoImage({ target: "cutout", placement: "above", prefersReducedMotion: true }),
    { src: "/tutorial/cutout-demo-still.png", width: 186, height: 132 },
  );
  assert.equal(getTutorialDemoImage({ target: "save", placement: "right", prefersReducedMotion: true }), null);
});

test("시연 그림은 말풍선 내용 폭(224 - 테두리 3×2 - 여백 16×2 = 186px) 안에 든다", () => {
  const image = getTutorialDemoImage({ target: "cutout", placement: "right", prefersReducedMotion: false });
  assert.equal(image?.width, 186);
});

test("시연 그림 파일 두 개가 public/tutorial에 있고 화면 크기의 정확히 2배다", () => {
  const image = getTutorialDemoImage({ target: "cutout", placement: "right", prefersReducedMotion: false });
  assert.ok(image);
  const still = readFileSync("public/tutorial/cutout-demo-still.png");
  assert.equal(still.toString("ascii", 12, 16), "IHDR");
  assert.deepEqual([still.readUInt32BE(16), still.readUInt32BE(20)], [image.width * 2, image.height * 2]);
  const anim = readFileSync("public/tutorial/cutout-demo.webp");
  assert.equal(anim.toString("ascii", 12, 16), "VP8X");
  assert.equal(anim[20] & 0x02, 0x02, "애니메이션 WebP여야 한다");
  assert.deepEqual([anim.readUIntLE(24, 3) + 1, anim.readUIntLE(27, 3) + 1], [image.width * 2, image.height * 2]);
});

test("튜토리얼 말풍선은 지금 단계·배치·움직임 줄이기로 시연 그림을 고르고 크기를 고정한 장식 그림으로 그린다", () => {
  const overlaySource = readFileSync("src/ui/TutorialOverlay.tsx", "utf8");
  assert.ok(overlaySource.includes("getTutorialDemoImage({ target: currentStep.target, placement, prefersReducedMotion })"));
  const imgStart = overlaySource.indexOf("<img");
  assert.notEqual(imgStart, -1);
  const imgTag = overlaySource.slice(imgStart, overlaySource.indexOf("/>", imgStart));
  for (const part of ["src={demoImage.src}", "width={demoImage.width}", "height={demoImage.height}", 'alt=""']) {
    assert.ok(imgTag.includes(part), `${part}가 없다`);
  }
});
