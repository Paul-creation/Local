# JamiDuNow 현재 상황

기준: 2026-10-10 (main 54de2a9)

## 개요
- 친구랑 할 게임을 인원·가격·할인·진입장벽·PC 사양으로 비교하는 한국어 사이트
- 저장소 Paul-creation/Local, Next.js + Supabase + Vercel(Hobby)
- 주소 game-info-hub.vercel.app, 도메인 jamidunow.com(10/11 구매 예정). 오픈·홍보는 11월쯤
- 화면엔 "JamiDuNow"만, "재밌드나"는 구조화 데이터에만. 푸터 "© 2026 The Circles"

## 일하는 방식
- 채팅 Claude는 방향·검토, 실행은 Claude Code(Codespaces) J·K 두 세션
- 지시문은 세션 이름을 붙이고, 끝에 "<메시지> 이 메시지로 커밋하고 푸시해줘"
- 규칙은 CLAUDE.md, 디자인은 docs/design.md, 머지는 /merge
- UI 브랜치는 사용자가 프리뷰를 확인한 뒤 머지(모바일은 F12 → Ctrl+Shift+M). Claude Code는 VERCEL_AUTOMATION_BYPASS_SECRET로 프리뷰를 직접 열 수 있음
- 5시간 한도 80%를 넘으면 큰 작업은 새로 시작하지 않음

