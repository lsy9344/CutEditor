# Sticker Slots Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 오른쪽 스티커 탭이 `1s`부터 `10s`까지 10개의 슬롯을 고정으로 보여주고, 실제 이미지 파일은 나중에 `public/stickers`에 추가해도 코드 수정 없이 확장자를 자동 인식하도록 만든다.

**Architecture:** 스티커 슬롯 규칙을 순수 헬퍼로 분리해 테스트 가능하게 만든 뒤, `SidebarRight`는 그 헬퍼가 만든 슬롯 데이터를 렌더링한다. 각 슬롯은 여러 확장자 후보를 순서대로 시도하고, 모두 실패하면 준비 중 상태를 보여준다.

**Tech Stack:** React, TypeScript, Vite, Node built-in assertions

---

### Task 1: 스티커 슬롯 규칙 분리

**Files:**
- Create: `src/ui/stickerCatalog.ts`
- Create: `tests/ui/stickerCatalog.test.ts`

**Step 1: Write the failing test**

테스트에서 아래 동작을 검증한다.
- 기본 슬롯 수는 10개다.
- 첫 번째 슬롯 키는 `1s`, 마지막 슬롯 키는 `10s`다.
- 각 슬롯은 `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg` 순서 후보를 가진다.

**Step 2: Run test to verify it fails**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests`

Expected: FAIL because `src/ui/stickerCatalog.ts` does not exist yet.

**Step 3: Write minimal implementation**

헬퍼에서 슬롯 이름 목록과 확장자 후보 배열을 반환한다.

**Step 4: Run test to verify it passes**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests && node .tmp-tests/tests/ui/stickerCatalog.test.js`

Expected: PASS with no assertion errors.

### Task 2: SidebarRight 연결

**Files:**
- Modify: `src/ui/SidebarRight.tsx`

**Step 1: Write the failing behavior check**

`SidebarRight`가 하드코딩된 `STICKER_LIST`를 더 이상 직접 쓰지 않도록 변경 대상을 확인한다.

**Step 2: Write minimal implementation**

- 헬퍼에서 10개 슬롯을 가져온다.
- 각 버튼은 사용 가능한 첫 번째 후보 URL을 선택해 삽입한다.
- 미리보기는 후보 파일을 순서대로 시도하고, 모두 실패하면 `준비 중` 표시를 보여준다.

**Step 3: Run verification**

Run: `npm run build`

Expected: build succeeds.

### Task 3: 최종 검증

**Files:**
- Verify only

**Step 1: Run lint**

Run: `npm run lint`

Expected: no new lint errors from changed files.

**Step 2: Re-run targeted test**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests && node .tmp-tests/tests/ui/stickerCatalog.test.js`

Expected: PASS.
