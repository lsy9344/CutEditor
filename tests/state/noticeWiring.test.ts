import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");

test("App에는 옛 프레임 변경 확인과 가져오기 실패 alert 코드가 없다", () => {
  const removedCode = [
    "pendingFrameChange",
    "프레임 변경 확인",
    "디자인 캔버스의 모든 편집 내용이 초기화됩니다",
    "세션 사진을 편집기로 가져오지 못했습니다",
    "alert(`${event.data.message}",
  ];

  for (const code of removedCode) {
    assert.ok(!appSource.includes(code), `옛 코드가 남아 있습니다: ${code}`);
  }
});

test("App은 안내 모듈과 모달 포커스 모듈, 상태 줄 자리를 실제로 쓴다", () => {
  const requiredCode = [
    "getNoticeView(",
    "getInlineStatusView(",
    "getWrappedFocusIndex(",
    "pickFocusReturnIndex(",
    'role="status"',
  ];

  for (const code of requiredCode) {
    assert.ok(appSource.includes(code), `App에서 찾지 못했습니다: ${code}`);
  }
});
