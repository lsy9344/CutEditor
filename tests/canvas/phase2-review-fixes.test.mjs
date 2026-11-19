import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readCanvasStage = () => readFileSync("src/canvas/CanvasStage.tsx", "utf8");

test("P2-1 전후 비교 버튼은 캔버스 제어판의 되돌리기·다시 하기 옆에 있고 사진 선택과 무관하게 보인다", () => {
  const source = readCanvasStage();
  const historyRowStart = source.indexOf("<div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>");
  const frameColorStart = source.indexOf("{selectedFrame !== \"1l\" && (", historyRowStart);
  const compareTextIndex = source.indexOf("누르고 있으면 원본", historyRowStart);

  assert.notEqual(historyRowStart, -1);
  assert.notEqual(frameColorStart, -1);
  assert.notEqual(compareTextIndex, -1);
  assert.ok(compareTextIndex < frameColorStart, "비교 버튼은 프레임 색상 줄보다 앞(되돌리기·다시 하기 줄)에 있어야 합니다");

  const compareButtonStart = source.lastIndexOf("<button", compareTextIndex);
  const beforeCompareButton = source.slice(historyRowStart, compareButtonStart);
  assert.match(beforeCompareButton, /\{photoEditSections\.showBox && \(/);
  assert.doesNotMatch(beforeCompareButton, /selectedImage && photoEditSections\.showBox/);
  assert.match(source, /disabled=\{!hasEditedPhotos\}/);
});

test("P2-2 기본값으로 돌아간 사진의 캐시도 정리 대상에 넣는다", () => {
  const source = readCanvasStage();

  assert.match(
    source,
    /const editedPhotoIds = new Set\(\s*userImages\s*\.filter\(\(userImage\) => !isDefaultPhotoEdits\(userImage\.edits\)\)\s*\.map\(\(userImage\) => userImage\.id\),\s*\);/,
  );
  assert.match(
    source,
    /pruneEditedPhotoCanvases\(new Set\(userImages\.map\(\(userImage\) => userImage\.id\)\), selectedImageId, editedPhotoIds\);/,
  );
});

test("P2-4 비교 버튼이 사라지거나 편집기를 나가면 compareHeld를 해제한다", () => {
  const source = readCanvasStage();

  assert.match(
    source,
    /if \(!photoEditSections\.showBox && photoEdit\.compareHeld\) \{\s*photoEdit\.onCompareHeldChange\(false\);\s*\}/,
  );
  assert.match(
    source,
    /useEffect\(\(\) => \(\) => \{\s*photoEdit\.onCompareHeldChange\(false\);\s*\}, \[photoEdit\.onCompareHeldChange\]\);/,
  );
});

test("P2-7 빈 칸 안내 레이블 그룹은 입력을 받지 않아 슬롯 배경의 파일 선택이 열린다", () => {
  const source = readCanvasStage();
  const labelStart = source.indexOf("{!hasImage && !exportMode && (() => {");

  assert.notEqual(labelStart, -1);
  assert.match(source.slice(labelStart), /return \(\s*<Group listening=\{false\}>/);
});
