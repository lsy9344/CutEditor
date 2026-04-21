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

  assert.match(source, /getMobileSaveFallback\(/);
  assert.match(source, /if \(mobileSaveFallback === 'manual-preview'\) \{/);
  assert.match(source, /setExportManualSaveRequired\(true\);/);
  assert.doesNotMatch(source, /a\.target = '_blank';/);
});

test("갤럭시 계열 모바일 저장 시트는 열리자마자 길게 눌러 저장 안내를 준비한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /shouldShowManualSaveHintImmediately/);
  assert.match(source, /setExportManualSaveRequired\(shouldShowManualSaveHintImmediately\(\{/);
  assert.match(source, /아래 미리보기를 길게 눌러 이미지를 저장해 주세요/);
});

test("공유 시트 취소는 후속 다운로드로 이어지지 않고 조용히 종료한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /if \(isShareAbortError\(error\)\) \{/);
  assert.match(source, /return;\s*\n\s*}\s*\n\s*console\.warn\('Web Share API 실패 또는 미지원'/);
});

test("모바일 내보내기는 첫 렌더부터 보수적인 해상도 상한을 사용한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const mobileExportLimits = isResponsiveMobile/);
  assert.match(source, /getMobileExportLimits\(\{ userAgent: getCurrentUserAgent\(\) \}\)/);
  assert.match(source, /initialMaxWidthPx: mobileExportLimits\?\.initialMaxWidthPx/);
  assert.match(source, /fallbackMaxWidthPx: mobileExportLimits\?\.fallbackMaxWidthPx \?\? 3072/);
});

test("Boothy 내재화 저장은 saveUrl 브리지를 먼저 사용하고 파일 저장기로 내려가지 않는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /function trySaveToBoothyHost\(/);
  assert.match(source, /type: 'editor\.save_requested'/);
  assert.match(source, /if \(savedViaHostMessage\) \{\s*return true;\s*}/);
  assert.match(source, /const saveUrl = boothyLaunchContext\?\.completion\?\.saveUrl\?\.trim\(\) \?\? '';/);
  assert.match(source, /const response = await fetch\(saveUrl, \{/);
  assert.match(source, /const savedToBoothySession = await saveToBoothySession\(\{/);
  assert.match(source, /if \(savedToBoothySession\) \{\s*return;\s*}/);
});

test("Boothy 내재화 편집기는 마운트 직후 host ready 메시지를 보낸다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /type: 'editor\.host_ready'/);
  assert.match(source, /window\.parent\.postMessage\(message, '\*'\);/);
  assert.match(source, /notifyBoothyHostReady\(boothyLaunchContext\);/);
});