## main 반영 (최근)
- 10/10: fix/privacy-steam — 개인정보처리방침 Steam 로그인 항목 추가, 2026-10-10 즉시 시행(이미 제공 중인 기능의 처리 내용을 적은 개정, 9번에 "불리하지 않은 변경·이미 하는 처리는 공지와 함께 즉시 시행 가능" 명시). 수집 항목·수집하지 않는 것·목적·1년 자동 삭제·삭제 방법·만 14세 미만 이용 불가 문구. 내 정보 삭제(DELETE /api/me, 닉네임 메뉴 "내 정보 삭제", 확인 창 뒤 user_owned_games·users 삭제와 user_session·logged_in 쿠키·sessionStorage 정리, 세션 사용자 본인만·Origin 확인). 1년 자동 파기는 Supabase pg_cron purge-inactive-users(매일 04:30 KST, 마지막 로그인 1년 경과 users와 user_owned_games, SQL은 사용자가 Supabase에서 실행 — 등록 전에는 방침과 어긋남). 전용 이메일이 생기면 6번 "로그인이 안 되는 경우" 안내(/feedback "기타") 교체
- 10/10: feat/video-stage — 상세 "영상으로 미리 보기"를 큰 플레이어+썸네일 목록으로(탭 삭제, 한 목록). 섹션 폭 16:9 메인 플레이어는 처음엔 첫 영상 썸네일이고, 목록 썸네일을 누르면 메인이 바뀌어 바로 재생(autoplay). 정렬 친구랑 플레이(조회수) → 하이라이트 → 스트리머 일반(tier 1) → 쇼츠(tier 2) → vod(tier 3), 순서·자르기는 lib/videoList(tier는 streamerPick.tierOf). 최대 8개(친구랑 3, 하이라이트 2, 스트리머 1명당 2, vod 2, 같은 video_id 1번). 출처 칩 "멀티 플레이 · 채널", "하이라이트", "스트리머 · 이름"(+ " · 풀영상"/" · 쇼츠"). 목록 좌우 화살표(‹ ›, 보이는 폭 80% 이동, 끝이면 숨김, hover 기기만)와 얇은 스크롤바, 썸네일 loading=eager(삭제된 영상은 목록에서 빠짐), 선택 테두리 --accent, 선택한 카드가 가려져 있으면 scrollIntoView(nearest). #streamer-videos는 섹션 앵커로 유지
- 10/10: feat/streamer-links — 스트리머 칩을 영상 링크로(app/lib/streamerPick.ts 규칙 A: main·edit·game 일반 영상 → 같은 채널 쇼츠 → vod, 같은 단계에선 최근 영상, vod면 aria-label에 "(풀영상)", title은 쓰지 않음), 칩 툴팁을 사이트 스타일로(data-tip, 터치 기기 제외, 첫 칩은 왼쪽 정렬), 카드 밖 "플레이 영상 보기" 줄 삭제, GameCard stretched 옵션, HotChart 칩은 span 유지
- 10/10: feat/back-link — 하위 페이지 공통 BackLink(fallbackHref, label, preferList). 서버 HTML은 "← 라벨" 일반 링크, 마운트 뒤 사이트 안 이동이면 "← 뒤로"+history.back(), 아니면 fallback으로 이동. 사이트 안 이동 = NavTracker(layout)가 센 클라이언트 이동 1회 이상, 또는 referrer 출처 같고 history.length>1(새 탭은 fallback, lib/backLink 테스트). 게임 상세·/compare는 sessionStorage list_url 우선 fallback(없으면 /, list_scroll·list_count 복원은 두 경우 모두 동작), /compare/new→/compare. /this-week·/about·/faq·/privacy·/terms→홈, 커뮤니티 게시판·글쓰기·운영정책→/community, 글 상세→그 게시판(기존 아래쪽 cm-btn 삭제). BackToList.tsx 삭제. /compare는 1단계 메뉴지만 기존 뒤로 링크를 BackLink로 교체해 유지(예외). 메뉴 1단계 페이지(홈·내 PC·찜목록·커뮤니티·의견)는 넣지 않음
- 10/10: chore/remove-light — 라이트 모드 제거, 다크 고정. 헤더 "라이트" 버튼·ThemeToggle·lib/theme.ts·테마 초기화 스크립트·suppressHydrationWarning·[data-theme="light"] 규칙과 라이트 토큰 삭제, :root:not([data-theme="light"]) 접두사는 :root로, viewport colorScheme 'dark'(meta color-scheme). 예전에 저장된 localStorage theme 키는 ThemeKeyCleanup이 접속 시 한 번 지움. 정규식 삭제가 .site-menu a 규칙까지 지워 헤더 메뉴가 깨진 것을 원본 블록으로 복구(fix(header))
- 10/10: feat/list-view — 검색 결과 카드/행 보기 전환. ResultCard view="row"(썸네일·이름·스토어·인원·진입장벽·보유 칩·가격 블록·+ 비교, 태그 칩 없음), 결과 머리 정렬 탭 줄에 aria-pressed 버튼 2개(.tabs/.tab 재사용), 선택은 localStorage jdn_list_view에만 저장(주소엔 안 담음). 행 높이는 min-height, 375px에서는 가격을 한 줄로 압축(할인율+할인가+"~10/13" 짧은 종료일, 정가·역대 최저 칩 숨김, + 비교 같은 줄 오른쪽, 이름 한 줄)해 할인 큰 순 상위 24행 최대 108px. 375px 정렬 탭은 가로 스크롤+오른쪽 페이드로 "낮은 가격순" 잘림 수정. 평가는 1차 제외(INDEX_FIELDS에 review 칸 없음), 찜 목록·비슷한 게임은 범위 밖
- 10/10: feat/this-week — /this-week "이번 주 할인 마감" 세로 타임라인(KST 날짜 마디 오늘/내일/요일, revalidate 300). 데이터 2단계: price_history에서 sale_ends_at이 지금~168시간 안인 game_id만 뽑고 → 그 게임의 최신 가격 1행을 다시 받아 같은 조건(discount>0, 종료일 지금~168시간)으로 다시 거름(옛 행 때문에 끝난 할인 제외, 테스트 포함). 마디마다 6장만 보이고 "N개 더 보기"(오늘 마디는 전부 펼침), 브라우저 시각으로 끝난 카드·빈 마디 숨김(전부 비면 빈 상태 문구). 같은 마감 시각 2차 정렬 heat_rank(작은 순, 없으면 뒤)→할인율→이름. 메인 "이번주의 게임"에 h2 제목 신설(+주차)·카드 안 라벨 제거, 제목 오른쪽에 "이번 주 할인 마감 보기 →"(375px에서 제목 아래 왼쪽), 푸터 링크, sitemap 추가. 헤더 메뉴엔 안 넣음
- 10/10: docs/merge-conflict-stop — rebase 중 충돌이 나면 해결하지 않고 멈춰 충돌 파일과 양쪽 내용을 보고(/merge 3단계·CLAUDE.md)
- 10/10: fix/home-order — 메인 이벤트 배너를 히어로 위 맨 위로, 히어로는 카피·검색·인원·PC 바 순, 900px 미만에서 이벤트 배너를 한 줄 띠(48px, 제목 말줄임+→)로 축소(375px 첫 화면에 인원 버튼 보임)
- 10/10: docs/merge-base — /merge range-diff를 rebase 전 브랜치 끝 커밋(OLD_TIP) 기준으로, 기능 브랜치는 main 푸시 전 푸시 금지, 삭제는 푸시 확인 후 따로 실행
- 10/10: feat/sale-ends-ui — 할인 종료일 표시(할인 줄 옆), 상세 역대 최저가 게이지(할인 중일 때만), 카드 윤곽 대비 개선, 메인 커뮤니티 링크·빈 상자 제거
- 10/10: fix/footer — 푸터 면책 문구를 두 줄로 축소(비공식 사이트·Steam 상표 한 문단 + AI 문구)·word-break keep-all, STATUS 오픈 직전 점검 추가
- 10/10: fix/itad-retry-cap — ITAD 429 retry-after가 60초를 넘으면 기다리지 않고 ItadLimitError(enrich-itad-heat는 저장한 배치를 남기고 "ITAD 요청 제한으로 중단, 처리 N/전체" 로그), 429·타임아웃 대기마다 "ITAD 429 대기 37초 (재시도 1/3)" 로그. 오늘 밤 03:17 정기 실행에서 확인 예정(수동 재실행 안 함)
- 10/10: fix/itad-timeout — ITAD 요청 30초 타임아웃(무응답·연결 실패는 기존 재시도, 최악 한 요청 약 2분 35초), enrich-itad-heat 100개마다 진행 로그·배치마다 저장, enrich-recent-reviews 1회 최대 300개(오래된 순), daily cron 17 18 * * *(KST 03:17). 10/10 매일 갱신 #11이 enrich-itad-heat 45분 무응답으로 실패한 것에 대한 수정
- 10/9: 스트리머 섹션 데스크톱 4개+더 보기·모바일 가로 스크롤(데스크톱 1244→501px, 모바일 1283→469px) / 스트리머 매칭 정규화·"롤" 별칭(카드·TCG·리프트바운드·토체스 제외)·별칭 보강(오버워치, 데바데, 좀보이드, 하늘의 궤적 2nd)·14일 재수집(새 연결 48개, streamer_videos 286행) / 스팀 429 재시도·실패는 null로 재탐색·fix-missing-prices 연속 제한 시 중단·daily timeout 150분 / Actions ubuntu-24.04 고정, checkout·setup-node v5 / /my-pc 문구 / CLAUDE.md·docs/design.md·/merge·STATUS.md 추가 / /merge 실패 시 중단·원격 브랜치 먼저 푸시, 포인트색 용도 목록 통합 / 스트리머 연결 안 된 영상 제목을 실행 로그에 출력 / 별칭 보강(search_name_ko, 상위 게임·통칭) / 여러 게임이 같이 쓰는 별칭(몬헌·바하·그타·유희왕 등)은 영상·게시글 매칭에서 제외(사이트 검색은 전부 표시) / 7일 재수집으로 새 연결 8개
- 10/9 밤: 메인 상단 여백 절반·인원 버튼을 검색창 위로·내 PC 찾기 슬림 바 / 카드 칸 높이 고정(제목 2줄·평가·칩 한 줄+"+N"·가격 바닥, 역대 최저가 칩은 가격 줄 오른쪽 끝)·패딩 16px·이미지 460/215 명시, 카드 사이 16px, 정가 13px --text-muted·할인가 20px
- 10/9 밤: 역대 최저가 칩(.timing-badge.best·.lowest-pill)을 라임에서 포인트색(글자 --accent-text·테두리 --accent) 특별 칩으로 분리, 할인율 배지·할인 차트는 그대로, --lowest-bg·border·radius 제거
- 10/9 밤: 할인 종료일 price_history.sale_ends_at(최신 행만, ITAD prices/v3 200개씩, 모르면 null·ITAD 오류/빈 응답이면 유지) — 매일 갱신 fill-sale-ends 추가, 화면은 아직 안 씀
- 10/9 이전: 스팀 "보유 중" 칩·nonce 재사용 차단 / OG 가로 배치 / 메인 재배치 / 통일 게임 카드 / 내 PC(/my-pc 한 곳에서 관리, 필터 기본 꺼짐, 등록이 필터를 켜지 않음) / 트레일러(스팀 공식 우선, YouTube 검증 강화, 수동 workflow "트레일러 채우기") / 정가(price_history.original_price, 역산 삭제)
- 메인 순서: 이벤트 배너(900px 미만에서는 한 줄 띠) → h1 → 설명 → 검색 → 인원 → 내 PC 바 → 인원별 추천 → 빠른 칩 3개 → 찜 추천 → 지금 뜨는 게임 → 이번주의 게임(h2 제목 + 이번 주 할인 마감 링크) → 스트리머 → 인기 게시물(기준 이상일 때만)

