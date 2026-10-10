@AGENTS.md

# JamiDuNow

친구랑 할 게임을 인원·가격·할인·진입장벽·PC 사양으로 비교하는 한국어 사이트. Next.js + Supabase + Vercel(Hobby). 화면엔 "JamiDuNow"만 쓰고 "재밌드나"는 구조화 데이터에만 쓴다.
- 현재 상황·로드맵: docs/STATUS.md (있으면 작업 전에 읽기)
- 디자인 원칙: docs/design.md (UI를 건드리면 먼저 읽기)

## 세션과 브랜치
- 세션은 J, K 두 개. 다른 세션의 worktree는 건드리지 않는다. 필요하면 원격 브랜치로 새 worktree를 만든다.
- 작업은 origin/main 기준 새 worktree에서 한다. npm ci부터 하고 심볼릭 링크는 쓰지 않는다.
- 커밋 메시지는 feat(범위): / fix(범위): / docs(범위): / chore(범위): 형식. 지시문 끝에 있는 메시지를 그대로 쓴다.
- 기능 브랜치만 푸시한다. rebase한 기능 브랜치는 --force-with-lease로 푸시해도 된다. main에는 force 금지.
- 다른 브랜치와 같은 파일을 건드려 rebase 중 충돌하면 해결하지 말고 멈춘다. 충돌 파일과 양쪽 내용을 보여주고 지시를 기다린다.

## 머지
- 머지는 /merge <브랜치> 절차를 따른다.
- UI가 바뀌는 브랜치: 사용자가 프리뷰를 확인하고 지시할 때만 머지한다.
- 스크립트·CI·문서만 바뀌는 브랜치: build와 test가 통과하면 바로 머지해도 된다. 단, workflow 실행 시간·DB 쓰기·알림에 영향이 있으면 보고하고 기다린다.

## DB
- 읽기는 서비스 키로 해도 된다.
- 쓰기(마이그레이션, insert·update·delete)는 직접 실행하지 않는다. SQL은 주석 없이 보고서에 전문을 적고, 사용자가 Supabase SQL 에디터에서 실행한다.
- 스크립트의 --apply 실행은 지시가 있을 때만 한다.
- 정기 수집을 수동으로 돌려야 하면 workflow 전체 말고 해당 스크립트만 직접 실행한다.

## 보고
- 보고서는 파일로 저장하지 말고 답변에 바로 적는다.
- 포함할 것: 커밋 해시, build·test 결과, 바뀐 것, 확인하지 못한 것, 사용자가 정해야 할 것.
- 스크래치·스크린샷은 /workspaces 아래 레포 밖에 둔다(예: /workspaces/shots).

## 프리뷰
- 주소: https://game-info-hub-git-<브랜치>-paul-shin-s-projects.vercel.app (브랜치 이름의 /는 -로)
- 환경변수 VERCEL_AUTOMATION_BYPASS_SECRET가 있으면 x-vercel-protection-bypass 헤더로 프리뷰를 직접 열어 1440px·375px 스크린샷과 높이를 확인한다. 이 값은 출력·로그·커밋·보고서에 절대 남기지 않는다.
- ISR(revalidate 300) 때문에 데이터를 갱신한 뒤 화면 반영은 5~10분 늦을 수 있다.

## 보안 점검
- security-check는 로그인·세션·쓰기 API·마이그레이션·권한·비밀 키·관리자 변경이 있을 때만 머지 전에 실행한다.

## 내용 원칙
- 화면에는 데이터로 확인되는 사실만 쓴다.

## 코드·데이터 규칙 (기존 프로젝트 규칙)
위 "세션과 브랜치"·"머지"·"DB"·"보고" 규칙과 겹치거나 어긋나는 항목은 위 규칙이 우선한다.

- AI(Anthropic) 호출은 반드시 `app/lib/aiGuard.ts`의 `guardedClaudeFetch`로만 한다. `fetch`로 `api.anthropic.com`을 직접 부르지 않는다. (`scripts/` 폴더는 예외)
- AI 모델은 기본으로 Haiku를 쓰고, 웹 검색 도구는 꼭 필요할 때만 쓴다. 비용이 드는 작업은 실행 전에 예상 비용을 먼저 알려준다.
- `price_history` 같은 기록 테이블의 데이터를 지우는 코드는 만들지 않는다. 필요하면 먼저 물어본다.
  - 기록 테이블 삭제 금지의 예외 — 개인정보처리방침에 따른 post_reports·feedback 1년 경과분 삭제(`scripts/purge-old-records.mjs`), ip_hash 90일 경과분 비우기(`scripts/purge-ip-hash.mjs`). 그 외 삭제는 여전히 금지
  - 기록 테이블 삭제 금지의 예외 — `user_owned_games`는 스팀 상태의 사본(캐시)이라 동기화할 때 통째로 교체(삭제 후 다시 채움)해도 된다.
  - 기록 테이블 삭제 금지의 예외 — 회원 탈퇴 시 `users`와 그 하위 표(`on delete cascade`로 따라 지워지는 표) 삭제.
  - 기록 테이블 삭제 금지의 예외 — `used_openid_nonces`는 기록 테이블이 아니라 보안용 임시 표라, 하루 지난 행은 로그인 콜백이 지워도 된다.
- 데이터를 채우는 스크립트는 이미 있는 값을 덮어쓰지 않고, 한 번 처리한 항목은 다시 처리하지 않게 만든다.
- 새 영어 태그는 Supabase `tag_map` 표에 번역을 추가한다. 매주 갱신 때 자동 반영되고, 바로 반영하려면 Supabase에서 `select normalize_tags();` 를 실행한다.
- 화면에 보이는 문구는 한국어로 쓴다.
- `.env.local`과 비밀 키는 절대 커밋하지 않는다.
- 코드를 고친 뒤에는 커밋 메시지를 한 줄로 제안한다. 형식: `feat(범위): 설명`
- 커밋 규칙 (여러 세션이 동시에 작업할 수 있음):
  - `git add -A` / `git add .` 금지. 내가 바꾼 파일만 경로를 지정해서 add 한다.
  - `git add`가 하나라도 실패하면 커밋하지 말고 멈춘다. (`git add ... && git commit ...`처럼 이어 붙이기)
  - 커밋 전에 `git diff --cached --stat`으로 들어갈 파일 목록을 확인한다.
  - main에는 force 금지(`--force`, `--force-with-lease` 모두). 기능 브랜치는 rebase 뒤 `--force-with-lease`로 푸시해도 된다.
- 보안 관련 코드를 바꾸면 `scripts/security-check.mjs` 실행을 제안한다.
- 더 빠르거나 간단한 방법이 있으면 먼저 알려준다.
- worktree에서 빌드할 때는 node_modules 심볼릭 링크를 쓰지 말고(Turbopack이 거부함) 처음부터 npm ci로 설치한다. .env.local은 복사하되 커밋하지 않는다.
