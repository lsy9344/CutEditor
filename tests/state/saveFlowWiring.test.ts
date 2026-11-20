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
