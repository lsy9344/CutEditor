# Sticker Category Prefix Design

**Date:** 2026-03-06

**Summary:** 오른쪽 사이드바 스티커 자산 규칙을 카테고리 기준으로 재정의한다. 중분류 카드는 `1s`, `2s`처럼 유지하고, 각 카드 내부 스티커는 `1s_1ss`, `1s_2ss`, `2s_1ss`, `2s_2ss`처럼 카테고리 prefix를 포함한 이름을 사용한다.

## Context

- 현재 카테고리 카드는 `1s`, `2s` 파일을 미리보기로 사용한다.
- 상세 스티커는 지금까지 `1ss~10ss` 형식으로만 관리되어, 어떤 카테고리에 속하는지 파일명만 보고 알기 어렵다.
- 사용자는 카테고리별 상세 스티커를 파일명 수준에서 구분하고 싶어 한다.

## Decision

1. 중분류 카드 미리보기는 기존처럼 `public/stickers/1s.*`, `public/stickers/2s.*`를 사용한다.
2. `1s` 카드 내부 상세 스티커는 `public/stickers/1s_1ss.*`부터 `public/stickers/1s_10ss.*`를 사용한다.
3. `2s` 카드 내부 상세 스티커는 `public/stickers/2s_1ss.*`부터 `public/stickers/2s_10ss.*`를 사용한다.
4. 확장자 후보 순서는 계속 `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`를 유지한다.

## Why This Approach

- 파일명만 봐도 어떤 카테고리 소속의 상세 스티커인지 즉시 알 수 있다.
- 카테고리가 늘어나도 `3s_1ss` 같은 동일 규칙으로 확장하기 쉽다.
- UI 구조는 그대로 두고 카탈로그 규칙만 정리하면 되므로 변경 범위가 작다.

## Affected Areas

- `src/ui/stickerCatalog.ts`
- `tests/ui/stickerCatalog.test.ts`
- `src/ui/SidebarRight.tsx`는 카탈로그 데이터 구조를 그대로 읽는지 검증만 하면 된다.

## Verification

- 카탈로그 테스트에서 카테고리별 상세 파일명 규칙을 검증한다.
- `npm run build`
- `npx eslint src/ui/SidebarRight.tsx src/ui/stickerCatalog.ts tests/ui/stickerCatalog.test.ts`
