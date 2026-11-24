import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getNextTutorialStep,
  getTutorialCardScrollDelta,
  getTutorialPlacement,
  getTutorialDemoImage,
  getTutorialSteps,
  getTutorialTooltipLayout,
  getTutorialTooltipTransition,
  isTutorialDemoTarget,
} from "../../src/ui/tutorialSteps.ts";

const ALL_SECTIONS = { showErase: true, showAdjust: true };

test("누끼 메뉴가 있으면 튜토리얼은 여덟 단계이고 왼쪽 메뉴 ①~④ 뒤에 오른쪽 편집 카드 ⑤~⑦, 마지막이 ⑧ 저장이다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: true, photoEditSections: ALL_SECTIONS });
  assert.deepEqual(steps.map((step) => step.target), ["frames", "text", "sticker", "cutout", "erase", "color", "frameColor", "save"]);
  assert.deepEqual(steps.map((step) => step.title), [
    "① 프레임 고르기", "② 글씨 넣기", "③ 스티커 붙이기", "④ 내 사진 스티커 만들기",
    "⑤ 바닥 얼룩 지우기", "⑥ 사진 색", "⑦ 프레임 색", "⑧ 저장",
  ]);
  assert.equal(steps[3].description, "넣은 사진을 오려서 스티커로 붙일 수 있어요.");
  assert.equal(steps[7].description, "다 꾸몄으면 [저장]을 눌러요.");
  assert.equal(steps[0].description.includes("\n"), true);
  // 카드 단계 글은 기기와 무관하게 '사진 칸을 고르면 나오는 편집 카드'로 어디서 찾는지 알려 줍니다.
  assert.ok(steps[4].description.includes("사진 칸을 고르면 나오는 편집 카드"));
  assert.ok(steps[4].description.includes("[바닥 얼룩 지우기]"));
  assert.ok(steps[5].description.includes("[자세히]"));
  for (const name of ["밝기", "선명하게", "색감", "따뜻함"]) assert.ok(steps[5].description.includes(name), name);
  assert.ok(steps[6].description.includes("[프레임 색 바꾸기]"));
});

test("누끼 메뉴가 없으면 번호를 하나씩 당겨 일곱 단계이고 마지막이 ⑦ 저장이다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: false, photoEditSections: ALL_SECTIONS });
  assert.deepEqual(steps.map((step) => step.target), ["frames", "text", "sticker", "erase", "color", "frameColor", "save"]);
  assert.deepEqual(steps.map((step) => step.title.slice(0, 1)), ["①", "②", "③", "④", "⑤", "⑥", "⑦"]);
  assert.equal(steps[3].title, "④ 바닥 얼룩 지우기");
  assert.equal(steps[6].title, "⑦ 저장");
});

test("바닥 얼룩 지우기나 사진 색 구획이 꺼진 구성은 그 단계를 빼고 번호를 당긴다", () => {
  const noErase = getTutorialSteps({ hasCutoutMenu: true, photoEditSections: { showErase: false, showAdjust: true } });
  assert.deepEqual(noErase.map((step) => step.target), ["frames", "text", "sticker", "cutout", "color", "frameColor", "save"]);
  assert.equal(noErase[4].title, "⑤ 사진 색");
  const noAdjust = getTutorialSteps({ hasCutoutMenu: true, photoEditSections: { showErase: true, showAdjust: false } });
  assert.deepEqual(noAdjust.map((step) => step.target), ["frames", "text", "sticker", "cutout", "erase", "frameColor", "save"]);
  const neither = getTutorialSteps({ hasCutoutMenu: false, photoEditSections: { showErase: false, showAdjust: false } });
  assert.deepEqual(neither.map((step) => step.target), ["frames", "text", "sticker", "frameColor", "save"]);
  assert.equal(neither[4].title, "⑤ 저장");
});

test("다음 단계는 마지막에서 닫힌다", () => {
  assert.equal(getNextTutorialStep({ step: 6, stepCount: 8 }), 7);
  assert.equal(getNextTutorialStep({ step: 7, stepCount: 8 }), null);
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

test("말풍선 꼬리가 없는 가운데 자리는 화면 가운데이고 작은 창에서도 위·왼쪽 16px 여백을 지킨다", () => {
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "center", rect: null, tooltipHeight: 400, viewport: { width: 1280, height: 800 } }),
    { top: 200, left: 528, arrowOffset: 0 },
  );
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "center", rect: null, tooltipHeight: 640, viewport: { width: 240, height: 600 } }),
    { top: 16, left: 16, arrowOffset: 0 },
  );
});

