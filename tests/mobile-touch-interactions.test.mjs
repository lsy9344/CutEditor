import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("스티커 삽입 버튼은 실제로 로드된 미리보기만 허용한다", () => {
  const source = readFileSync("src/ui/SidebarRight.tsx", "utf8");

  assert.match(source, /loadedStickerPreviews/);
  assert.match(source, /const isInsertable = isReady && loadedStickerPreviews\[slot\.key\] === true;/);
  assert.match(source, /onLoad=\{\(\) => handleStickerPreviewLoad\(slot\.key\)\}/);
  assert.match(source, /cursor: isInsertable \? 'pointer' : 'not-allowed'/);
});

test("모바일 편집 캔버스는 기본적으로 스크롤을 허용한다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  assert.match(source, /\.app-main--mobile-editor \.konvajs-content,/);
  assert.match(source, /\.app-main--mobile-editor \.konvajs-content canvas \{/);
  assert.match(source, /touch-action:\s*pan-x pan-y;/);
});

test("CanvasStage는 모바일 드래그를 위해 Konva 포인터 캡처를 켠다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /Konva\.hitOnDragEnabled = true;/);
  assert.match(source, /Konva\.capturePointerEventsEnabled = true;/);
});

test("App은 캔버스 selection에 editorState 선택값을 그대로 전달한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /<CanvasStage[\s\S]*selection=\{editorState\.selection\}[\s\S]*\/>/);
});

test("CanvasStage는 선택된 이미지만 모바일에서 직접 조작할 수 있게 제한한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const isTouchManipulationActive = Boolean\(selection\);/);
  assert.match(source, /const isSelectedImage = selection === userImage\.id;/);
  assert.match(source, /draggable=\{!exportMode && isSelectedImage\}/);
  assert.match(source, /selectImage\(userImage\.id, userImage\.slotId\);/);
  assert.match(source, /if \(e\.evt\.touches\.length < 2\) \{\s*pinchRef\.current = null;\s*return;\s*\}/s);
  assert.match(source, /onTap=\{\(\) => \{\s*selectImage\(userImage\.id, slot\.id\);\s*\}\}/s);
});

test("CanvasStage는 선택이 없을 때 모바일 캔버스 스크롤을 다시 허용한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
  const css = readFileSync("src/components/components.css", "utf8");

  assert.match(source, /const touchAction = isTouchManipulationActive \? 'none' : 'pan-x pan-y';/);
  assert.match(source, /stageContainer\.style\.touchAction = touchAction;/);
  assert.match(source, /canvas\.style\.touchAction = touchAction;/);
  assert.match(css, /touch-action:\s*pan-x pan-y;/);
});

test("CanvasStage는 배경을 탭하면 현재 선택을 해제한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const clearCanvasSelection = useCallback\(\(\) => \{/);
  assert.match(source, /onSelect\?\.\(null\);/);
  assert.match(source, /onSlotSelect\?\.\(null\);/);
  assert.match(source, /onMouseDown=\{handleStagePointerDown\}/);
  assert.match(source, /onTouchStart=\{handleStagePointerDown\}/);
});

test("CanvasStage는 스티커 이미지를 상위 캐시에서 읽고 선택된 스티커만 드래그한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /draggable=\{!exportMode && isSelected\}/);
  assert.match(source, /onDragStart=\{\(\) => selectSticker\(sticker\.id\)\}/);
  assert.match(source, /id=\{`transformer-\$\{sticker\.id\}`\}[\s\S]*flipEnabled=\{false\}/);
});