## 진행 중
- 없음

## 완료된 판단
- 1~3위 카드에 동접·그래프 안 넣음(상세 헤더에 있음). 4~10위 줄엔 동접 유지
- 지금 뜨는 게임은 순위라 중복 제거 대상 아님. 전체 순위 페이지 안 만듦
- runsOnMyPc는 사양 데이터가 없으면 통과
- 슈퍼로봇대전 30은 트레일러 없음 감수
- ISR(revalidate 300) 때문에 데이터 갱신 후 메인 반영은 최대 5~10분 지연
- 매일 갱신 전 수동 수집이 필요하면 해당 스크립트만 Codespaces에서 직접 실행
- 스트리머: 한 영상엔 가장 긴 이름 하나만 연결. "롤"은 제목에서만, 커뮤니티 글에서는 허용. 라이어게임은 라이어스 바와 같은 게임인지 확인 전까지 보류. 게임이 6개뿐이면 데스크톱은 4개만 보이고 버튼 없음. 더 보기 상태는 저장 안 함
- 할인 종료일은 price_history.sale_ends_at(ITAD prices/v3, 200개씩, 모르면 null, 배치가 통째로 비면 유지). 종료일 표시는 시각까지("10/14 02:00까지"), 24시간 안이면 "오늘·내일 02:00까지" --sale 스타일, 카운트다운은 안 씀
- 할인 게이지는 상세 페이지에서 할인 중일 때만
- 캘린더 1차는 할인 마감만(/this-week, 세로 타임라인). 메인엔 "이번주의 게임" 제목 옆 링크 1개 + 푸터 링크, 헤더 메뉴엔 안 넣음. 종료일 모르는(null) 할인은 올리지 않음
- 레포는 Public 유지. 배포 저장 공간은 보존 기간(프리뷰 1주, 프로덕션 2주, 실패·취소 최단)과 Ignored Build Step으로 해결
- 카드 밖 "플레이 영상 보기" 줄은 없애고, 카드 안 스트리머 이름 칩을 누르면 영상으로 이동(카드 클릭은 상세 페이지 유지)
- 푸터는 비공식 사이트 문장과 Steam 상표 문장 두 줄 + AI 문구로 축소(상표 고지는 유지)
- 라이트 모드는 없앰(다크 고정, 헤더 토글·테마 코드 제거, 저장된 theme 키는 접속 시 한 번 지움)
- enrich-recent-reviews는 1회 300개(한 바퀴 약 3일). 화면에 쓸 때 상한 450 또는 표시 기준 5일 중 결정
- 이전 판단(heat_rank 라벨, 역대 최저가 배지 기준, Metascore만, 스팀 로그인 방식 c 등) 유지

