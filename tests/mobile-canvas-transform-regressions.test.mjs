import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App은 CanvasStage에 현재 전체 selection 상태를 전달해 모바일 이미지 선택이 동작한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /<CanvasStage[\s\S]*selection=\{editorState\.selection\}[\s\S]*\/>/
  );
  assert.doesNotMatch(source, /selection=\{selectedTextId \|\| selectedStickerId\}/);
});

test("텍스트 Transformer는 변형값을 저장한 뒤 노드 스케일을 1로 초기화한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /import \{ getNextTextTransformState \} from "\.\/textTransform";/);
  assert.match(source, /const nextState = getNextTextTransformState\(\{/);
  assert.match(source, /width: node\.width\(\),/);
  assert.match(source, /scaleX: node\.scaleX\(\),/);
  assert.match(source, /scaleY: node\.scaleY\(\),/);
  assert.match(source, /onTextUpdate\?\.\(textItem\.id, nextState\);/);
  assert.match(source, /node\.scaleX\(1\);/);
  assert.match(source, /node\.scaleY\(1\);/);
});

test("모바일 이미지 pinch는 현재 이미지 배율을 기준으로 시작하고 첫 제스처에서 선택을 동기화한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /if \(!isSelectedImage && e\.evt\.touches\.length < 2\) \{/);
  assert.match(source, /initScale: Number\.isFinite\(userImage\.scaleX\) \? userImage\.scaleX : 1,/);
  assert.match(source, /if \(!isSelectedImage\) \{\s*selectImage\(userImage\.id, userImage\.slotId\);\s*\}/s);
});

test("스티커 Transformer도 상태 저장 후 노드 스케일을 기본값으로 정리한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const appliedScaleX = Math\.abs\(rawScaleX\) \|\| 1;/);
  assert.match(source, /const appliedScaleY = Math\.abs\(rawScaleY\) \|\| 1;/);
  assert.match(source, /node\.scaleX\(sticker\.flipX \? -appliedScaleX : appliedScaleX\);/);
  assert.match(source, /node\.scaleY\(sticker\.flipY \? -appliedScaleY : appliedScaleY\);/);
  assert.match(source, /scaleX: appliedScaleX,/);
  assert.match(source, /scaleY: appliedScaleY,/);
});