test("오른쪽 편집 카드 말풍선: 데스크톱은 카드 왼쪽(꼬리가 오른쪽), 휴대폰 세로는 카드 위(꼬리가 아래)다", () => {
  // 1280×800 편집 화면의 카드(895, 320, 328×152)
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "left", rect: { top: 320, left: 895, width: 328, height: 152 }, tooltipHeight: 400, viewport: { width: 1280, height: 800 } }),
    { top: 196, left: 655, arrowOffset: 200 },
  );
  // 390×844 편집 화면의 카드(47, 431, 288×152)
  assert.deepEqual(
    getTutorialTooltipLayout({ placement: "above", rect: { top: 431, left: 47, width: 288, height: 152 }, tooltipHeight: 300, viewport: { width: 390, height: 844 } }),
    { top: 115, left: 79, arrowOffset: 112 },
  );
});

test("왼쪽 메뉴 단계는 지금처럼 데스크톱 레일 오른쪽·휴대폰 세로 버튼 위·낮은 가로 버튼 왼쪽이다", () => {
  const menuTargets = ["frames", "text", "sticker", "cutout", "save"] as const;
  for (const target of menuTargets) {
    assert.equal(getTutorialPlacement({ target, screen: "desktop", hasTargetElement: true }), "right", target);
    assert.equal(getTutorialPlacement({ target, screen: "phonePortrait", hasTargetElement: true }), "above", target);
    assert.equal(getTutorialPlacement({ target, screen: "shortLandscape", hasTargetElement: true }), "left", target);
  }
});

test("휴대폰 세로 카드 단계는 구획 윗변이 말풍선 바로 아래에 오게 굴린다(말풍선이 구획을 가리지 않음)", () => {
  // 말풍선 450px + 위 여백 16 + 꼬리 쪽 여백 16 = 구획 윗변 482px 자리
  assert.equal(getTutorialCardScrollDelta({ placement: "above", rect: { top: 302, height: 100 }, tooltipHeight: 450, viewportHeight: 844 }), -180);
  assert.equal(getTutorialCardScrollDelta({ placement: "above", rect: { top: 626, height: 244 }, tooltipHeight: 450, viewportHeight: 844 }), 144);
  assert.equal(getTutorialCardScrollDelta({ placement: "above", rect: { top: 482, height: 100 }, tooltipHeight: 450, viewportHeight: 844 }), 0);
});

test("옆 배치 카드 단계는 구획이 화면 밖일 때만 가장 가까운 만큼 굴린다", () => {
  assert.equal(getTutorialCardScrollDelta({ placement: "left", rect: { top: 300, height: 200 }, tooltipHeight: 450, viewportHeight: 800 }), 0);
  assert.equal(getTutorialCardScrollDelta({ placement: "left", rect: { top: -50, height: 200 }, tooltipHeight: 450, viewportHeight: 800 }), -66);
  assert.equal(getTutorialCardScrollDelta({ placement: "left", rect: { top: 700, height: 200 }, tooltipHeight: 450, viewportHeight: 800 }), 116);
  // 화면보다 큰 구획은 윗변을 맞춤
  assert.equal(getTutorialCardScrollDelta({ placement: "left", rect: { top: 300, height: 900 }, tooltipHeight: 200, viewportHeight: 800 }), 284);
});

test("편집 카드 단계는 카드가 있으면 데스크톱·낮은 가로는 카드 왼쪽, 휴대폰 세로는 카드 위이고 카드가 없으면(칸 고르기 화면) 가운데다", () => {
  for (const target of ["erase", "color", "frameColor"] as const) {
    assert.equal(getTutorialPlacement({ target, screen: "desktop", hasTargetElement: true }), "left", target);
    assert.equal(getTutorialPlacement({ target, screen: "shortLandscape", hasTargetElement: true }), "left", target);
    assert.equal(getTutorialPlacement({ target, screen: "phonePortrait", hasTargetElement: true }), "above", target);
    for (const screen of ["desktop", "phonePortrait", "shortLandscape"] as const) {
      assert.equal(getTutorialPlacement({ target, screen, hasTargetElement: false }), "center", `${target} ${screen}`);
    }
  }
});

// 넉넉한 데스크톱(시연 단계 말풍선을 그림 없이 잰 높이가 모두 195px, 창 높이 1080px)
const ROOMY_DESKTOP = { demoTooltipHeights: [195, 195, 195, 195, 195, 195, 195], viewportHeight: 1080 };

