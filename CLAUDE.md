@AGENTS.md

# 프로젝트 규칙

- AI(Anthropic) 호출은 반드시 `app/lib/aiGuard.ts`의 `guardedClaudeFetch`로만 한다. `fetch`로 `api.anthropic.com`을 직접 부르지 않는다. (`scripts/` 폴더는 예외)
- AI 모델은 기본으로 Haiku를 쓰고, 웹 검색 도구는 꼭 필요할 때만 쓴다. 비용이 드는 작업은 실행 전에 예상 비용을 먼저 알려준다.
- `price_history` 같은 기록 테이블의 데이터를 지우는 코드는 만들지 않는다. 필요하면 먼저 물어본다.
- 데이터를 채우는 스크립트는 이미 있는 값을 덮어쓰지 않고, 한 번 처리한 항목은 다시 처리하지 않게 만든다.
- 새 영어 태그는 Supabase `tag_map` 표에 번역을 추가한다. 매주 갱신 때 자동 반영되고, 바로 반영하려면 Supabase에서 `select normalize_tags();` 를 실행한다.
- 화면에 보이는 문구는 한국어로 쓴다.
- `.env.local`과 비밀 키는 절대 커밋하지 않는다.
- 코드를 고친 뒤에는 커밋 메시지를 한 줄로 제안한다. 형식: `feat(범위): 설명`
- 커밋 규칙 (여러 세션이 동시에 작업할 수 있음):
  - `git add -A` / `git add .` 금지. 내가 바꾼 파일만 경로를 지정해서 add 한다.
  - `git add`가 하나라도 실패하면 커밋하지 말고 멈춘다. (`git add ... && git commit ...`처럼 이어 붙이기)
  - 커밋 전에 `git diff --cached --stat`으로 들어갈 파일 목록을 확인한다.
  - main에 강제 푸시(`--force`, `--force-with-lease`) 금지.
- 보안 관련 코드를 바꾸면 `scripts/security-check.mjs` 실행을 제안한다.
- 더 빠르거나 간단한 방법이 있으면 먼저 알려준다.
