# JamiDuNow 현재 상황

기준: 2026-10-09 밤 (main b9f85f3 + fix/video-ratelimit)

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
- 10/9: 스트리머 섹션 데스크톱 4개+더 보기·모바일 가로 스크롤(데스크톱 1244→501px, 모바일 1283→469px) / 스트리머 매칭 정규화·"롤" 별칭(카드·TCG·리프트바운드·토체스 제외)·별칭 보강(오버워치, 데바데, 좀보이드, 하늘의 궤적 2nd)·14일 재수집(새 연결 48개, streamer_videos 286행) / 스팀 429 재시도·실패는 null로 재탐색·fix-missing-prices 연속 제한 시 중단·daily timeout 150분 / Actions ubuntu-24.04 고정, checkout·setup-node v5 / /my-pc 문구 / CLAUDE.md·docs/design.md·/merge·STATUS.md 추가 / /merge 실패 시 중단·원격 브랜치 먼저 푸시, 포인트색 용도 목록 통합 / 스트리머 연결 안 된 영상 제목을 실행 로그에 출력 / 별칭 보강(search_name_ko, 상위 게임·통칭) / 여러 게임이 같이 쓰는 별칭(몬헌·바하·그타·유희왕 등)은 영상·게시글 매칭에서 제외(사이트 검색은 전부 표시) / 7일 재수집으로 새 연결 8개
- 10/9 밤: 메인 상단 여백 절반·인원 버튼을 검색창 위로·내 PC 찾기 슬림 바 / 카드 칸 높이 고정(제목 2줄·평가·칩 한 줄+"+N"·가격 바닥, 역대 최저가 칩은 가격 줄 오른쪽 끝)·패딩 16px·이미지 460/215 명시, 카드 사이 16px, 정가 13px --text-muted·할인가 20px
- 10/9 밤: 역대 최저가 칩(.timing-badge.best·.lowest-pill)을 라임에서 포인트색(글자 --accent-text·테두리 --accent) 특별 칩으로 분리, 할인율 배지·할인 차트는 그대로, --lowest-bg·border·radius 제거
- 10/9 밤: 할인 종료일 price_history.sale_ends_at(최신 행만, ITAD prices/v3 200개씩, 모르면 null·ITAD 오류/빈 응답이면 유지) — 매일 갱신 fill-sale-ends 추가, 화면은 아직 안 씀
- 10/9 이전: 스팀 "보유 중" 칩·nonce 재사용 차단 / OG 가로 배치 / 메인 재배치 / 통일 게임 카드 / 내 PC(/my-pc 한 곳에서 관리, 필터 기본 꺼짐, 등록이 필터를 켜지 않음) / 트레일러(스팀 공식 우선, YouTube 검증 강화, 수동 workflow "트레일러 채우기") / 정가(price_history.original_price, 역산 삭제)
- 메인 순서: h1 → 설명 → 인원 → 내 PC 바 → 검색 → 인원별 추천 → 이벤트 → 빠른 칩 3개 → 찜 추천 → 지금 뜨는 게임 → 이번주의 게임 → 스트리머 → 커뮤니티

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
- 이전 판단(heat_rank 라벨, 역대 최저가 배지 기준, Metascore만, 스팀 로그인 방식 c 등) 유지

## 로드맵
- 다음: fix/steam-confirm(check-delisted가 요청 제한을 판매 중단 후보로 보지 않게, enrich-fallback 빈 응답 크래시, fix-data-gaps·fill-tags-desc 재시도) / 가격 못 받은 2개(동방홍마향, Ori) / itad_id 없는 81개 매일 lookup / 보유 칩 HotChart·할인·찜목록 확장(10/11 확인 후) / 찜 동기화·내 PC 사양 계정 저장(user_pc 표, /api/me/pc)·개인정보 방침("서버로 보내지 않아요" 문구 수정 포함)·탈퇴(방침 변경은 시행 7일 전 공지) / YouTube 할당량 구조
- 10/10(토) 아침: 매일 갱신 확인(itad-heat, 상점명, 역대 최고 동접, Metascore) / Set up job 로그에 ubuntu-24.04·checkout@v5·setup-node@v5, Node 20 경고 없음 / 요청 제한 미처리 N 확인 / 에픽 전용 가족 공유 칸 숨김 / VALORANT 트레일러 / 정가 missing 0 유지
- 10/11 휴가: 도메인 구매(Cloudflare) → Vercel 연결 → vercel.app 리다이렉트, NEXT_PUBLIC_SITE_URL=https://jamidunow.com, GitHub ENV_FILE·site.ts·daily-summary.mjs 기본값, 디스코드 웹후크, 이메일 라우팅, 서치콘솔·네이버. 스팀 로그인 시험(로그인 → 아바타·닉네임 → 로그아웃, select steam_id, persona_name, last_login_at from users;, "보유 중" 칩, select count(*) from user_owned_games;, 비공개 프로필 안내. 칩이 안 뜨면 app/lib/user/ownedGames.ts부터)
- 10/12(월): backup.yml(upload-artifact@v6) 주간 실행 로그 확인
- 오픈 직전: security-check 3번 구간(실제 배포 점검 포함), 수익화 계획이 있으면 Vercel Pro
- 오픈 후: 스팀 로그인 2단계(친구 목록·찜 공유·다 가진 게임), AI 문장 추천, 자체 지수 이름, 티어·유저 평가, 컬렉션·별점, 모드 인원, 스팀 역대 최저가 별도 수집, 영어 원제 검색, 벤치마크 재시도, 클리어 시간, 라이트 모드, 추천 세팅 투표, DLSS·FSR, 스트리머 기획전, 추천 인원 순위, 고인물 지표, 스팀덱 등급, 디스코드 초대 만료 13개, 진입장벽·혼자 null 10개, 인기 상위 1인용 89개, lint 에러 4개, 파서 원문 6건, 스트리머 한 영상 여러 게임 연결, 시리즈 키워드 표, 미연결 영상 제목 기록, 카탈로그 누락(도깨비의 세계, 쁘띠플래닛, 동방영야초 등)

## 기각
예상 FPS·벤치마크 점수, AI 그래픽 옵션 가이드, 스트리머 PC 사양 매칭, "구동 불가" 배지, 카드 목록 판정 표시, 노랑 신호등, 비교 담기 카운트 TOP3, 순위 미러링, 100vh 고정, "HLTB 기준" 표기, 추천도 숫자 삭제, 비교 버튼 아이콘 제거, 스트리머 인원 연동, ITAD Twitch·번들·쿠폰, 메인 카드 ITAD 순위, GOTY 금색 배지, 카드 동접 그래프 복귀, 1~3위 동접 숫자, 전체 순위 페이지, 배너 캐러셀, 필터 미통과 후보로 빈자리 채우기, 원가 역산 이행 기간, 상세 인라인 사양 등록 폼, 사양 등록 시 필터 자동 켜기, 스트리머 카드 이미지 비율 축소, YouTube 태그 매칭
