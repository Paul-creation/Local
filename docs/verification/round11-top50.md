# 11차: 인원 빈칸 상위 50개 검증

- 날짜: 2026-10-20
- 대상: `scripts/list-players-pending.mjs`가 만든 대기 목록(노출 게임 중 max_players가 빈 221개) 중 현재 접속자 상위 50개 (AION 2 263,028명 ~ Aimlabs 3,607명)
- 기준: `docs/verification-rules.md` — 친구끼리 한 판 최대 인원, 모드 제외, 서버형은 기본 설정 기준. AI API 안 씀
- 근거: 스팀 상점 소개문(영어) 먼저, 없으면 개발사·유통사 문서, 그다음 비공식 2곳 이상이 같은 숫자일 때만. 엇갈리거나 못 찾으면 null(보류)
- 결정 파일: `data/verification/round11-top50.json` (커밋 안 됨, 반영 로그는 `applied-log.txt`)

## 결론: 23개 채움 중 22개 반영, 27개 보류

반영한 22개는 모두 min 1로 넣었다. 오버워치(1~5)는 DB의 Overwatch 2 행과 중복이라 합치는 SQL을 쓴 뒤 반영한다.

| 게임 | 값 | 근거 |
|---|---|---|
| ARK: Survival Ascended | 1~빈칸 → 1~70 | 상점: 공개 온라인 최대 70명(비공개 세션 8명, 로컬 2명). 서버형은 기본 공개 서버 기준(규칙 1) |
| Delta Force | 1~빈칸 → 1~64 | 상점: "64 players clash in massive battles" (규칙 1, BF V 64와 같은 기준) |
| The Binding of Isaac: Rebirth | 1~빈칸 → 1~2 | 상점: 2-Player local co-op |
| 디아블로 II 레저렉션 - 지옥불 에디션 | 1~빈칸 → 1~8 | 상점: 8 player co-op |
| Squad | 빈칸~? → 1~100 | 상점: 100-player battles (50 vs 50, 분대 9명). 서버형 규칙 1 |
| over the hill | 1~빈칸 → 1~4 | 상점: solo or with up to three friends |
| 하우스 플리퍼 2 | 1~빈칸 → 1~4 | 상점: up to four players (스토리·샌드박스 모두) |
| Far Cry® 6 | 1~빈칸 → 1~2 | 상점: 캠페인 전체 2-player co-op |
| STALZONE \| 스탈존 | 빈칸~? → 1~5 | 상점: 5-player squads. 서버 전체 인원은 상점에 없어 분대 기준(PUBG 4·Apex 3과 같은 기준). 판단 필요 |
| Aimlabs | 1~빈칸 → 1~4 | 상점: Free-for-All four-player (다른 모드의 인원은 상점에 없음). 판단 필요 |
| War Thunder | 1~빈칸 → 1~4 | War Thunder 개발사 공지: 분대 최대 4명 (스쿼드론 이벤트는 8명, 상시 아님) |
| 마블 라이벌즈 | 빈칸~? → 1~6 | 비공식 2곳: IGDB 후보 6 + 파티창 6칸(Gfinity 가이드)·분대 6명(블로그). 공식 확인 못 함. 판단 필요 |
| THE FINALS | 빈칸~? → 1~3 | 공식 도움말(Embark): 팀 3명 (Cashout 3v3v3v3) |
| Conan Exiles Enhanced | 1~빈칸 → 1~40 | 비공식 3곳이 같은 숫자: 공식 서버 40명(Co-Optimus, Steam 토론, mein-mmo 기사), IGDB 후보도 40. Funcom 현행 공식 문서는 못 찾음. 판단 필요 |
| Tom Clancy’s The Division® 2 | 1~빈칸 → 1~8 | Ubisoft 확인: 일반 4인, 레이드 8인(직접 팀을 꾸려 입장). IGDB 후보도 8 |
| Dying Light 2 Stay Human: Reloaded Edition | 1~빈칸 → 1~4 | 4인 협동 캠페인(Techland 발표 기사, Co-Optimus). IGDB 후보도 4 |
| Grounded 2 | 1~빈칸 → 1~4 | 여러 가이드에서 협동 최대 4명(Grounded 1과 동일), 로컬 협동 없음. 얼리 액세스라 바뀔 수 있음 |
| Green Hell | 1~빈칸 → 1~4 | PC 협동 업데이트 4인(TechRaptor, Co-Optimus) |
| ICARUS 외계 행성 서바이벌 | 1~빈칸 → 1~8 | 상점·소개: 스팀 친구 최대 8명 초대(미션·오픈 월드). IGDB 후보도 8 |
| Age of Empires IV: Anniversary Edition | 1~빈칸 → 1~8 | 스토어 목록: 온라인 최대 8명 PvP·협동 (IGDB 후보 4와 다르지만 8인 매치가 기본). AoE II DE 1~8과 같은 기준 |
| F1® 25 | 1~빈칸 → 1~22 | PlayStation 스토어 목록: 온라인 최대 22명(그리드 22대). PC 로비도 같다고 보고 규칙 1 적용. 공식 PC 문구는 못 봄 |
| World of Tanks | 빈칸~? → 1~3 | 공식 가이드: 랜덤 전투 소대 최대 3명 (매치 전체는 30명) |

