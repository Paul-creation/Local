# 오픈 체크리스트 (2026-10-10 ~ 10-12)

> 모든 명령은 저장소 루트(`/workspaces/Local`)에서 실행. `확인 필요`라고 적힌 곳은 코드에서 근거를 찾지 못한 항목이다.

---

## 10/10 최종 점검

### 1. 보안 점검 (배포 사이트 포함)

```bash
node --env-file=.env.local scripts/security-check.mjs https://game-info-hub.vercel.app
```

- 주소를 빼면 배포 사이트 점검은 건너뛴다. (`SITE_URL` 환경변수로도 줄 수 있음 — `scripts/security-check.mjs:8`)
- 도메인 연결 뒤(10/11)에는 새 도메인으로 한 번 더 실행한다.
- ❌가 0개인지 확인. ⚠️는 내용을 읽고 판단.

### 2. 타입 검사 · 빌드

```bash
npx tsc --noEmit
npm run build
```

- 린트도 보려면: `npx eslint .` (`npm run lint`의 `next lint`는 이 Next 버전에서 동작하는지 확인 필요)

### 3. 모바일 자동 점검 재실행

```bash
npm ci                                                     # 처음 한 번 (playwright 포함)
node scripts/mobile-check.mjs                              # 기본: https://game-info-hub.vercel.app
node scripts/mobile-check.mjs https://새도메인              # 도메인 연결 뒤
```

- 375×812 · 390×844 · 768×1024에서 메인, 검색 결과, 게임 상세(영상 있음·없음), 비교, 커뮤니티 목록·글·글쓰기, 의견 달기, 의견함, 소개, FAQ를 연다.
- 출력: 요약 표(가로 스크롤 / 화면 밖 넘침 / 44px 미만 터치 영역 개수) + 자세히 표(요소·크기). 헤더·푸터처럼 반복되는 요소는 화면 크기마다 한 번만 보여준다.
- 스크린샷: `scripts/.cache/mobile-check/<시각>/` (gitignore 됨)
- 글쓰기·의견함·의견 달기는 열기만 하고 제출하지 않는다. 비교는 AI 비용을 쓰지 않게 `/compare`(게임 미선택)만 연다.
- 가로 스크롤이 하나라도 있으면 종료 코드 1. 오픈 전 기준은 **가로 스크롤 ✅, 넘침 0**. 44px 미만은 참고용 (2026-10-04 기준 헤더 메뉴 높이 33px 등 다수).
- 브라우저가 없다는 오류가 나면: `npx playwright install chromium`

### 4. 주간 자동화(금요일 새벽) 결과 확인

- 일정: `.github/workflows/weekly.yml` — cron `0 17 * * 4` (UTC 목 17시 = **한국 금요일 02:00**)
- 보는 곳: GitHub 저장소 → **Actions** 탭 → 왼쪽 목록 **"매주 갱신 (새 게임·정보 보강)"** → 가장 위 실행 → `run` 작업 → `node scripts/run-steps.mjs weekly` 단계 로그
- 같은 곳에 **"매일 갱신 (가격·할인·접속자)"**(매일 03:00, `daily.yml`)도 있음. 두 작업은 `concurrency: data-jobs`로 순서대로 돈다.
- 다시 돌리기: 같은 화면 오른쪽 **Run workflow** 버튼 (`workflow_dispatch`)
- CLI로 보기:
  ```bash
  gh run list --workflow=weekly.yml --limit 3
  gh run view <run-id> --log-failed
  ```

### 5. DB 확인 쿼리 (Supabase → SQL Editor)

"인기" 기준은 메인 "지금 뜨는 게임"과 같은 `heat_rank` 오름차순으로 잡았다. (다른 기준을 원하면 확인 필요)

```sql
-- 인기 200개 중 max_players = 1, 인원 null 개수
with top as (
  select id, min_players, max_players
  from games
  where heat_rank is not null
  order by heat_rank asc
  limit 200
)
select
  count(*) filter (where max_players = 1)                          as solo_only,
  count(*) filter (where max_players is null)                      as max_null,
  count(*) filter (where min_players is null or max_players is null) as any_null
from top;

-- 숨김 글 수 (게시글·댓글)
select
  (select count(*) from posts         where hidden) as hidden_posts,
  (select count(*) from post_comments where hidden) as hidden_comments;

-- 한 줄 소개(fun_description) 빈 게임 수 — 전체 / 인기 200개
select
  count(*) filter (where coalesce(trim(fun_description), '') = '') as empty_all
from games;

select count(*) as empty_top200
from (select fun_description from games where heat_rank is not null order by heat_rank asc limit 200) t
where coalesce(trim(fun_description), '') = '';
```

