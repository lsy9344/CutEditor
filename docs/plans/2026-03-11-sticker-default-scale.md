# Sticker Default Scale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스티커 원본 크기는 유지하면서, 처음 캔버스에 붙을 때만 실제 스티커처럼 작게 시작하게 만든다.

**Architecture:** 스티커 크기 유틸에 "기본 삽입 긴 변(mm)" 상수와 초기 스케일 계산 함수를 추가한다. `App`은 원본 `width`/`height`를 저장하되, 새 스티커에 계산된 `scaleX`/`scaleY`를 넣고 축소된 표시 크기 기준으로 중앙 배치를 수행한다.

**Tech Stack:** React, TypeScript, node:test

---

### Task 1: 기본 삽입 스케일 테스트 작성

**Files:**
- Modify: `tests/sticker-natural-size.test.mjs`
- Modify: `src/utils/stickerSizing.ts`

**Step 1: Write the failing test**

100mm 원본 SVG(`378px`)가 약 18mm 표시 크기(`약 68px`)로 시작하도록 초기 스케일을 계산하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: FAIL because the new scale helper does not exist yet.

**Step 3: Write minimal implementation**

기본 삽입 길이(mm)를 CSS pixel로 환산하고, 긴 변 기준 초기 스케일을 반환하는 최소 구현을 추가한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

### Task 2: 중앙 배치 계산을 축소 표시 크기에 맞춘다

**Files:**
- Modify: `tests/sticker-natural-size.test.mjs`
- Modify: `src/utils/stickerSizing.ts`

**Step 1: Write the failing test**

축소 배율이 적용된 뒤의 표시 크기를 기준으로 중앙 좌표가 계산되는지 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: FAIL on centered position expectation.

**Step 3: Write minimal implementation**

축소 표시 크기를 계산하는 유틸을 만들고 중앙 배치 함수가 그 값을 사용하게 수정한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

### Task 3: App 삽입 로직 연결

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

유틸 테스트 기대값과 실제 삽입 로직이 맞물리도록 관련 테스트 기대값을 보강한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: FAIL until `App` inserts stickers with the new scale.

**Step 3: Write minimal implementation**

새 스티커에 계산된 기본 스케일을 넣고, 그 표시 크기 기준으로 중앙에 배치한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

### Task 4: 전체 검증

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/utils/stickerSizing.ts`
- Modify: `tests/sticker-natural-size.test.mjs`

**Step 1: Run focused test**

Run: `node --experimental-strip-types --test tests/sticker-natural-size.test.mjs`
Expected: PASS

**Step 2: Run lint**

Run: `npx eslint src/App.tsx src/utils/stickerSizing.ts tests/sticker-natural-size.test.mjs`
Expected: exit code 0

**Step 3: Run build**

Run: `npm run build`
Expected: exit code 0
