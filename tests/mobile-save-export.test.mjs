import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readHandleExportSource } from "./helpers/readHandleExportSource.mjs";

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
  assert.match(source, /아래 사진을 길게 눌러 저장해 주세요\./);
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
  assert.match(source, /saveToBoothy: \(blob\) => saveToBoothySession\(\{ blob, frameType \}\),/);
  assert.match(source, /const route = getSaveRoute\(\{\s*expectsBoothySessionSave,/);
});

test("Boothy 내재화 편집기는 마운트 직후 host ready 메시지를 보낸다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /type: 'editor\.host_ready'/);
  assert.match(source, /window\.parent\.postMessage\(message, '\*'\);/);
  assert.match(source, /notifyBoothyHostReady\(boothyLaunchContext\);/);
});

test("Boothy 가져오기 재시도는 남아 있는 같은 correlationId를 다시 보내 재열기를 복구한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /if \(pendingBoothyImport\) \{/);
  assert.match(source, /correlationId: pendingBoothyImport\.correlationId,\s*\n\s*slotId,/);
  assert.match(
    source,
    /targetWindow\.postMessage\(\s*\{\s*\n\s*correlationId: pendingBoothyImport\.correlationId,\s*\n\s*sessionId: boothyLaunchContext\?\.sessionId\?\.trim\(\) \|\| undefined,\s*\n\s*type: 'editor\.import_requested',/,
  );
});

test("데스크톱 저장은 클릭 직후 저장 위치 창을 먼저 열고, 그 뒤에 폰트를 기다려 렌더한다", () => {
  const exportSource = readHandleExportSource();

  // 저장 위치 창은 runSaveFlow의 첫 await(pickFile)에서 열린다(tests/state/saveFlow.test.ts).
  // handleExport는 runSaveFlow보다 먼저 기다리지 않고, 폰트는 그 뒤 prepareCanvas 안에서 렌더 모양으로 바꾸기 전에 받는다.
  const firstAwaitIndex = exportSource.indexOf("await ");
  const saveFlowIndex = exportSource.indexOf("await runSaveFlow(");
  const prepareIndex = exportSource.indexOf("prepareCanvas: async () => {");
  const fontWaitIndex = exportSource.indexOf("await loadTextFontsForSave(textFontFamilies)");
  const exportModeIndex = exportSource.indexOf("setExportMode(true);");
  assert.ok(saveFlowIndex >= 0, "저장 흐름 호출이 없습니다");
  assert.equal(firstAwaitIndex, saveFlowIndex, "저장 위치 창보다 먼저 기다리는 일이 있으면 클릭 활성 상태가 끝날 수 있습니다");
  assert.ok(saveFlowIndex < prepareIndex && prepareIndex < fontWaitIndex && fontWaitIndex < exportModeIndex);
  // 쓰는 글꼴은 누른 순간의 글씨에서 정한다.
  assert.match(exportSource, /const textFontFamilies = texts\.map\(\(text\) => text\.fontFamily\);/);
});

test("저장 위치 창이 만든 파일은 저장을 멈춰도 지우지 않는다(손님이 고른 기존 파일 보호)", () => {
  const exportSource = readHandleExportSource();

  assert.doesNotMatch(exportSource, /\.remove\b/);
});

test("저장하는 동안 중복 저장을 막고, 진행 안내가 편집 화면을 잠근다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const exportSource = readHandleExportSource();

  assert.match(exportSource, /if \(exportInFlightRef\.current\) return;\s*exportInFlightRef\.current = true;/);
  assert.match(exportSource, /finally \{\s*exportInFlightRef\.current = false;[\s\S]*?setIsExportInFlight\(false\);/);
  // 저장 위치 창을 고른 뒤(폰트 대기 전) 진행 안내를 띄운다. 안내가 떠 있으면 나머지 화면은 inert다.
  assert.match(appSource, /showProgress: \(\) => setNotice\(\{ kind: 'save-progress' \}\),/);
  assert.match(appSource, /if \(!isNoticeOpen \|\| !container \|\| !noticeElement\) return;[\s\S]*?setInertOutside\(\{ container, keep: \[noticeElement, cutoutLockRef\.current\] \}\);/);
});

test("저장이 시작되면 열린 폰트 창을 닫고, 저장 중에는 폰트를 바꾸지 않는다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const panelSource = readFileSync("src/ui/EditorPanel.tsx", "utf8");

  // 폰트 창은 document.body에 떠 있어 진행 안내의 inert가 닿지 않으므로 저장 중임을 따로 알린다.
  assert.match(appSource, /const sharedEditorPanelProps = \{[\s\S]*?isSaving: isExportInFlight,[\s\S]*?\};/);

  assert.match(panelSource, /isSaving\?: boolean;/);
  assert.match(panelSource, /useEffect\(\(\) => \{\s*if \(isSaving\) setFontPickerOpen\(false\);\s*\}, \[isSaving\]\);/);
  assert.match(
    panelSource,
    /const handleFontFamilyChange = \(newFontFamily: string\) => \{\s*(?:\/\/.*\n\s*)?if \(isSaving\) return;/,
  );
});

test("저장 중 도착한 Boothy 사진은 바로 넣지 않고 보관했다가, 저장이 끝난 뒤 그 슬롯에 넣는다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");

  // 늦은 응답: 저장 중이면 저장 PNG·slotAssignments가 클릭 시점 상태로 맞도록 보관만 한다.
  assert.match(
    appSource,
    /\} else if \(exportInFlightRef\.current\) \{\s*deferredBoothyImportRef\.current = \{ file, slotId: pendingBoothyImport\.slotId \};[^\n]*\n\s*\} else \{\s*handleImageUpload\(file, pendingBoothyImport\.slotId\);/,
  );
  // 성공·실패·취소 모두 지나는 finally가 저장 중 표시를 끄면, 보관한 사진을 넣는다.
  assert.match(
    appSource,
    /useEffect\(\(\) => \{\s*if \(isExportInFlight\) return;\s*const deferredImport = deferredBoothyImportRef\.current;\s*deferredBoothyImportRef\.current = null;\s*if \(deferredImport\) handleImageUpload\(deferredImport\.file, deferredImport\.slotId\);\s*\}, \[isExportInFlight\]\);/,
  );
});