test("시연 그림은 ①~⑦ 단계마다 각자의 움직이는 그림을 같은 크기로 그리고 ⑧ 저장에는 없다", () => {
  const steps = getTutorialSteps({ hasCutoutMenu: true, photoEditSections: ALL_SECTIONS });
  const images = steps.map((step) => getTutorialDemoImage({ target: step.target, screen: "desktop", prefersReducedMotion: false, ...ROOMY_DESKTOP }));
  assert.deepEqual(images, [
    { src: "/tutorial/frames-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/text-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/sticker-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/cutout-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/erase-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/color-demo.webp", width: 186, height: 196 },
    { src: "/tutorial/frameColor-demo.webp", width: 186, height: 196 },
    null,
  ]);
  assert.equal(getTutorialDemoImage({ target: "erase", screen: "phonePortrait", prefersReducedMotion: false, ...ROOMY_DESKTOP })?.src, "/tutorial/erase-demo.webp");
});

const DEMO_TARGETS = ["frames", "text", "sticker", "cutout", "erase", "color", "frameColor"] as const;

test("낮은 가로에서는 왼쪽 메뉴·편집 카드 어느 단계도 시연 그림을 그리지 않는다", () => {
  for (const target of DEMO_TARGETS) {
    assert.equal(getTutorialDemoImage({ target, screen: "shortLandscape", prefersReducedMotion: false, ...ROOMY_DESKTOP }), null, target);
    assert.equal(getTutorialDemoImage({ target, screen: "shortLandscape", prefersReducedMotion: true, ...ROOMY_DESKTOP }), null, target);
  }
});

test("움직임 줄이기 설정이면 ①~⑦ 시연 그림은 각 단계의 같은 크기 정지 PNG다", () => {
  for (const target of DEMO_TARGETS) {
    assert.deepEqual(
      getTutorialDemoImage({ target, screen: "phonePortrait", prefersReducedMotion: true, ...ROOMY_DESKTOP }),
      { src: `/tutorial/${target}-demo-still.png`, width: 186, height: 196 },
    );
  }
  assert.equal(getTutorialDemoImage({ target: "save", screen: "desktop", prefersReducedMotion: true, ...ROOMY_DESKTOP }), null);
});

test("시연 그림은 말풍선 내용 폭(224 - 테두리 3×2 - 여백 16×2 = 186px) 안에 든다", () => {
  const image = getTutorialDemoImage({ target: "cutout", screen: "desktop", prefersReducedMotion: false, ...ROOMY_DESKTOP });
  assert.equal(image?.width, 186);
});

// 손님이 그 단계에서 받는 양을 줄이려고 정한 한도(Vercel 전송량)
const ANIMATION_MAX_BYTES = 150 * 1024;
const STILL_MAX_BYTES = 80 * 1024;

test("①~⑦ 시연 그림 파일이 public/tutorial에 있고 화면 크기의 정확히 2배이며 용량 한도 안이다", () => {
  for (const target of DEMO_TARGETS) {
    const image = getTutorialDemoImage({ target, screen: "desktop", prefersReducedMotion: false, ...ROOMY_DESKTOP });
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

test("①~⑦ 말풍선이 그림을 넣고도 화면 안(위아래 16px 여백)에 다 들어갈 때만 그림을 그린다", () => {
  // 그림 자리는 196px + 아래 여백 14px = 210px. 그림 없는 말풍선 195px이면 195 + 210 + 16×2 = 437px 창부터 들어갑니다.
  for (const target of DEMO_TARGETS) {
    const right = { target, screen: "desktop", prefersReducedMotion: false, demoTooltipHeights: [195] } as const;
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 437 })?.src, `/tutorial/${target}-demo.webp`);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 436 }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 320 }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, viewportHeight: 300, prefersReducedMotion: true }), null, target);
    assert.equal(getTutorialDemoImage({ ...right, screen: "phonePortrait", viewportHeight: 436 }), null, target);
  }
});

