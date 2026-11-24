import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getNextTutorialStep,
  getTutorialDemoImage,
  getTutorialSteps,
  getTutorialTooltipLayout,
  getTutorialTooltipTransition,
  isTutorialDemoTarget,
} from "../../src/ui/tutorialSteps.ts";

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

// 넉넉한 데스크톱(①~④ 말풍선을 그림 없이 잰 높이가 모두 195px, 창 높이 1080px)
const ROOMY_DESKTOP = { demoTooltipHeights: [195, 195, 195, 195], viewportHeight: 1080 };

test("시연 그림은 ①~④ 단계마다 각자의 움직이는 그림을 같은 크기로 그리고 ⑤ 저장에는 없다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: true });
  const images = steps.map((step) => getTutorialDemoImage({ target: step.target, placement: "right", prefersReducedMotion: false, ...ROOMY_DESKTOP }));
  assert.deepEqual(images, [
    { src: "/tutorial/frames-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/text-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/sticker-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/cutout-demo.webp", width: 186, height: 196 },
    null,
  ]);
  assert.equal(getTutorialDemoImage({ target: "cutout", placement: "above", prefersReducedMotion: false, ...ROOMY_DESKTOP })?.src, "/tutorial/cutout-demo.webp");
});

const DEMO_TARGETS = ["frames", "text", "sticker", "cutout"] as const;

test("낮은 가로(말풍선이 버튼 왼쪽)에서는 ①~④ 어느 단계도 시연 그림을 그리지 않는다", () => {
  for (const target of DEMO_TARGETS) {
    assert.equal(getTutorialDemoImage({ target, placement: "left", prefersReducedMotion: false, ...ROOMY_DESKTOP }), null, target);
    assert.equal(getTutorialDemoImage({ target, placement: "left", prefersReducedMotion: true, ...ROOMY_DESKTOP }), null, target);
  }
});

test("움직임 줄이기 설정이면 ①~④ 시연 그림은 각 단계의 같은 크기 정지 PNG다", () => {
  for (const target of DEMO_TARGETS) {
    assert.deepEqual(
      getTutorialDemoImage({ target, placement: "above", prefersReducedMotion: true, ...ROOMY_DESKTOP }),
      { src: `/tutorial/${target}-demo-still.png`, width: 186, height: 196 },
    );
  }
  assert.equal(getTutorialDemoImage({ target: "save", placement: "right", prefersReducedMotion: true, ...ROOMY_DESKTOP }), null);
});

test("시연 그림은 말풍선 내용 폭(224 - 테두리 3×2 - 여백 16×2 = 186px) 안에 든다", () => {
  const image = getTutorialDemoImage({ target: "cutout", placement: "right", prefersReducedMotion: false, ...ROOMY_DESKTOP });
  assert.equal(image?.width, 186);
});

// 손님이 그 단계에서 받는 양을 줄이려고 정한 한도(Vercel 전송량)
const ANIMATION_MAX_BYTES = 150 * 1024;
const STILL_MAX_BYTES = 80 * 1024;

test("①~④ 시연 그림 파일이 public/tutorial에 있고 화면 크기의 정확히 2배이며 용량 한도 안이다", () => {
  for (const target of DEMO_TARGETS) {
    const image = getTutorialDemoImage({ target, placement: "right", prefersReducedMotion: false, ...ROOMY_DESKTOP });
    assert.ok(image);
    const still = readFileSync(`public/tutorial/${target}-demo-still.png`);
    assert.equal(still.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([still.readUInt32BE(16), still.readUInt32BE(20)], [image.width * 2, image.height * 2], target);
    assert.ok(still.length <= STILL_MAX_BYTES, `${target} 정지 PNG ${still.length} B`);
    const anim = readFileSync(`public/tutorial/${target}-demo.webp`);
    assert.equal(anim.toString("ascii", 12, 16), "VP8X");
    assert.equal(anim[20] & 0x02, 0x02, `${target}는 애니메이션 WebP여야 한다`);
    assert.deepEqual([anim.readUIntLE(24, 3) + 1, anim.readUIntLE(27, 3) + 1], [image.width * 2, image.height * 2], target);
    assert.ok(anim.length <= ANIMATION_MAX_BYTES, `${target} WebP ${anim.length} B`);
  }
});

test("①~④ 말풍선이 그림을 넣고도 화면 안(위아래 16px 여백)에 다 들어갈 때만 그림을 그린다", () => {
  // 그림 자리는 196px + 아래 여백 14px = 210px. 그림 없는 말풍선 195px이면 195 + 210 + 16×2 = 437px 창부터 들어갑니다.
  for (const target of DEMO_TARGETS) {
    const right = { target, placement: "right", prefersReducedMotion: false, demoTooltipHeights: [195] } as const;
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 437 })?.src, `/tutorial/${target}-demo.webp`);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 436 }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 320 }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 300, prefersReducedMotion: true }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, placement: "above", viewportHeight: 436 }), null, target);
  }
});

