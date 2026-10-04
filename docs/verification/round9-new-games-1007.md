# 9차: 필수 게임 57개(10/04 추가분) 인원 검증

- 날짜: 2026-10-04
- 대상: `data/meta/new-games-1007.json` (must-have 목록으로 추가한 57개)
- 기준: `docs/verification-rules.md` — 친구끼리 한 판 최대 인원, 모드 제외, 서버형은 기본 설정. AI API 안 씀
- 근거: 스팀 상점(영어) 분류·설명, 필요한 게임만 공식 공지·소스 코드·커뮤니티 확인
- 결정 파일: `data/verification/round9-new-games-1007.json`

## 결론

- 인원 바뀜 21개, 혼자 플레이(solo_playable)만 고침 7개, 그대로 29개
- 보강 단계(enrich-fallback·igdb·specs)가 넣은 값 중 최대 인원이 비었거나(null) 틀린 것을 고쳤다
- 상점 분류에 Single-player가 있는데 solo_playable이 false로 들어간 멀티 게임도 true로 고쳤다

### 인원 바뀜

| 게임 | 전 | 후 | 근거 |
|---|---|---|---|
| Barotrauma | 1~16 | 1~8 | 서버형 기본 설정: 게임 안 "서버 열기" 기본 최대 8 (상한 16은 설정 변경 필요) — Barotrauma 소스 `MainMenuScreen.cs` maxplayers 기본값 8, `NetConfig.MaxPlayers` 16 |
| Chained Together | 1~? | 1~4 | 상점: 1-4 player |
| Cuphead | 1~? | 1~2 | 상점: single player or local co-op |
| Devil May Cry 5 | 1~? | 1~1 | 상점 분류에 Online Co-op이 있지만 카메오 시스템(무작위 매칭)이라 친구와 같은 판을 만들 공식 방법 없음. 3인 실시간 협동은 모드 — [Shacknews](https://www.shacknews.com/article/110323/is-there-co-op-multiplayer-in-devil-may-cry-5) |
| Gang Beasts | ?~? | 2~8 | 온라인 최대 8명, 상점 분류에 Single-player 없음 |
| Grounded | 1~? | 1~4 | 상점: up to three friends |
| Lovers in a Dangerous Spacetime | 1~? | 1~4 | 상점: 1- to 4-player couch co-op |
| METAL GEAR SOLID Δ: SNAKE EATER | 1~? | 1~12 | 무료 업데이트 FOX HUNT: 한 판 12명(2인 6팀), 비공개 매치로 친구끼리 가능 — [KONAMI](https://www.konami.com/games/eu/en/topics/18871/) |
| Moving Out | 1~? | 1~4 | 상점: Up to four players |
| Overcooked! 2 | 1~? | 1~4 | 상점: up to four players |
| Party Animals | 1~? | 1~8 | 한 판 최대 8명 (한 기기 4명 + 온라인) |
| Pizza Tower | 1~? | 1~2 | 공식 Swap Mode(노이즈 업데이트) 로컬 2인, 온라인 없음 — [위키](https://pizzatower.wiki/Swap_Mode) |
| Portal 2 | 1~? | 1~2 | 상점: two-player cooperative mode |
| REMNANT II® | 1~? | 1~3 | 상점: co-op with two other friends |
| Sea of Stars: Sunset Edition | 1~? | 1~3 | 상점: playable in its entirety by up to three players (로컬만) |
| Sea of Thieves: 2026 Edition | ?~? | 1~4 | 한 배(갤리온) 최대 4명, 슬루프로 혼자 가능 |
| 보더랜드 3 | 1~? | 1~4 | 온라인 협동 4명 |
| 얼티밋 치킨 호스 | ?~? | 2~4 | 상점: up to 4 players, 주요 모드는 멀티 전용 |
| 플레이트업! | 1~? | 1~4 | 상점: Up to four players |
| It Takes Two | 1~2 | 2~2 | 상점: built purely for two |
| Stick Fight: The Game | 1~4 | 2~4 | 상점: 2 to 4 PLAYERS (NO SINGLE PLAYER MODE) |

### 혼자 플레이만 고침 (인원은 이미 맞음)

Golf With Your Friends(1~12), 인슈라오디드(1~16, 기본 16), Deep Rock Galactic(1~4), DEVOUR(1~4), Overcooked! All You Can Eat(1~4), Unrailed!(1~4), Warhammer: Vermintide 2(1~4)

### 그대로 (29개)

- 1인용 28개: Balatro, BIOHAZARD 7, BIOHAZARD RE:2, Celeste, DEATH STRANDING DC, Disco Elysium, FF7 REBIRTH, FF7 REMAKE INTERGRADE, FFXVI, Hades, Hades II, HITMAN World of Assassination, Hollow Knight, Hollow Knight: Silksong, Horizon Zero Dawn 리마스터, NieR:Automata, Ori and the Blind Forest DE, Outer Wilds, Shadow of the Tomb Raider DE, SILENT HILL 2, UNCHARTED 레거시 오브 시브즈, 귀무자, 메타포: 리판타지오, 스타워즈 제다이: 서바이버, 어쌔신 크리드 섀도우스, 용과 같이8, 인디아나 존스: 그레이트 서클, 페르시아의 왕자: 잃어버린 왕관
- 멀티 1개: Warhammer 40,000: Darktide(1~4)

## 참고 (판단이 갈릴 수 있는 것)

- **Shadow of the Tomb Raider DE**: 포함된 DLC "The Forge" 도전 무덤 1개만 온라인 2인 협동. 상점 분류는 Single-player뿐이고 본편 기본 모드가 1인이라 1 유지
- **HITMAN World of Assassination**: Sniper Assassin 협동·Ghost Mode는 서비스 종료(2020)되어 현재 1인
- **Warhammer 40,000: Darktide**: 상점 분류에 Single-player가 없어 solo_playable은 건드리지 않음 (혼자 하기 기능 여부는 다음 점검 때 확인)
