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

const getFunctionBody = (startMarker: string, endMarker: string): string => {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `App에서 구간을 찾지 못했습니다: ${startMarker}`);
  return appSource.slice(start, end);
};

test("프레임 바꾸기 확인창은 대상 프레임만 저장하고 빠질 사진 장수는 그릴 때 현재 사진 목록으로 센다", () => {
  const confirmBranch = getFunctionBody("if (decision.kind === 'confirm')", "applyFrameChange(decision.frameType);");
  assert.ok(!confirmBranch.includes("droppedPhotoCount"), "확인창 상태에 장수를 저장하고 있습니다");
  assert.ok(!confirmBranch.includes("splitPhotosByFrame("), "확인창을 열 때 장수를 계산하고 있습니다");

  const noticeView = getFunctionBody("const droppedPhotoCount = ", "const isNoticeOpen");
  assert.ok(noticeView.includes("splitPhotosByFrame("), "안내 문구가 같은 계산을 쓰지 않습니다");
  assert.ok(noticeView.includes("editorState.userImages"), "안내 문구가 현재 사진 목록으로 세지 않습니다");
  assert.ok(noticeView.includes("getNoticeView(notice, "), "안내 문구에 계산한 장수를 넘기지 않습니다");
});

test("프레임을 적용할 때도 안내 문구와 같은 계산으로 남는 사진을 가린다", () => {
  const applyBody = getFunctionBody("const applyFrameChange = ", "const handleFrameSelect");
  assert.ok(applyBody.includes("splitPhotosByFrame("), "적용 함수가 같은 계산을 쓰지 않습니다");
  assert.ok(!applyBody.includes("validSlotIds"), "적용 함수에 옛 거르기 코드가 남아 있습니다");
});

test("확인창을 닫고 시트가 남으면 시트 안으로 포커스를 돌려준다", () => {
  assert.ok(appSource.includes("getFocusReturnCandidates("), "App이 후보 순서 계산을 쓰지 않습니다");
  const returnEffect = getFunctionBody("// 닫힌 뒤 포커스 돌려주기", "const applyEditorDocument");
  assert.ok(returnEffect.includes('[data-focus-return="sheet-close"]'), "열린 시트의 닫기 버튼을 후보로 두지 않았습니다");
  assert.ok(
    /data-focus-return="sheet-close"[\s\S]{0,200}닫기\s*<\/button>/.test(appSource),
    "휴대폰 시트의 닫기 버튼에 표시가 없습니다",
  );
});

test("가져오기를 시작할 때 지난 상태 줄을 지우되 요청을 보내지 않는 조기 반환에서는 지우지 않는다", () => {
  const importRequest = getFunctionBody("const handleBoothyImportRequest = useCallback(", "}, [boothyLaunchContext, isBoothyImportBridgeAvailable");
  const clearIndex = importRequest.indexOf("setInlineStatus(null)");
  const lastEarlyReturnIndex = importRequest.indexOf("if (!targetWindow)");
  const firstPostIndex = importRequest.indexOf("postMessage(");

  assert.ok(clearIndex >= 0, "상태 줄을 지우는 줄이 없습니다");
  assert.ok(importRequest.indexOf("return false;", lastEarlyReturnIndex) < clearIndex, "조기 반환 앞에서 상태 줄을 지웁니다");
  assert.ok(clearIndex < firstPostIndex, "요청을 보낸 뒤에 상태 줄을 지웁니다");
  assert.equal(importRequest.split("setInlineStatus(null)").length - 1, 1, "상태 줄 지우기가 여러 곳입니다");
});

// UX2-2: 저장에서 시작한 안내는 닫을 때 지금 배치의 저장 버튼으로 돌아간다. 프레임 바꾸기는 기존 순서를 지킨다.
test("저장 요청은 안내가 저장에서 시작했다고 기억하고 확인창 효과는 프레임 바꾸기로 기억한다", () => {
  const saveRequest = getFunctionBody("const handleSaveRequest = ", "const isSaveWaitingForImages");
  assert.ok(saveRequest.includes("rememberNoticeOpener(null, 'save')"), "저장 요청이 시작한 곳을 저장으로 기억하지 않습니다");

  const openEffect = getFunctionBody("// 확인창 배경: 연 곳 기억", "// 카드에 포커스.");
  assert.ok(openEffect.includes("rememberNoticeOpener(noticeElement, 'frame-change')"), "확인창 효과가 프레임 바꾸기로 기억하지 않습니다");

  const returnEffect = getFunctionBody("// 닫힌 뒤 포커스 돌려주기", "const applyEditorDocument");
  assert.ok(returnEffect.includes("origin: focusReturnOriginRef.current"), "돌려줄 후보 계산에 시작한 곳을 넘기지 않습니다");
});

// UX2-3: 같은 안내에서 문장만 바뀔 때는 카드로 포커스를 옮기지 않는다. 새 안내가 열리거나 종류가 바뀔 때만 준다.
test("카드 포커스 효과는 안내 객체가 아니라 안내 종류에만 반응한다", () => {
  const focusEffect = getFunctionBody("// 카드에 포커스.", "// 닫힌 뒤 포커스 돌려주기");
  assert.ok(focusEffect.includes("[noticeKind, cutoutBusyId]"), "카드 포커스 효과가 안내 종류에 반응하지 않습니다");
  assert.ok(!focusEffect.includes("[notice,"), "카드 포커스 효과가 안내 객체가 바뀔 때마다 돌고 있습니다");
  assert.ok(appSource.includes("const noticeKind = notice?.kind ?? null"), "안내 종류를 따로 뽑지 않았습니다");
});
