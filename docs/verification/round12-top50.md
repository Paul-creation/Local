# 12차: 인원 빈칸 검증

- 날짜: 2026-10-21
- 대상: 11차 뒤에 남은 인원 빈칸 중 인기순 50개 (반영 후보 10개 + 보류 40개)
- 기준: `docs/verification-rules.md` — 친구끼리 한 판 최대 인원, 모드 제외, 서버형은 기본 설정 기준. AI API 안 씀
- 결정 파일: `data/verification/round12-top50.json` (커밋 안 됨, 반영 로그는 `applied-log.txt`)

## 결론: 10개 모두 반영, 40개 보류

반영한 10개는 모두 min 1. 반영은 `apply-verified-players.mjs`로 했고 10개 모두 결정 때 본 값(1~빈칸)과 DB 값이 같아 건너뛴 것은 없다.

| 게임 | 값 | 근거 |
|---|---|---|
| Stronghold Crusader: Definitive Edition 스트롱홀드 크루세이더: 결정판 | 1~빈칸 → 1~8 | 상점: "go head-to-head with 8 players online" (IGDB 후보 4와 다르지만 상점 문구 우선) |
| Escape the Backrooms | 1~빈칸 → 1~4 | 상점: 1-4 player co-op, team of up to 4 players |
| 노 레스트 포 더 위키드 | 1~빈칸 → 1~4 | 상점: co-op for up to four players, seamless online co-op |
| Coral Island | 1~빈칸 → 1~4 | 상점: up to 3 friends (4 farmers total) |
| World War Z | 1~빈칸 → 1~4 | 상점: co-op shooter for up to 4 players. PvP 모드 인원은 상점에 없음. 판단 필요 |
| ONE PIECE Bounty Rush | 1~빈칸 → 1~4 | 상점: 4 vs 4 multiplayer team action game. 파티(팀) 기준 4, 매치 전체는 8. 커스텀 매치 여부 모름. 판단 필요 |
| Anno 117: Pax Romana | 1~빈칸 → 1~16 | Ubisoft 공식 기사: 협동 최대 4명, 4v4v4v4 등 최대 16명 세션 가능(초대 전용). 같은 판 기준 16, 협동 4. 판단 필요 |
| Anno 1800 | 1~빈칸 → 1~4 | Ubisoft 상점 문구(검색 결과 인용): co-op up to three friends = 4명. Ubisoft 지원 문서에서 상한을 직접 확인 못 함. 약한 근거, 판단 필요 |
| Totally Accurate Battle Simulator | 1~빈칸 → 1~2 | 스팀·PlayStation·Xbox 목록 모두 온라인 2명(1v1). 약한 근거(상점 설명엔 인원 숫자 없음). 판단 필요 |
| 토탈워: 삼국 | 1~빈칸 → 1~8 | Xbox 스토어 목록: 온라인 멀티플레이 2-8, 온라인 협동 2-2(Co-Optimus도 협동 2). 스팀 상점엔 숫자 없음, 제작사 문서 못 찾음. 약한 근거, 판단 필요 |

## 사용자 결정 (2026-10-21)

- Anno 117: max 16, party_max 4. party_max·session_max는 11차 Guild Wars 2와 같이 `data/meta/play-modes.json`에 줄을 추가했다(party_max 4, session_max 16). DB의 party_max·session_max 칸은 `scripts/apply-filter-v2.mjs`가 이 파일을 읽어 채우며, 이 문서를 쓴 시점에는 아직 실행하지 않았다(DB 현재 값 null)
- ONE PIECE Bounty Rush: max 4 (4 vs 4의 팀 기준, 매치 전체 8은 쓰지 않음). party_max 줄은 따로 넣지 않았다

## 약한 근거로 반영한 것 (재확인 후보)

- Anno 1800 4: Ubisoft 상점 문구를 검색 결과로만 봤고 지원 문서에서 상한을 직접 확인 못 함
- Totally Accurate Battle Simulator 2: 스팀 설명엔 숫자가 없고 스팀·PlayStation·Xbox 목록의 온라인 2명(1v1)에 의존
- 토탈워: 삼국 8: Xbox 스토어 목록(멀티 2-8, 협동 2) 기준, 스팀·제작사 문서엔 숫자 없음
- World War Z 4: 협동 기준이고 PvP 모드 인원은 상점에 없음
- Stronghold Crusader: Definitive Edition 8: 상점 문구 "8 players online" 우선, IGDB 후보는 4