test("그림을 넣고 들어간다고 판단한 높이면 배치 계산도 말풍선을 위아래 16px 여백 안에 둔다", () => {
  // 그림 판단과 배치 계산이 같은 기준을 쓰는지: 437px 창에서 그림을 넣은 405px 말풍선은 위 16, 아래 16 여백에 딱 맞습니다.
  const image = getTutorialDemoImage({ target: "cutout", screen: "desktop", prefersReducedMotion: false, demoTooltipHeights: [195], viewportHeight: 437 });
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

test("①~⑦ 그림은 가장 높은 말풍선 하나로 정해 일곱 단계가 같이 보이거나 같이 숨는다(가운데 말풍선 포함, 넘길 때 출렁이지 않게)", () => {
  // 브라우저(1280·360 폭)에서 잰 그림 없는 높이(2026-11-24 빌드): ⑤ 바닥 얼룩 지우기·⑥ 사진 색(가운데 말풍선일 수 있음) 240px이
  // 가장 높습니다. 240 + 그림 자리 210 + 위아래 16×2 = 482px 창부터 모두 그림이 들어갑니다.
  // ②(173px)만 보면 415px 창에도 들어가지만, ⑤⑥과 다르게 보였다 숨으면 단계마다 말풍선 높이가 크게 바뀝니다.
  const demoTooltipHeights = [218, 173, 195, 195, 240, 240, 195];
  const shownAt = (viewportHeight: number) => DEMO_TARGETS.map((target) =>
    getTutorialDemoImage({ target, screen: "phonePortrait", prefersReducedMotion: false, demoTooltipHeights, viewportHeight }) !== null);
  assert.deepEqual(shownAt(481), DEMO_TARGETS.map(() => false));
  assert.deepEqual(shownAt(425), DEMO_TARGETS.map(() => false));
  assert.deepEqual(shownAt(482), DEMO_TARGETS.map(() => true));
});

test("휴대폰 세로 편집기에서는 카드 구획이 툴바 위로 보일 자리(bottomReserve)까지 남을 때만 ①~⑦ 그림을 그린다", () => {
  // 그림 넣은 말풍선 450px + 위아래 16×2 + 아래에 남길 자리(툴바 106 + 구획 48 = 154) = 636px 창부터 그림
  const demoTooltipHeights = [218, 173, 195, 195, 240, 240, 195];
  const shownAt = (viewportHeight: number, bottomReserve: number) => DEMO_TARGETS.map((target) =>
    getTutorialDemoImage({ target, screen: "phonePortrait", prefersReducedMotion: false, demoTooltipHeights, viewportHeight, bottomReserve }) !== null);
  assert.deepEqual(shownAt(636, 154), DEMO_TARGETS.map(() => true));
  assert.deepEqual(shownAt(635, 154), DEMO_TARGETS.map(() => false));
  // 카드가 없는 첫 화면(가운데 말풍선)은 남길 자리가 없어 지금 기준(482px) 그대로
  assert.deepEqual(shownAt(560, 0), DEMO_TARGETS.map(() => true));
});

test("시연 그림이 있는 단계는 ①~⑦이고 ⑧ 저장은 아니다(말풍선이 그림 없는 높이를 재는 단계)", () => {
  assert.deepEqual(
    getTutorialSteps({ hasCutoutMenu: true, photoEditSections: ALL_SECTIONS }).map((step) => isTutorialDemoTarget(step.target)),
    [true, true, true, true, true, true, true, false],
  );
});

test("그림이 보이거나 숨거나 말풍선 자리 종류가 바뀌는 때는 0.25초 이동 없이 새 자리에 바로 놓는다", () => {
  const moving = "top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)";
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: false, isDemoImageToggled: false, isPlacementChanged: false }), moving);
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: false, isDemoImageToggled: true, isPlacementChanged: false }), "none");
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: true, isDemoImageToggled: false, isPlacementChanged: false }), "none");
  // ④ 레일 옆 → ⑤ 가운데처럼 자리 종류가 바뀌면 높이도 달라져, 옛 자리에서 움직이는 동안 버튼이 화면 밖으로 나갈 수 있음
  assert.equal(getTutorialTooltipTransition({ prefersReducedMotion: false, isDemoImageToggled: false, isPlacementChanged: true }), "none");
});

test("말풍선 높이를 아직 재지 않았으면 ①~⑦ 그림을 그리지 않는다(재고 나서 들어갈 때만 받음)", () => {
  for (const target of DEMO_TARGETS) {
    assert.equal(
      getTutorialDemoImage({ target, screen: "desktop", prefersReducedMotion: false, demoTooltipHeights: null, viewportHeight: 1080 }),
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
    "screen,",
    "prefersReducedMotion,",
    "demoTooltipHeights,",
    "viewportHeight,",
    "bottomReserve,",
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
