# Sticker Category Prefix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스티커 카테고리 카드는 `1s`, `2s`를 유지하고, 각 카드 내부 상세 스티커는 `1s_1ss`, `2s_1ss`처럼 카테고리 prefix를 포함한 파일명을 사용하도록 변경한다.

**Architecture:** 스티커 카탈로그에서 카테고리별 asset prefix를 기준으로 카드 미리보기와 상세 스티커 경로를 생성한다. 테스트를 먼저 바꿔 새 파일명 규칙을 고정한 뒤, 최소 구현으로 카탈로그만 수정하고 기존 사이드바는 데이터 소비만 유지한다.

**Tech Stack:** React, TypeScript, Vite, Node built-in assertions

---

### Task 1: 새 파일명 규칙 테스트 추가

**Files:**
- Modify: `tests/ui/stickerCatalog.test.ts`

**Step 1: Write the failing test**

아래 동작을 검증한다.
- `1s` 카테고리의 첫 상세 스티커 후보는 `/stickers/1s_1ss.svg`다.
- `2s` 카테고리의 첫 상세 스티커 후보는 `/stickers/2s_1ss.svg`다.
- 각 카테고리의 10번째 상세 스티커 후보도 동일 규칙을 따른다.

**Step 2: Run test to verify it fails**

Run: `npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests-prefix-red`

Expected: FAIL because current implementation still generates plain `1ss~10ss`.

### Task 2: 카탈로그 최소 구현

**Files:**
- Modify: `src/ui/stickerCatalog.ts`

**Step 1: Write minimal implementation**

- 카테고리별 asset prefix를 가진다.
- `buildStickerSlots(prefix)`가 `${prefix}_${n}ss` 형식의 키와 후보 경로를 만든다.
- 현재 카테고리 두 개는 각각 `1s`, `2s` prefix를 사용한다.

**Step 2: Run test to verify it passes**

Run: `npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests-prefix-green && node .tmp-tests-prefix-green/tests/ui/stickerCatalog.test.js`

Expected: PASS.

### Task 3: UI 연결 검증

**Files:**
- Verify only: `src/ui/SidebarRight.tsx`

**Step 1: Confirm consumption**

카테고리 데이터의 `stickers` 배열을 그대로 렌더링하므로 추가 코드 변경이 필요한지 확인한다.

**Step 2: Run build**

Run: `npm run build`

Expected: build succeeds.

### Task 4: 최종 검증

**Files:**
- Verify only

**Step 1: Run targeted lint**

Run: `npx eslint src/ui/SidebarRight.tsx src/ui/stickerCatalog.ts tests/ui/stickerCatalog.test.ts`

Expected: PASS.

**Step 2: Re-run targeted test**

Run: `npx tsc tests/ui/stickerCatalog.test.ts src/ui/stickerCatalog.ts --module ESNext --target ES2020 --moduleResolution bundler --outDir .tmp-tests-prefix-final && node .tmp-tests-prefix-final/tests/ui/stickerCatalog.test.js`

Expected: PASS.
