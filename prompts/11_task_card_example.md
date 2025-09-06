# 작업 카드(예시)

## 목표
- 템플릿(JSON)을 로드/검증하고 타입 안전한 상태로 노출한다. (웹 클라이언트 기반)

## 배경/컨텍스트
- PRD: 템플릿 기반 편집 플로우
- 참고: `docs/TEMPLATE_SCHEMA.md`, `docs/STATE_MODEL.md`, `docs/ARCHITECTURE.md` (state/ui/canvas 경계)

## 수용 기준(DoD)
- JSON 스키마 준수 위반 시 사용자 친화적 오류 메시지 반환(파일명, 키 경로, 기대 타입 포함)
- 유효한 템플릿은 `Template` 타입으로 파싱되어 상태에 저장됨
- 슬롯/텍스트 좌표 변환 유틸(px/mm) 제공 및 테스트
- 빌드/린트 0에러, 단위 테스트 통과

## 산출물
- 생성: `src/lib/template/schema.ts`(스키마), `src/lib/template/loader.ts`(IO+검증), `src/lib/units.ts`(mm/px 변환)
- 테스트: `src/lib/template/__tests__/loader.test.ts`, `src/lib/__tests__/units.test.ts`
- 문서: `docs/COMPONENTS.md`의 관련 섹션 업데이트(간단 요약)
- 실행/테스트 방법: 아래 명령 포함

## 변경 범위 제한
- UI 렌더링/캔버스 작업은 제외(별도 태스크)

## 실행/검증 명령
```bash
npm install
npm run build
npm test --silent
```

## 수동 테스트(테스트 플랜 매핑)
- `public/templates/4-hor.json`을 로드 → 슬롯 개수/좌표 정상 파싱 확인
- 잘못된 키를 가진 임시 JSON을 로드 → 의미있는 오류 메시지 확인