test("그림을 넣고 들어간다고 판단한 높이면 배치 계산도 말풍선을 위아래 16px 여백 안에 둔다", () => {
  // 그림 판단과 배치 계산이 같은 기준을 쓰는지: 437px 창에서 그림을 넣은 405px 말풍선은 위 16, 아래 16 여백에 딱 맞습니다.
  const image = getTutorialDemoImage({ target: "cutout", placement: "right", prefersReducedMotion: false, demoTooltipHeights: [195], viewportHeight: 437 });
  assert.ok(image);
  const layout = getTutorialTooltipLayout({
    placement: "right",
    rect: { top: 300, left: 35, width: 53, height: 97 },
    tooltipHeight: 405,
    viewport: { width: 1280, height: 437 },
  });
  assert.equal(layout.top, 16);
  assert.equal(437 - (layout.top + 405), 16);
});

test("①~④ 그림은 가장 높은 말풍선 하나로 정해 네 단계가 같이 보이거나 같이 숨는다(단계를 넘길 때 말풍선이 출렁이지 않게)", () => {
  // ① 218px이 가장 높습니다. 218 + 그림 자리 210 + 위아래 16×2 = 460px 창부터 네 단계 모두 그림이 들어갑니다.
  // ②(173px)만 보면 415px 창에도 들어가지만, ①과 다르게 보였다 숨으면 단계마다 말풍선 높이가 크게 바뀝니다.
  const demoTooltipHeights = [218, 173, 195, 195];
  const shownAt = (viewportHeight: number) => DEMO_TARGETS.map((target) =>
    getTutorialDemoImage({ target, placement: "above", prefersReducedMotion: false, demoTooltipHeights, viewportHeight }) !== null);
  assert.deepEqual(shownAt(459), [false, false, false, false]);
  assert.deepEqual(shownAt(425), [false, false, false, false]);
  assert.deepEqual(shownAt(460), [true, true, true, true]);
});

test("시연 그림이 있는 단계는 ①~④이고 ⑤ 저장은 아니다(말풍선이 그림 없는 높이를 재는 단계)", () => {
  assert.deepEqual(getTutorialSteps({ hasCutoutMenu: true }).map((step) => isTutorialDemoTarget(step.target)), [true, true, true, true, false]);
});

test("그림이 보이거나 숨어 말풍선 높이가 바뀌는 때는 0.25초 이동 없이 새 자리에 바로 놓는다", () => {
  const moving = "top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)";
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: false, isDemoImageToggled: false }), moving);
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: false, isDemoImageToggled: true }), "none");
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: true, isDemoImageToggled: false }), "none");
});

test("말풍선 높이를 아직 재지 않았으면 ①~④ 그림을 그리지 않는다(재고 나서 들어갈 때만 받음)", () => {
  for (const target of DEMO_TARGETS) {
    assert.equal(
      getTutorialDemoImage({ target, placement: "right", prefersReducedMotion: false, demoTooltipHeights: null, viewportHeight: 1080 }),
      null,
    );
  }
});

test("튜토리얼 말풍선은 지금 단계·배치·움직임 줄이기로 시연 그림을 고르고 크기를 고정한 장식 그림으로 그린다", () => {
  const overlaySource = readFileSync("src/ui/TutorialOverlay.tsx", "utf8");
  const callStart = overlaySource.indexOf("getTutorialDemoImage({");
  assert.notEqual(callStart, -1);
  const call = overlaySource.slice(callStart, overlaySource.indexOf("})", callStart));
  for (const part of [
    "target: currentStep.target",
    "placement,",
    "prefersReducedMotion,",
    "demoTooltipHeights,",
    "viewportHeight,",
  ]) {
    assert.ok(call.includes(part), `${part}가 없다`);
  }
  const imgStart = overlaySource.indexOf("<img");
  assert.notEqual(imgStart, -1);
  const imgTag = overlaySource.slice(imgStart, overlaySource.indexOf("/>", imgStart));
  for (const part of ["src={demoImage.src}", "width={demoImage.width}", "height={demoImage.height}", 'alt=""']) {
    assert.ok(imgTag.includes(part), `${part}가 없다`);
  }
});

test("튜토리얼 말풍선은 움직임 줄이기 설정과 창 크기가 바뀌면 다시 고른다", () => {
  const overlaySource = readFileSync("src/ui/TutorialOverlay.tsx", "utf8");
  assert.ok(overlaySource.includes("'(prefers-reduced-motion: reduce)'"));
  for (const part of [
    "motionMedia.addEventListener?.('change', updateReducedMotion)",
    "motionMedia.removeEventListener?.('change', updateReducedMotion)",
    "window.addEventListener('resize', updateViewportHeight)",
    "window.removeEventListener('resize', updateViewportHeight)",
    "getTutorialTooltipTransition({ prefersReducedMotion, isDemoImageToggled",
  ]) {
    assert.ok(overlaySource.includes(part), `${part}가 없다`);
  }
});