## 보류(null) 40개

| 게임 | 이유 |
|---|---|
| AION 2 | 11차 보류 유지: 파티 최대 인원 공식 출처 없음 |
| EA SPORTS FC™ 27 | 11차 보류 유지(새 근거 못 찾음) |
| Battlefield™ 6 | 재검색: 서버 64(32v32)는 제3자 기사뿐, 분대 4는 공식 확인 못 함 |
| VRChat | 11차 보류 유지(새 근거 못 찾음) |
| Football Manager 26 | 11차 보류 유지(새 근거 못 찾음) |
| Crusader Kings III | 11차 보류 유지 |
| EA SPORTS FC™ 26 | 11차 보류 유지(새 근거 못 찾음) |
| Escape from Tarkov | 재검색: 파티 5명(1곳)·4명(1곳)·공식 근거 없음, 여전히 엇갈림 |
| The Isle | 11차 보류 유지(새 근거 못 찾음) |
| [WoG] 창세기전 키우기: 무한 파밍 | 11차 보류 유지(새 근거 못 찾음) |
| Sid Meier's Civilization® V | 11차 보류 유지(새 근거 못 찾음) |
| RuneScape: Dragonwilds 룬스케이프: 드래곤와일즈 | 11차 보류 유지: 호스트 4명/전용 서버 6명 엇갈림 |
| Russian Fishing 4 | 11차 보류 유지(새 근거 못 찾음) |
| No Man's Sky | 재검색: 협동 4명은 NEXT 때 발언 인용 기사뿐(제3자), 현재 공식 근거 못 찾음 |
| IdleOn - 더 아이들 MMO | 11차 보류 유지(새 근거 못 찾음) |
| 아세토 코르사 Assetto Corsa | 11차 보류 유지(새 근거 못 찾음) |
| 알비온 온라인 | 11차 보류 유지(새 근거 못 찾음) |
| Scam With Your Friends | 11차 보류 유지(새 근거 못 찾음) |
| Europa Universalis V | 11차 보류 유지(새 근거 못 찾음) |
| Le Mans Ultimate | 11차 보류 유지(새 근거 못 찾음) |
| 스타워즈: 은하계 레이서™ | 11차 보류 유지(새 근거 못 찾음) |
| Victoria 3 | 11차 보류 유지(새 근거 못 찾음) |
| Active Matter | 11차 보류 유지(새 근거 못 찾음) |
| Enlisted | 11차 보류 유지(새 근거 못 찾음) |
| 플레이투게더 | 홈 파티 인원 상한을 공식 자료에서 못 찾음(미니게임 30명은 매치 인원) |
| Supermarket Simulator | 11차 보류 유지(새 근거 못 찾음) |
| 샵 타이탄 | 상점에 인원 숫자 없음(MMO 길드 방식) |
| 아세토 코르사 컴페티치오네 Assetto Corsa Competizione | IGDB 후보 3은 의심, 서버 maxConnections는 호스팅 설정이라 공식 최대 아님 |
| Microsoft Flight Simulator (2020) 40th Anniversary Edition | 멀티 인원 근거 못 찾음 |
| The Bazaar | 비동기 PvP, 같은 판 인원 근거 없음 |
| 컨커러스 블레이드 | 상점 15 vs 15 공성이나 친구끼리 묶이는 인원 불명(IGDB 30) |
| 토탈워: 아틸라 | IGDB 후보 2뿐, 공식 근거 못 찾음 |
| World of Sea Battle | IGDB 후보 10000은 비현실적, 근거 없음 |
| Alchemy Factory | 상점에 협동 인원 숫자 없음(전용 서버 언급만) |
| Batomon Showdown | 비동기 PvP, 인원 개념 없음 — 성격 판단 필요 |
| Need for Speed™ Heat | 제3자가 12·15·16으로 엇갈림, 공식 근거 없음(IGDB 8과도 다름) |
| VEIN | 제3자 호스팅 문서가 8명/32명으로 엇갈림, 공식 근거 없음 |
| My Singing Monsters | 인원 근거 없음(수집형 모바일 이식) |
| Waterpark Simulator | 상점에 "friends"만 있고 숫자 없음 |
| Evitania Online - Idle RPG | 방치형 MMO, 인원 근거 없음 |
