import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("모바일 저장 폴백은 같은 탭 이동 대신 새 탭 미리보기를 연다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const openExportPreview = \(previewUrl: string\) => \{/);
  assert.match(source, /window\.open\(previewUrl, '_blank', 'noopener,noreferrer'\);/);
  assert.doesNotMatch(source, /window\.location\.href = url;/);
  assert.doesNotMatch(source, /window\.location\.href = exportObjectUrl;/);
});

test("모바일 저장 시트의 이미지 열기 버튼도 공통 미리보기 helper를 사용한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /openExportPreview\(url\);/);
  assert.match(source, /openExportPreview\(exportObjectUrl\);/);
});

test("모바일 다운로드 폴백 앵커는 현재 탭 이탈을 막기 위해 새 탭으로 연다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /a\.target = '_blank';/);
  assert.match(source, /a\.rel = 'noopener noreferrer';/);
});
