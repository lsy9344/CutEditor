# Sticker Preview Naming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 오른쪽 사이드바에서 중분류 카드 미리보기는 `1s~10s`, 상세 스티커 미리보기는 `1ss~10ss` 파일 규칙을 사용하도록 변경한다.

**Architecture:** 스티커 카탈로그에 카드용 미리보기 경로와 상세 스티커 슬롯 경로를 분리한다. 기존 확장자 자동 탐색 로직은 유지하고, 테스트에서 두 규칙이 올바르게 생성되는지 먼저 고정한 뒤 최소 구현으로 반영한다.

**Tech Stack:** React, TypeScript, Vite, Node built-in assertions

---

### Task 1: 카탈로그 경로 규칙 테스트 추가

**Files:**
- Modify: `tests/ui/stickerCatalog.test.ts`

**Step 1: Write the failing test**

테스트에서 아래를 검증한다.
- 상세 스티커 슬롯 키는 `1ss`부터 `10ss`다.
- 상세 스티커 후보 경로는 `/stickers/1ss.svg`처럼 생성된다.
- 카테고리 카드 미리보기는 `basic -> /stickers/1s.svg`, `deco -> /stickers/2s.svg`다.

**Step 2: Run test to verify it fails**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests && node .tmp-tests/tests/ui/stickerCatalog.test.js`

Expected: FAIL because the current implementation still uses `1s~10s` for detail stickers or lacks the new assertions.

### Task 2: 최소 구현으로 카탈로그 규칙 분리

**Files:**
- Modify: `src/ui/stickerCatalog.ts`

**Step 1: Write minimal implementation**

- 상세 스티커 슬롯 생성 헬퍼가 `1ss~10ss` 키를 만들도록 변경한다.
- 카테고리 카드 미리보기는 현재 두 카테고리에 대해 각각 `1s`, `2s`를 직접 지정한다.
- 확장자 후보 순서는 유지한다.

**Step 2: Run test to verify it passes**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests && node .tmp-tests/tests/ui/stickerCatalog.test.js`

Expected: PASS with no assertion errors.

### Task 3: 사이드바 연결 검증

**Files:**
- Verify only: `src/ui/SidebarRight.tsx`

**Step 1: Confirm consumption**

`SidebarRight`가 카탈로그의 `previewImage`와 `stickers` 데이터를 그대로 사용하고 있는지 확인한다.

**Step 2: Run build**

Run: `npm run build`

Expected: build succeeds.

### Task 4: 최종 검증

**Files:**
- Verify only

**Step 1: Run lint**

Run: `npm run lint`

Expected: no new lint errors from changed files.

**Step 2: Re-run targeted test**

Run: `rm -rf .tmp-tests && npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests && node .tmp-tests/tests/ui/stickerCatalog.test.js`

Expected: PASS.
