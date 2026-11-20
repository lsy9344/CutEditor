import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");

test("App에는 옛 저장 코드(alert, Boothy 저장 카드, 옛 파일 이름)가 없다", () => {
  const removedCode = [
    "alert(",
    "BOOTHY_SAVE_NOTICE_AUTO_CLOSE_MS",
    "boothySaveNoticeState",
    "makeSuggestedFilename",
    "cut_export_",
    "supportsFilePicker",
    "showMissingStickerNotice",
  ];

  for (const code of removedCode) {
    assert.ok(!appSource.includes(code), `옛 코드가 남아 있습니다: ${code}`);
  }
});

test("저장 입구는 모두 handleSaveRequest다", () => {
  const requiredCode = [
    "onExport={handleSaveRequest}",
    "onClick={handleSaveRequest}",
    "onExport: handleSaveRequest",
  ];
  const removedCode = [
    "onClick={handleExport}",
    "onExport={handleExport}",
    "onExport: handleExport",
  ];

  for (const code of requiredCode) {
    assert.ok(appSource.includes(code), `App에서 찾지 못했습니다: ${code}`);
  }
  for (const code of removedCode) {
    assert.ok(!appSource.includes(code), `옛 저장 입구가 남아 있습니다: ${code}`);
  }
});

const getAppSection = (startMarker: string, endMarker: string): string => {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `App에서 구간을 찾지 못했습니다: ${startMarker}`);
  return appSource.slice(start, end);
};

// UX2-1: 저장 위치 창이 열린 사이 캔버스가 바뀌면 사진이 빠진 PNG를 쓰지 않는다.
test("저장은 위치 창이 돌아온 뒤 렌더할 캔버스의 준비를 확인하는 함수를 흐름에 넘긴다", () => {
  const exportBody = getAppSection("const handleExport = async", "// 모바일: '사진에 저장' 버튼 핸들러");
  assert.ok(exportBody.includes("isCanvasReady:"), "저장 흐름에 준비 확인 함수를 넘기지 않습니다");
  assert.ok(exportBody.includes("stageRef.current === "), "위치 창 전과 같은 캔버스인지 확인하지 않습니다");
  assert.ok(exportBody.includes("result.kind === 'photos-not-ready'"), "준비 안 돼 멈춘 결과를 처리하지 않습니다");
  const notReadyBranch = getAppSection("result.kind === 'photos-not-ready'", "retrySaveRef.current = null;");
  assert.ok(notReadyBranch.includes("retrySaveRef.current = result.retry"), "멈춘 저장의 경로·이름·핸들을 남기지 않습니다");
  assert.ok(notReadyBranch.includes("isWaitingForPhotos: true"), "기존 사진 기다림 안내를 쓰지 않습니다");
});

test("준비 확인은 클릭 때의 클로저 값이 아니라 지금 ref를 읽는다", () => {
  const waiting = getAppSection("const isSaveWaitingForImages = ", "const activeCategory");
  assert.ok(waiting.includes("currentDocumentRef.current.userImages"), "지금 문서의 사진 목록을 읽지 않습니다");
  assert.ok(waiting.includes("cutoutImagesStateRef.current"), "지금 누끼 상태를 읽지 않습니다");
  assert.ok(!waiting.includes("editorState.userImages"), "클릭 때의 사진 목록을 읽고 있습니다");
  assert.ok(!waiting.includes("cutoutImagesState.kind"), "클릭 때의 누끼 상태를 읽고 있습니다");
});