---

## 10/11 계정 · 도메인 (순서대로)

### 1. 디스코드 웹후크

1. 디스코드 서버 → 알림 받을 채널 → **채널 편집 → 연동(Integrations) → 웹후크 → 새 웹후크** → 웹후크 URL 복사
2. **Vercel**: 프로젝트 → **Settings → Environment Variables** → `DISCORD_WEBHOOK_URL` 추가 (Production·Preview)
   - ⚠️ 이름에 `NEXT_PUBLIC_`를 **붙이지 말 것**. 붙이면 브라우저 번들에 들어가 누구나 채널에 글을 쓸 수 있다. (`app/lib/notify.ts`, security-check가 이것도 검사함)
3. **GitHub**: 저장소 → **Settings → Secrets and variables → Actions** → `ENV_FILE` 수정
   - 시크릿은 기존 값을 볼 수 없으므로 **로컬 `.env.local` 전체를 복사**한 뒤 맨 아래에 한 줄 추가해서 통째로 붙여넣기:
     ```
     DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
     ```
   - 로컬 `.env.local`에도 같은 줄을 넣어둔다. (커밋 금지)
4. 확인: `node --env-file=.env.local scripts/daily-summary.mjs` → 디스코드 채널에 일일 요약이 오는지
5. Vercel은 환경변수 변경 후 **재배포**해야 반영 (아래 2번과 함께 해도 됨)

### 2. 도메인 연결 후 바꿀 환경변수

Vercel → 프로젝트 → **Settings → Domains** 에서 도메인 추가·DNS 설정 후, **Settings → Environment Variables**에서 **Production·Preview 둘 다** 수정:

