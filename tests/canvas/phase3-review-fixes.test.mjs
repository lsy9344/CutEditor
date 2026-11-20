import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readCanvasStage = () => readFileSync("src/canvas/CanvasStage.tsx", "utf8");

test("P3-3 붓 획은 마우스 왼쪽 버튼과 펜·터치 기본 입력에서만 시작한다", () => {
  const source = readCanvasStage();
  const start = source.indexOf("const startBrushStroke = (");
  const startBody = source.slice(start, source.indexOf("const moveBrushStroke = (", start));

  assert.notEqual(start, -1);
  assert.match(
    startBody,
    /if \(!isBrushPointerStart\(event\.evt\.pointerType, event\.evt\.isPrimary, event\.evt\.button\)\) return;/,
  );
});

test("P3-4 임시 획이 남아 있으면 같은 포인터 id라도 새 획을 시작하기 전에 버린다", () => {
  const source = readCanvasStage();
  const start = source.indexOf("const startBrushStroke = (");
  const startBody = source.slice(start, source.indexOf("const moveBrushStroke = (", start));

  assert.match(startBody, /if \(brushDraftRef\.current\) cancelBrushStroke\(\);/);
});

test("P3-4 창 포커스 상실과 탭 숨김에서도 임시 획과 미리보기를 지운다", () => {
  const source = readCanvasStage();

  assert.match(source, /window\.addEventListener\("blur", cancelBrushStroke\);/);
  assert.match(source, /window\.removeEventListener\("blur", cancelBrushStroke\);/);
  assert.match(source, /document\.addEventListener\("visibilitychange", cancelBrushStrokeOnHidden\);/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", cancelBrushStrokeOnHidden\);/);
  assert.match(
    source,
    /const cancelBrushStrokeOnHidden = \(\) => \{\s*if \(document\.visibilityState === "hidden"\) cancelBrushStroke\(\);\s*\};/,
  );
});
