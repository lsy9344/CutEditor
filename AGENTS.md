# Repository Guidelines

# 항상 한국어로 대답하세요.

## Project Structure & Module Organization
- `src/`: 웹 클라이언트 소스
  - `state/`(타입·스토어), `templates/`(로더·검증), `canvas/`(스테이지), `export/`(타일러·메시지), `workers/`(렌더 워커), `ui/`(사이드바/푸터), `utils/`(단위 변환)
- `editor_core/`: 파이썬 코어 유틸(템플릿 검증, mm↔px)
- `public/templates/`: 2/4/6/9컷 JSON 템플릿
- `docs/`: 아키텍처/렌더링/상태/DoD 등 설계 문서
- `tests/`: 파이썬 유닛 테스트(`tests/editor_core/*`)
- `original_source/`: 레거시 PySide 프로토타입(참조 전용)

## Build, Test, and Development Commands
- Python
  - `python -m venv .venv && source .venv/bin/activate`
  - `pip install -r requirements.txt`
  - `pytest -q` (빠른 유닛 테스트)
  - `black .`, `flake8` (포맷/린트)
- Web (스캐폴딩 후)
  - `npm install`, `npm run dev` (Vite 개발 서버)
  - `npm run lint` (ESLint)

## Coding Style & Naming Conventions
- Python: PEP 8, 4칸 들여쓰기, 함수/변수 `snake_case`, 클래스 `PascalCase`.
- TypeScript/React: 함수형 컴포넌트, 파일명 `PascalCase.tsx`(컴포넌트), CSS 토큰은 `/Users/sooyeol/Desktop/Code/cut_editor_250830/src/components/components.css` 사용.
- 임포트 정렬: 표준 → 서드파티 → 로컬. 불필요 임포트 제거.
- 포맷/린트: Python `black`/`flake8`, Web `eslint`(`eslint.config.mjs`).
- JSON: 공백 2칸, 파일 끝 개행, 키는 `docs/TEMPLATE_SCHEMA.md` 준수.

## Testing Guidelines
- 프레임워크: `pytest`.
- 위치/패턴: `tests/**/test_*.py` (모듈 경로 반영).
- 범위: 빠르고 결정적 유닛 테스트 우선. 템플릿 스키마는 골든 테스트 권장.
- 실행: `pytest -q`.

## Commit & Pull Request Guidelines
- 커밋: Conventional Commits 사용(e.g., `feat:`, `fix:`, `chore:`). 명령형, 간결하게.
- 브랜치: `feature/<scope>`, `fix/<issue-id>`, `chore/<task>`.
- PR: 목적/범위, 관련 이슈·PRD 링크, UI 변경 스크린샷, `docs/` 동기화. 포맷/린트/테스트 통과 필수. 무관한 변경 금지.

## Security & Configuration Tips
- 시크릿/대용량 바이너리 커밋 금지. 에셋은 `public/` 참조.
- 의존성 고정: `requirements.txt`. 외부 템플릿/이미지 유효성 검증.
- 스타일 가이드: `/Users/sooyeol/Desktop/Code/cut_editor_250830/src/components/components.css` 토큰·컴포넌트 클래스 우선 사용.


`/Users/sooyeol/Desktop/Code/cut_editor_250830/src/components/components.css` 만들어둔 공통 컴포넌트를 사용해서 구현하고 새로 컴포넌트를 만들지 마세요.

## Codex Multi-Agent Roles
- 이 저장소는 `.codex/agents/` 아래에 PEER 스타일 역할을 정의합니다.
- `planning`: 구현 전에 일을 작고 순서 있는 단계로 쪼갤 때 먼저 사용합니다.
- `executing`: 하나의 구체적인 조사/수정/검증 작업을 맡길 때 사용합니다.
- `expressing`: 여러 에이전트 결과를 초보자도 이해하기 쉬운 답변이나 핸드오프로 정리할 때 사용합니다.
- `reviewing`: 변경 후 버그, 회귀, 검증 누락, 숨은 리스크를 점검할 때 사용합니다.
- 독립적인 하위 작업은 가능한 범위에서 여러 `executing` 에이전트로 병렬 처리하고, 마지막에 `expressing` 또는 `reviewing`으로 묶습니다.
- 각 하위 에이전트에는 넓은 과제 하나보다 좁고 분명한 과제를 맡기세요.