판단이 갈렸던 것: 마블 라이벌즈 6(공식 확인 못 함), 콘 엑자일 40(현행 공식 문서 못 찾음), STALZONE 5(분대 기준, 서버 인원 없음), Aimlabs 4(FFA 기준), F1 25 22(PlayStation 스토어 문구를 PC에 적용).

## 보류(null) 27개

| 게임 | 이유 |
|---|---|
| AION 2 | MMORPG. 상점엔 5인 파티·10인 던전만 있고 파티 최대 인원은 없음. MMO 기준(파티 vs 레이드) 정해지면 재검토 |
| EA SPORTS FC™ 27 | FC 27: Pro Clubs(11인)·로컬(2~4인) 중 기준이 불분명. 공식 확인 못 함 |
| EA SPORTS FC™ 26 | FC 26: 위와 같음 |
| Battlefield™ 6 | Battlefield 6: 분대 4·서버 64로 알고 있으나 확인 못 함 (BF V 64 기준이면 서버 인원 필요) |
| Euro Truck Simulator 2 | ETS2: 공식 컨보이 모드 인원을 확인 못 함 (TruckersMP는 모드라 제외). DB의 American Truck Simulator 1~4와 충돌 가능성 |
| VRChat | VRChat: 월드마다 다름. 상한 80(위키)이지만 기본값이 없음 |
| Football Manager 26 | Football Manager 26: 멀티 인원 확인 못 함 |
| Crusader Kings III | CK3: 32명은 CK2 수치. 콘솔 12명 표기만 확인, PC 공식 수치 못 찾음 |
| The Isle | The Isle: 서버마다 다름 |
| Escape from Tarkov | Tarkov: 파티 4명(대부분) vs 5명(1곳)으로 엇갈림 |
| [WoG] 창세기전 키우기: 무한 파밍 | 창세기전 키우기: 방치형, 멀티 정보 없음 |
| RuneScape: Dragonwilds 룬스케이프: 드래곤와일즈 | Dragonwilds: 플레이어 호스트 4명 / 전용 서버 6명으로 엇갈림 |
| Sid Meier's Civilization® V | Civilization V: 멀티 인원 확인 못 함 |
| No Man's Sky | No Man's Sky: IGDB 후보 32이나 공식 근거 못 찾음 (협동 4명으로 알려짐) |
| Russian Fishing 4 | Russian Fishing 4: 확인 못 함 |
| IdleOn - 더 아이들 MMO | IdleOn: MMO(방치형) 파티 인원 확인 못 함 |
| 아세토 코르사 Assetto Corsa | Assetto Corsa: IGDB 후보 16, 서버는 24로 알려져 충돌 |
| Scam With Your Friends | Scam With Your Friends: 신작이라 자료 없음 |
| 알비온 온라인 | Albion Online: 파티 20명으로 알려져 있으나 확인 못 함 (MMO 기준 정해지면) |
| Europa Universalis V | EU V: 멀티 인원 확인 못 함 |
| 스타워즈: 은하계 레이서™ | 스타워즈 은하계 레이서: 신작이라 자료 없음 |
| Le Mans Ultimate | Le Mans Ultimate: 확인 못 함 |
| Victoria 3 | Victoria 3: 확인 못 함 |
| Guild Wars 2® | Guild Wars 2: 파티 5·분대 50 — MMO 기준 정해지면 |
| Active Matter | Active Matter: 확인 못 함 |
| Enlisted | Enlisted: 확인 못 함 |
| Supermarket Simulator | Supermarket Simulator: 상점 문구 "up to four friends"가 본인 포함 4인인지 5인인지 모호 |

## 후속 결정 (2026-10-20)

- MMORPG는 친구 파티 기준. 공식 근거를 찾은 것만 채우고 나머지는 보류
  - Guild Wars 2: 파티 최대 5명(Guild Wars 2 위키, 분대는 10/50명) → 1~5, party_max 5. 위키라 공식 문서는 아님
  - AION 2, 알비온 온라인: 파티 최대 인원의 공식 출처 없음 → 보류
  - World of Warcraft: 파티 5·레이드 40을 위키·포럼에서만 확인, Blizzard 공식 문서를 못 찾아 DB 1~40 유지
- ETS2·ATS: SCS 공식 블로그(1.41 릴리스) "Convoy ... up to 8 players" → 둘 다 1~8. 기존 ATS 1~4는 근거 기록이 없었음. 8명 초과는 모든 참가자가 설정을 바꿔야 해서 제외
- 결정 파일: `data/verification/round11b-mmo-scs.json` (반영 지시 대기)

## 오버워치 중복

- DB에 `Overwatch 2`(배틀넷, 2026-09-26 등록)와 `오버워치™`(스팀 2357570, 2026-10-17 등록)가 따로 있음. 같은 게임(Overwatch 2의 이름 변경)
- 선례(디아블로 IV)대로 배틀넷 행을 숨기고 스팀 행으로 연결(merged_into). 빈칸은 배틀넷 행 값으로 채우고, 스트리머 영상 5개·투표 9개는 스팀 행으로 옮김
