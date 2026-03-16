import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loadModule = async () =>
  import(`../src/canvas/keyboardShortcuts.ts?ts=${Date.now()}`);

test("선택된 이미지 id가 있으면 해당 이미지를 우선 반환한다", async () => {
  const { getSelectedImageFromState } = await loadModule();
  const images = [
    { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { id: "img-2", slotId: "slot-2", x: 10, y: 20, scaleX: 1.2, scaleY: 1.2, rotation: 5 },
  ];

  const selected = getSelectedImageFromState({
    selection: "img-2",
    selectedSlot: "slot-1",
    userImages: images,
  });

  assert.equal(selected?.id, "img-2");
});

test("선택된 이미지가 없으면 selectedSlot 기준으로 이미지를 찾는다", async () => {
  const { getSelectedImageFromState } = await loadModule();
  const images = [
    { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { id: "img-2", slotId: "slot-2", x: 10, y: 20, scaleX: 1.2, scaleY: 1.2, rotation: 5 },
  ];

  const selected = getSelectedImageFromState({
    selection: "missing",
    selectedSlot: "slot-2",
    userImages: images,
  });

  assert.equal(selected?.id, "img-2");
});

test("Tab 순환은 프레임 슬롯 순서대로 이미지가 있는 슬롯만 돈다", async () => {
  const { getNextImageSelection } = await loadModule();
  const images = [
    { id: "img-2", slotId: "slot-2", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { id: "img-4", slotId: "slot-4", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  ];

  const next = getNextImageSelection({
    selection: "img-2",
    selectedSlot: "slot-2",
    slotOrder: ["slot-1", "slot-2", "slot-3", "slot-4"],
    userImages: images,
    direction: 1,
  });

  assert.deepEqual(next, { imageId: "img-4", slotId: "slot-4" });
});

test("Shift+Tab은 첫 번째 이미지에서 마지막 이미지로 순환한다", async () => {
  const { getNextImageSelection } = await loadModule();
  const images = [
    { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    { id: "img-3", slotId: "slot-3", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  ];

  const next = getNextImageSelection({
    selection: "img-1",
    selectedSlot: "slot-1",
    slotOrder: ["slot-1", "slot-2", "slot-3"],
    userImages: images,
    direction: -1,
  });

  assert.deepEqual(next, { imageId: "img-3", slotId: "slot-3" });
});

test("키보드 이동은 현재 스케일을 반영해 슬롯 허용 범위 안으로 클램프된다", async () => {
  const { getClampedKeyboardMove } = await loadModule();

  const moved = getClampedKeyboardMove({
    image: { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 2, scaleY: 2, rotation: 0 },
    slot: { id: "slot-1", x: 100, y: 200, width: 300, height: 300 },
    displaySize: { width: 150, height: 120 },
    delta: { x: 400, y: -500 },
  });

  assert.deepEqual(moved, { x: 225, y: -330 });
});

test("확대/축소는 최소 스케일 0.1 아래로 내려가지 않는다", async () => {
  const { getScaledTransform } = await loadModule();

  const scaled = getScaledTransform({
    image: { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 0.11, scaleY: 0.11, rotation: 0 },
    scaleFactor: 0.5,
  });

  assert.deepEqual(scaled, { scaleX: 0.1, scaleY: 0.1 });
});

test("회전은 현재 각도에 delta를 더한다", async () => {
  const { getRotatedTransform } = await loadModule();

  const rotated = getRotatedTransform({
    image: { id: "img-1", slotId: "slot-1", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 15 },
    deltaDegrees: -5,
  });

  assert.deepEqual(rotated, { rotation: 10 });
});

test("캔버스 래퍼는 포인터다운 캡처 없이 키보드 포커스를 받는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /onKeyDown=\{handleCanvasKeyDown\}/);
  assert.doesNotMatch(source, /onPointerDownCapture=\{focusCanvasArea\}/);
});

test("캔버스 래퍼는 활성 outline으로 레이아웃이 달라지지 않는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.doesNotMatch(source, /outline:\s*isCanvasActive/);
  assert.doesNotMatch(source, /outlineOffset:/);
});

test("캔버스 키보드 삭제는 스티커 삭제 콜백도 지원한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /onStickerDelete\?: \(stickerId: string\) => void;/);
  assert.match(source, /onStickerDelete\?\.\(selectedSticker\.id\)/);
});

test("App은 스티커 삭제 콜백을 CanvasStage에 전달한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /<CanvasStage[\s\S]*onStickerDelete=\{handleStickerDelete\}[\s\S]*\/>/
  );
});

test("스티커 클릭은 캔버스 포커스를 유지하도록 selectSticker를 사용한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const selectSticker = useCallback/);
  assert.match(source, /onClick=\{\(\) => selectSticker\(sticker.id\)\}/);
  assert.match(source, /onTap=\{\(\) => selectSticker\(sticker.id\)\}/);
  assert.match(source, /onTouchStart=\{\(\) => selectSticker\(sticker.id\)\}/);
});

test("스티커 방향키 이동은 좌표에 delta를 더한다", async () => {
  const { getNudgedPosition } = await loadModule();

  const moved = getNudgedPosition({
    x: 120,
    y: 240,
    delta: { x: -20, y: 5 },
  });

  assert.deepEqual(moved, { x: 100, y: 245 });
});

test("캔버스 키보드 방향키는 선택된 스티커 이동도 지원한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /onStickerUpdate\?\.\(selectedSticker\.id,/);
  assert.match(source, /getNudgedPosition\(\{/);
});

test("텍스트 정렬은 캔버스가 아니라 선택 박스 폭을 기준으로 렌더링한다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const stageSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(appSource, /boxWidth:\s*number;/);
  assert.match(appSource, /const getMinimumTextBoxWidth = useCallback/);
  assert.match(appSource, /newText\.boxWidth = getMinimumTextBoxWidth\(newText\);/);
  assert.doesNotMatch(appSource, /updatedText\.x = getAlignedTextX\(updatedText, updatedText\.textAlign\);/);

  assert.match(stageSource, /width=\{textItem\.boxWidth\}/);
  assert.match(stageSource, /offsetX=\{textItem\.boxWidth \/ 2\}/);
  assert.match(stageSource, /onTransformEnd=\{\(\) => \{/);
  assert.match(stageSource, /boxWidth: Math\.max\(10, node\.width\(\) \* Math\.abs\(node\.scaleX\(\)\)\)/);
});