## 로드맵
- 다음: fix/steam-confirm(check-delisted가 요청 제한을 판매 중단 후보로 보지 않게, enrich-fallback 빈 응답 크래시, fix-data-gaps·fill-tags-desc 재시도) / 가격 못 받은 2개(동방홍마향, Ori) / itad_id 없는 81개 매일 lookup / 보유 칩 HotChart·할인·찜목록 확장(10/11 확인 후) / 찜 동기화·내 PC 사양 계정 저장(user_pc 표, /api/me/pc)·개인정보 방침("서버로 보내지 않아요" 문구 수정 포함)·탈퇴(방침 변경은 시행 7일 전 공지) / YouTube 할당량 구조 / 푸터 축소 / (일주일 뒤에도 저장 공간이 높으면) OG 폰트 fetch 전환
- 10/10(토) 아침: 매일 갱신 확인(itad-heat, 상점명, 역대 최고 동접, Metascore) / Set up job 로그에 ubuntu-24.04·checkout@v5·setup-node@v5, Node 20 경고 없음 / 요청 제한 미처리 N 확인 / 에픽 전용 가족 공유 칸 숨김 / VALORANT 트레일러 / 정가 missing 0 유지
- 전용 이메일이 생기면 CONTACT_EMAIL과 개인정보처리방침 6번의 "로그인이 안 되는 경우" 안내(지금은 /feedback "기타")를 바꿈. 방침은 2026-10-10 즉시 시행(이미 제공 중인 기능의 처리 내용을 적은 개정). 1년 자동 파기는 Supabase pg_cron(매일 04:30 KST) SQL을 사용자가 실행해야 방침과 맞음
- 10/11 휴가: 도메인 구매(Cloudflare) → Vercel 연결 → vercel.app 리다이렉트, NEXT_PUBLIC_SITE_URL=https://jamidunow.com, GitHub ENV_FILE·site.ts·daily-summary.mjs 기본값, 디스코드 웹후크, 이메일 라우팅, 서치콘솔·네이버. 스팀 로그인 시험(로그인 → 아바타·닉네임 → 로그아웃, select steam_id, persona_name, last_login_at from users;, "보유 중" 칩, select count(*) from user_owned_games;, 비공개 프로필 안내. 칩이 안 뜨면 app/lib/user/ownedGames.ts부터)
- 10/12(월): backup.yml(upload-artifact@v6) 주간 실행 로그 확인
- 오픈 직전: 로그인 후·찜/비교에 게임 담긴 상태 확인, security-check 3번 구간(실제 배포 점검 포함), 수익화 계획이 있으면 Vercel Pro
- 오픈 후: "1개로 둘이" 칩, 친구 투표 링크, 캘린더 확장(스팀 무료 주말, 에픽·ITAD 무료 배포, 출시 예정), 스팀 로그인 2단계(친구 목록·찜 공유·다 가진 게임), AI 문장 추천, 자체 지수 이름, 티어·유저 평가, 컬렉션·별점, 모드 인원, 스팀 역대 최저가 별도 수집, 영어 원제 검색, 벤치마크 재시도, 클리어 시간, 추천 세팅 투표, DLSS·FSR, 스트리머 기획전, 추천 인원 순위, 고인물 지표, 스팀덱 등급, 디스코드 초대 만료 13개, 진입장벽·혼자 null 10개, 인기 상위 1인용 89개, lint 에러 4개, 파서 원문 6건, 스트리머 한 영상 여러 게임 연결, 시리즈 키워드 표, 미연결 영상 제목 기록, 카탈로그 누락(도깨비의 세계, 쁘띠플래닛, 동방영야초 등)

## 기각
예상 FPS·벤치마크 점수, AI 그래픽 옵션 가이드, 스트리머 PC 사양 매칭, 스트리머 "+N명" 삭제, 카드 전체를 영상 링크로, 파티 비용 계산, 사양 패스 칩(상옵 fps), 블러 사라짐 애니메이션, 친구 일정 캘린더, OG 폰트 서브셋, "구동 불가" 배지, 카드 목록 판정 표시, 노랑 신호등, 비교 담기 카운트 TOP3, 순위 미러링, 100vh 고정, "HLTB 기준" 표기, 추천도 숫자 삭제, 비교 버튼 아이콘 제거, 스트리머 인원 연동, ITAD Twitch·번들·쿠폰, 메인 카드 ITAD 순위, GOTY 금색 배지, 카드 동접 그래프 복귀, 1~3위 동접 숫자, 전체 순위 페이지, 배너 캐러셀, 필터 미통과 후보로 빈자리 채우기, 원가 역산 이행 기간, 상세 인라인 사양 등록 폼, 사양 등록 시 필터 자동 켜기, 스트리머 카드 이미지 비율 축소, YouTube 태그 매칭
