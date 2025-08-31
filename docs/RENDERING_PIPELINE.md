# Rendering Pipeline (600 DPI)

## 전략
- 메인 UI 캔버스와 분리된 OffscreenCanvas를 워커에서 생성.
- 캔버스 전체를 타일로 분할(예: 4096px 정사각 타일)하여 순차 합성 → 병합.
- 오버레이 PNG는 최상단 레이어로 마지막에 합성.

## 워커 메시지 프로토콜(요약)
- IN: { type:"render", template, slots(with images), texts }
- OUT: { type:"progress", ratio } / { type:"done", blobUrl } / { type:"error", message }