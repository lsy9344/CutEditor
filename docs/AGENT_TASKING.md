# 에이전트 작업 지시 가이드

이 문서는 본 저장소에 맞춰 에이전트(Codex CLI)에게 높은 완성도로 일을 맡기는 방법을 설명합니다.

## 필요한 입력
- 작업 카드: `prompts/10_task_card.md` 포맷 사용(목표, 컨텍스트, DoD, 산출물, 범위 제한).
- 컨텍스트 링크: `PRD.md`와 `docs/*.md`의 정확한 섹션을 지정(예: `docs/TEMPLATE_SCHEMA.md#...`).
- 파일 타깃: 생성/수정될 파일·디렉터리 명시(예: `src/state/template.ts`, `public/templates/*.json`).
- 검증 방법: 실행할 명령(pytest/black/flake8 또는 웹 스크립트)과 `docs/TEST_PLAN.md`에 매핑된 수동 절차를 포함.

## 범위와 단위
- 작업 카드는 “하나의 결과”만 담습니다(기능+리팩터 혼합 금지).
- 범위가 커지면 중단 후 후속 작업 카드를 제안합니다.

## 에이전트 산출물
- 변경: 생성/수정 파일 목록과 패치(새 파일은 전문 포함).
- 근거: `docs/ARCHITECTURE.md`, `docs/STATE_MODEL.md`에 근거한 짧은 설계 이유.
- 검증: 수행 명령과 충족된 DoD 항목(`docs/DEFINITION_OF_DONE.md`) 명시.

## 품질 기준(기본 적용)
- 포맷팅: `black .`; 린트: `flake8`; 테스트: `pytest -q`(테스트 존재 시).
- 웹 모듈(스캐폴딩 후): 빌드/ESLint 통과 및 `docs/TEST_PLAN.md` 시나리오 검증.

## 예시(요약)
- 목표: “템플릿 JSON을 로드/검증하고 타입 안전한 상태로 노출.”
- 컨텍스트: PRD 관련 섹션, `docs/TEMPLATE_SCHEMA.md`, `docs/STATE_MODEL.md`.
- 파일: `src/state/template.ts`, `src/lib/schema.ts`, `public/templates/*.json`(JSON 구조 변경 금지).
- DoD: 타입 안전 로드, 검증 오류 표면화, 정상/오류 경로 단위 테스트.
- 검증: `npm test`, 수동으로 4-hor 템플릿 로드 후 슬롯 렌더 확인.

요청은 구체적 경로와 DoD/TEST_PLAN에 연결해 주세요. 차단 이슈가 아니면 질문을 최소화하고 바로 수행합니다.