| 변수 | 값 | 쓰는 곳 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://새도메인` (끝 `/` 없이) | `app/lib/site.ts` — canonical, sitemap, OG, 디스코드 알림 링크, `proxy.ts` 리다이렉트 |
| `NEXT_PUBLIC_SITE_NAME` | 바꿀 때만 | `site.ts` (기본 `게임정보허브`) |
| `NEXT_PUBLIC_OPERATOR_NAME` | 바꿀 때만 | `site.ts` (기본 `The Circles`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 연락 이메일 | `site.ts` (비어 있으면 화면에 "준비 중") |
| `NEXT_PUBLIC_GOOGLE_VERIFICATION` | 서치콘솔 HTML 태그의 content 값 | `app/layout.tsx` (아래 4번) |
| `NEXT_PUBLIC_NAVER_VERIFICATION` | 네이버 HTML 태그의 content 값 | `app/layout.tsx` (아래 4번) |

- `NEXT_PUBLIC_*`는 빌드할 때 코드에 박히므로 바꾼 뒤 **반드시 재배포**: Vercel → **Deployments** → 최신 Production 배포 `⋯` → **Redeploy** (빌드 캐시 사용 해제 권장)
- **GitHub `ENV_FILE`의 `NEXT_PUBLIC_SITE_URL`도 같이 바꾼다.** `scripts/daily-summary.mjs`가 디스코드 요약 링크에 이 값을 쓴다.

### 3. vercel.app → 새 도메인 리다이렉트 확인

`proxy.ts`는 Production 배포를 **배포별 주소(`…-abc123.vercel.app`)**로 열 때 `NEXT_PUBLIC_SITE_URL`로 308 리다이렉트한다. (API·`_next`·`robots.txt`·`sitemap.xml`·파일 경로는 제외)

```bash
curl -sI https://game-info-hub.vercel.app/ | grep -iE '^(HTTP|location)'
curl -sI https://game-info-hub.vercel.app/games/1 | grep -iE '^(HTTP|location)'
```

- 기대: `HTTP/2 308` + `location: https://새도메인/...`
- 안 되면: Vercel → **Settings → Domains**에서 `game-info-hub.vercel.app`을 새 도메인으로 **Redirect** 설정 (308) — 대시보드 쪽 설정이 더 확실하다.
- 새 도메인 자체 확인: `curl -sI https://새도메인/` → `200`

### 4. 서치콘솔 · 네이버 등록, sitemap 제출

- 사이트맵 주소: `https://새도메인/sitemap.xml` (`app/sitemap.ts`), robots: `/robots.txt` (`app/robots.ts`)
- **Google Search Console** (search.google.com/search-console)
  1. 속성 추가 → **URL 접두어** → `https://새도메인`
  2. 확인 방법 **HTML 태그** → `content="..."` 값을 Vercel `NEXT_PUBLIC_GOOGLE_VERIFICATION`에 넣고 재배포 → **확인**
  3. 왼쪽 **Sitemaps** → `sitemap.xml` 제출
- **네이버 서치어드바이저** (searchadvisor.naver.com)
  1. 웹마스터 도구 → 사이트 등록 → `https://새도메인`
  2. **HTML 태그** 방식 → content 값을 `NEXT_PUBLIC_NAVER_VERIFICATION`에 넣고 재배포 → 소유확인
  3. **요청 → 사이트맵 제출** → `https://새도메인/sitemap.xml`
- 태그 확인: `curl -s https://새도메인/ | grep -oE '(google|naver)-site-verification[^>]*'`
- 2번 환경변수와 같이 넣으면 재배포를 한 번으로 줄일 수 있다.

### 5. 관리자 재로그인, 운영자 배지 확인

- 도메인이 바뀌면 관리자 쿠키(`admin_session`)는 새 도메인에 없으므로 `https://새도메인/admin`에서 **다시 로그인**
- 운영자 배지: 로그인 상태로 `/community`에 글이나 댓글을 쓰면 목록·댓글에 **"운영자"** 배지가 붙는지 확인 (`app/components/community/PostList.tsx`, `Comments.tsx`의 `is_admin`)
- 확인용 글은 관리자 페이지에서 숨김 처리 (삭제 아님)

### 6. Vercel Analytics 켜기

- 코드는 이미 `<Analytics />`가 들어가 있음 (`app/layout.tsx`)
- Vercel → 프로젝트 → 상단 **Analytics** 탭 → **Enable** (요금제 한도 확인 필요)
- 켠 뒤 사이트를 한 번 열고 몇 분 뒤 방문 수가 잡히는지 확인

---

## 오픈 당일 (10/12) — 첫 1시간

### 디스코드 알림

- 신고·숨김·의견함이 들어오면 채널에 `관리자 페이지: https://새도메인/admin?tab=...` 링크와 함께 알림이 온다. 링크가 **새 도메인**인지 확인 (아니면 `NEXT_PUBLIC_SITE_URL` 재배포 누락)
- 테스트: `/feedback`에서 의견 하나 보내기 → 알림 오는지

### 에러 로그 보는 곳 (Vercel)

- Vercel → 프로젝트 → **Logs** 탭 → 환경 **Production**, 레벨 **Error / Warning** 필터
- 특정 배포 기준: **Deployments** → 배포 선택 → **Logs** / **Runtime Logs**
- 상태 코드 500·AI 경로(`/api/recommend`, `/api/compare-chat`) 위주로 볼 것
- 메뉴 이름은 Vercel 화면 개편에 따라 다를 수 있음 (확인 필요)

### AI 한도 사용량 확인 쿼리

한도 (`app/lib/aiGuard.ts`): 사이트 전체 **24시간 150회**, IP당 `recommend` 3회 · `compare-chat` 10회 · `compare-scores` 10회

```sql
-- 최근 24시간 전체 사용량 (150 넘으면 모두 차단)
select count(*) as used_24h, 150 - count(*) as remaining
from ai_calls
where created_at >= now() - interval '24 hours';

-- 종류별
select kind, count(*)
from ai_calls
where created_at >= now() - interval '24 hours'
group by kind order by 2 desc;

-- 지난 1시간, 10분 단위 추이
select date_trunc('minute', created_at) - (extract(minute from created_at)::int % 10) * interval '1 minute' as slot,
       count(*)
from ai_calls
where created_at >= now() - interval '1 hour'
group by 1 order by 1;

-- 한도 근처까지 쓴 IP 해시 (원문 IP는 저장 안 함)
select ip, kind, count(*)
from ai_calls
where created_at >= now() - interval '24 hours'
group by ip, kind
having count(*) >= 3
order by 3 desc;
```

- 실제 비용은 Anthropic 콘솔(console.anthropic.com) → **Usage**에서 확인
