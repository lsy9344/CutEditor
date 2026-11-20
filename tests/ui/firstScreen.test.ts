import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

test("첫 화면·칸 라벨·튜토리얼 파일에 옛 문구가 남아 있지 않다", () => {
  const sourcePaths = [
    "src/canvas/FrameGallery.tsx",
    "src/ui/SidebarLeft.tsx",
    "src/App.tsx",
    "src/canvas/CanvasStage.tsx",
    "src/ui/TutorialOverlay.tsx",
  ];
  const removedTexts = [
    "왼쪽에서 원하는 컷 수를 먼저 선택해 주세요",
    "{selectedCategory} 프레임 선택",
    "프레임 컷 수 선택",
    "상세 스타일을 선택하세요",
    "← 돌아가기",
    "클릭해서 세션 사진 선택",
    "클릭해서 이미지 추가",
    "이미지 로딩 실패",
    "이미지 로딩 중...",
    "왼쪽 메뉴에서 프레임을 먼저 선택해 주세요.",
    "① 프레임 선택",
    "② 글씨 추가",
    "③ 스티커 꾸미기",
    "드래그해서 원하는 위치에 놓으세요",
  ];

  for (const sourcePath of sourcePaths) {
    const source = readFileSync(sourcePath, "utf8");
    for (const removedText of removedTexts) {
      assert.ok(!source.includes(removedText), `${sourcePath}에 옛 문구가 남아 있습니다: ${removedText}`);
    }
  }
});

test("src 아래 코드는 브라우저 저장소를 쓰지 않는다", () => {
  const storageNames = ["localStorage", "sessionStorage", "indexedDB", "document.cookie"];
  const sourcePaths = (readdirSync("src", { recursive: true }) as string[])
    .filter((relativePath) => /\.tsx?$/.test(relativePath))
    .map((relativePath) => `src/${relativePath}`);

  assert.ok(sourcePaths.length > 0, "src 아래 .ts/.tsx 파일을 찾지 못했습니다");
  for (const sourcePath of sourcePaths) {
    const source = readFileSync(sourcePath, "utf8");
    for (const storageName of storageNames) {
      assert.ok(!source.includes(storageName), `${sourcePath}에서 브라우저 저장소를 씁니다: ${storageName}`);
    }
  }
});

// UX3-2: 화면 모드 조건은 목록 전체에 이미 걸려 있으므로 ✓ 표시는 선택된 프레임만 본다.
test("사이드바 ✓ 표시는 화면 모드를 다시 보지 않고 선택된 프레임만 본다", () => {
  const source = readFileSync("src/ui/SidebarLeft.tsx", "utf8");
  assert.ok(!source.includes("canvasMode === 'editor'"), "✓ 표시에 목록 조건과 겹치는 모드 조건이 남아 있습니다");
  assert.ok(source.includes("{selectedFrame === option.value && ("), "✓ 표시가 선택된 프레임 조건만 쓰지 않습니다");
  assert.equal(source.split("canvasMode !== 'gallery'").length - 1, 1, "화면 모드 조건이 목록 한 곳이 아닙니다");
});

// UX3-4: 튜토리얼이 열린 동안 포커스가 튜토리얼 버튼에 있어도 window의 되돌리기·다시 하기가 뒤 문서를 바꾸지 않는다.
test("튜토리얼이 열려 있는 동안 전역 되돌리기·다시 하기 단축키는 실행되지 않는다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const start = appSource.indexOf("// 되돌리기·다시 하기 단축키");
  const end = appSource.indexOf("handleRedo]);", start);
  assert.ok(start >= 0 && end > start, "되돌리기·다시 하기 단축키 효과를 찾지 못했습니다");
  const shortcutEffect = appSource.slice(start, end + "handleRedo]);".length);

  assert.match(shortcutEffect, /if \(exportMode \|\| isTutorialOpen\) return;/, "튜토리얼이 열린 동안 단축키를 막지 않습니다");
  assert.ok(shortcutEffect.includes("[exportMode, isTutorialOpen, handleUndo, handleRedo]"), "효과가 튜토리얼 열림에 반응하지 않습니다");
  assert.ok(appSource.indexOf("const isTutorialOpen = ") < start, "튜토리얼 열림을 선언하기 전에 효과가 읽습니다");
});

test("튜토리얼의 Tab·Shift+Tab·Esc 처리는 그대로 두고 새 단축키 장치를 만들지 않는다", () => {
  const overlaySource = readFileSync("src/ui/TutorialOverlay.tsx", "utf8");
  const appSource = readFileSync("src/App.tsx", "utf8");
  assert.ok(overlaySource.includes("Escape") && overlaySource.includes("Tab"), "튜토리얼 키 처리가 바뀌었습니다");
  assert.equal(appSource.split('window.addEventListener("keydown", onKeyDown);').length - 1, 1, "되돌리기 단축키 리스너가 하나가 아닙니다");
});
