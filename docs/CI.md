# CI·코드 리뷰

2026-11-19 구성. 방식은 Claude Code 팀 블로그
[How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/)(2026-10-15)의
"On every pull request" 단계를 따른다: CI 를 돌리고, PR 마다 AI 리뷰어(Claude Code GitHub Action)가 먼저 본다.

## workflow

| 파일 | 언제 | 하는 일 |
|---|---|---|
| `.github/workflows/ci.yml` | `main`·`ci/**` push, 같은 저장소 브랜치의 PR, 수동 실행 | `npm ci` → `npm test` → `npm run lint` → `npm run build` (Node 24) |
| `.github/workflows/claude-code-review.yml` | 같은 저장소 브랜치의 PR 열기·push·ready·reopen (draft 제외) | 공식 `code-review` 플러그인으로 리뷰하고 PR 에 인라인 댓글(없으면 요약 댓글 하나)을 단다. 승인·차단은 하지 않는다 |

- 리뷰 기준은 루트 `CLAUDE.md` 다(플러그인은 `REVIEW.md` 를 읽지 않는다). 공식 문서상 플러그인은 Claude 댓글이 이미 있는 PR 은
  건너뛴다. 다시 받으려면 그 댓글을 지운다.
- 리뷰 토큰 비밀값이 없으면 리뷰 job 은 notice 를 남기고 성공으로 끝난다.

## 러너

GitHub 사용량 문제로 GitHub 호스트 러너를 쓰지 않는다. 사용자 CI PC(jena-dabi, WSL Ubuntu)의 **이 저장소 전용** 러너다.

- 개인 계정 저장소의 러너는 저장소 단위로 등록되어 jena 러너를 함께 쓸 수 없다. 같은 PC 에 하나 더 등록했다.
- 이름 `jena-dabi-linux`, 라벨 `[self-hosted, Linux, X64, erp-dabi]`, 폴더 `/opt/actions-runners/CutEditor`,
  서비스 `gha-CutEditor.service`, job 시작 hook 은 다른 러너와 같은 `/opt/runner-setup/package-cache-job-start.sh`.
- 다른 러너(root)와 달리 전용 사용자 `cuteditor-runner`(sudo·docker 그룹 없음)로 돈다. systemd 가 Windows 드라이브
  (`/mnt/c`·`/mnt/d`)와 Windows 프로그램 실행(`/init`)을 막고, 쓰기는 러너 폴더와 홈만 허용한다(`ProtectSystem=strict`).
- jena CI 가 CI PC 를 혼자 쓰는 동안(jena `scripts/ci-pc-exclusive.sh`)에는 이 러너도 멈춰 job 이 대기열에서 기다린다.
- 되돌리기(CI PC root): `systemctl disable --now gha-CutEditor.service` 뒤 GitHub 저장소 Settings → Actions → Runners 에서 등록 삭제.
  재등록은 `gh api -X POST repos/lsy9344/CutEditor/actions/runners/registration-token` 토큰으로 러너 폴더에서
  `config.sh --url https://github.com/lsy9344/CutEditor --name jena-dabi-linux --labels erp-dabi --unattended --replace`
  를 `cuteditor-runner` 사용자로 실행한다.

## 보안 (공개 저장소 + self-hosted 러너)

GitHub 은 공개 저장소에 self-hosted 러너를 거의 쓰지 말라고 한다. 누구나 PR 로 러너에서 코드를 돌릴 수 있기 때문이다
([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)). 그래서 겹겹이 막는다.

1. **fork PR 은 job 을 만들지 않는다.** 두 workflow 의 job `if` 가 `pull_request.head.repo.full_name == github.repository`
   일 때만 돈다. `pull_request_target`·`workflow_run` 은 쓰지 않는다.
2. **fork PR 실행은 승인이 필요하다.** 저장소 설정 "Approval for running fork pull request workflows" =
   `all_external_contributors`. fork 가 workflow 를 고쳐 1을 지워도 승인 전에는 돌지 않는다.
   **fork PR 의 "Approve workflows to run" 은 누르지 않는다.** 누르면 그 PR 의 코드가 CI PC 에서 돈다.
3. **비밀값은 fork PR 에 가지 않는다.** `pull_request` 이벤트는 fork 에 비밀값을 주지 않고, 리뷰 job 도 1의 조건으로 돌지 않는다.
   리뷰의 GitHub 토큰은 job 권한(`contents: read`, `pull-requests: write`, `issues: read`)으로 묶인 `GITHUB_TOKEN` 이다.
4. **러너는 이 저장소 전용·비root 다.** 위 "러너" 참고.

## 사용자가 할 일

- 리뷰를 켜려면 저장소 비밀값 `CLAUDE_CODE_OAUTH_TOKEN` 을 넣는다. 로컬에서 `claude setup-token` 으로 만든 토큰을
  `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R lsy9344/CutEditor` 로 넣는다(값은 프롬프트에 붙여 넣는다). 구독 사용량을 쓴다.
