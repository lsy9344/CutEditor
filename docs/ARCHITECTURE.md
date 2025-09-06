# Architecture

## 런타임/스택
- React + Vite (경량 번들링)
- 렌더링: Fabric.js 또는 Konva.js (오브젝트/트랜스폼), 고해상도는 OffscreenCanvas + Web Worker
- 저장: 메모리/IndexedDB (세션 임시 저장)
- 배포: 정적 호스팅(Vercel/Netlify/Cloudflare Pages)

## 핵심 모듈
- templates/ : JSON 템플릿(2/4/6/9, 가/세로)
- canvas/ : 캔버스 레이어, 슬롯 드래그/스케일, 가이드, 스냅
- export/ : DPI 600 렌더 파이프라인(워커 + 타일링)
- ui/ : 패널(템플릿/속성), 마법사 흐름(선택→편집→내보내기)
- state/ : 글로벌 상태(atom/store) + 타입 정의

## 데이터 흐름
사용자 입력 → state 업데이트 → 캔버스 객체 반영 → (내보내기 시) 렌더 워커 호출 → Blob 다운로드

## 코어 도구(Python)
- editor_core/units.py: mm↔px 변환 함수
- editor_core/template_validator.py: Template JSON 간이 검증(필수 키, dpi=600, 배열형 체크)
- editor_core/template_loader.py: JSON 로드 + 검증 래퍼

프런트엔드 템플릿(JSON)과 동기화된 검증을 제공하며, 골든 테스트/CI에서 빠르고 결정적인 확인을 수행.

## 폴더 구조(요약)
- src/state: 상태/타입 정의 (TypeScript)
- src/templates: 템플릿 로더/런타임 검증
- src/canvas: 캔버스 렌더러(스테이지/트랜스폼)
- src/export: 워커 메시지/타일러
- src/workers: OffscreenCanvas 렌더 워커 스켈레톤
- src/ui: 좌/우 사이드바, 푸터
- editor_core: 파이썬 코어 유틸 및 테스트
