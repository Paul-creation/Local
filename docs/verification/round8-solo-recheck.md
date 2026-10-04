# 8차: 인기 상위 1인용 중 멀티 흔적 7개 재확인

- 날짜: 2026-10-04
- 계기: `scripts/security-check.mjs`가 인기 상위 200개 중 1인용(max_players=1)인데 멀티 흔적(활동·태그·멀티 칸)이 있는 게임 7개를 경고
- 기준: 현재 스팀판 공식 상점 페이지 (`docs/verification-rules.md`)
- 결정 파일: `data/verification/round8-solo-recheck.json`

## 결론

7개 모두 현재 스팀판에 멀티플레이 없음 → 인원 1 유지 (인원 수정 없음).
잘못 들어간 멀티 활동만 제거했다. 태그에는 잘못된 멀티 표현이 없었다.

| 게임 | 스팀 근거 | 인원 | 제거한 활동 |
|---|---|---|---|
| Grand Theft Auto IV: Complete Edition | 상점 공지: Complete Edition 업데이트로 Multiplayer mode·Games for Windows Live·Leaderboards 제공 중단 (분류 칸 Multi-player는 옛 표시) — [링크](https://store.steampowered.com/app/12210/) | 1 유지 | 멀티플레이 모드 |
| Assassin's Creed® Brotherhood | 상점 공지: "Multiplayer and online features are no longer available for this product" — [링크](https://store.steampowered.com/app/48190/) | 1 유지 | 협력 미션, 경쟁 멀티, 암살 대전 |
| Heavy Rain | 분류 Single-player만 — [링크](https://store.steampowered.com/app/960910/) | 1 유지 | 없음 (활동 비어 있음) |
| Kingdom Rush - Tower Defense | 분류 Single-player만 — [링크](https://store.steampowered.com/app/246420/) | 1 유지 | 협력 플레이 |
| Crysis 3 Remastered | 분류 Single-player만 (리마스터는 멀티 미포함) — [링크](https://store.steampowered.com/app/2096610/) | 1 유지 | 멀티플레이 대전, 협력 플레이 |
| Into the Dead: Our Darkest Days | 분류 Single-player만 — [링크](https://store.steampowered.com/app/2239710/) | 1 유지 | 협력 생존 |
| Crysis Remastered | 분류 Single-player만 (리마스터는 멀티 미포함) — [링크](https://store.steampowered.com/app/1715130/) | 1 유지 | 멀티플레이, 협력 플레이 |

## 참고

- Heavy Rain은 태그 "멀티 엔딩"(결말이 여러 개) 때문에 경고에 걸렸다. 정상 태그라 그대로 두고, security-check의 멀티 판별식이 "멀티 엔딩"을 멀티플레이로 보지 않게 고쳤다.
