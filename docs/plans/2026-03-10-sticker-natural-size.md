# Sticker Natural Size Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스티커를 캔버스에 삽입할 때 실제 파일 크기를 사용해 비율 왜곡을 없앤다.

**Architecture:** 스티커 소스 경로에서 실제 이미지 크기를 읽는 작은 유틸을 추가하고, `App`의 스티커 삽입 함수가 그 유틸 결과를 사용해 `width`, `height`를 설정한다. 로딩 실패 시에는 기존 고정 크기를 fallback으로 유지해 예외 상황에서도 삽입이 가능하게 한다.

**Tech Stack:** React, TypeScript, node:test

---

### Task 1: 스티커 크기 유틸 테스트 작성

**Files:**
- Create: `tests/sticker-natural-size.test.mjs`
- Create: `src/utils/stickerSizing.ts`

**Step 1: Write the failing test**

`loadStickerDimensions`가 로더가 반환한 원본 크기를 그대로 돌려주는지 테스트한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: FAIL because module/function does not exist yet.

**Step 3: Write minimal implementation**

로더 함수 결과를 사용해 유효한 `width`, `height`를 반환하는 최소 구현을 추가한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

### Task 2: App 스티커 삽입 연결

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

fallback 동작까지 포함하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: FAIL on fallback or invalid-size handling.

**Step 3: Write minimal implementation**

`handleStickerInsert`를 비동기로 바꾸고, 원본 크기를 새 스티커에 넣도록 수정한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

### Task 3: 전체 검증

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/utils/stickerSizing.ts`
- Test: `tests/sticker-natural-size.test.mjs`

**Step 1: Run focused test**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

**Step 2: Run build**

Run: `npm run build`
Expected: exit code 0
