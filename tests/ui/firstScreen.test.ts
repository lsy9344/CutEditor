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
