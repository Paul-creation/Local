# 메인 노출 제외 게임 (home_excluded)

`games.home_excluded = true`인 게임은 **이번주의 게임 선정 · 지금 뜨는 게임 · 메인 배너 · 추천 섹션**에서 빠진다.
검색 · 상세 · 비교에는 그대로 보인다.

- 처음 지정: 2026-10-04, `supabase/migrations/20261009100000_content_descriptors.sql`
- 근거 자료: 스팀 content descriptors(`games.content_descriptor_ids`), 스팀 유저 태그(`data/tags/game-steam-tags.json`, 2026-10-04 수집)

## 기준

성적 표현이 게임의 핵심이거나 가장 앞에 드러나는 게임. 아래 중 하나에 해당하면 제외한다.

1. 스팀 content descriptor 1·3·4(노출·성적인 콘텐츠)가 있고, 게임 내용 자체가 성인물·팬서비스 중심
2. 스팀 유저 태그 "Hentai"가 50표 이상이고 성적 내용이 핵심인 게임

스팀 descriptor가 붙어 있어도 일반 AAA·인디 게임에 장면 일부로 들어간 경우(위쳐 3, 사이버펑크 2077, 발더스 게이트 3 등)는 제외하지 않는다.
상세 페이지에는 descriptor가 있는 모든 게임에 스팀 표기 기준 안내가 나온다.

## 제외 목록 (19개)

| 게임 | 스팀 descriptor | 스팀 유저 태그 (표 수) | 이유 |
|---|---|---|---|
| 하숙생이 전부 미녀입니다만? 시즌2 | 1, 5 | — | 부분 노출·성적 콘텐츠가 핵심 |
| DEAD OR ALIVE Xtreme Venus Vacation | 1, 5 | Sexual Content 8047, Hentai 3715 | 팬서비스 중심 |
| Genital Jousting | 1, 5 | Sexual Content 290, Nudity 193 | 성기가 게임 소재 |
| DRAMAtical Murder | 1, 2, 5 | Sexual Content 680, Nudity 314 | 성행위·성폭력 표현 |
| 사야의 노래 | 1, 2, 5 | Sexual Content 310, Hentai 74 | 성적 표현이 있는 호러 비주얼노벨 |
| Winter Memories | 1, 5 | Sexual Content 1709, Hentai 1208 | 미소녀물, 노출 |
| Summer Pockets REFLECTION BLUE | 1, 5 | Sexual Content 28 | 미소녀물, 가벼운 노출 |
| ATLYSS | 1, 5 | Sexual Content 500 | 선정적 의상·캐릭터 디자인 |
| Succubus Affection | 5 | Sexual Content 364, Hentai 235 | 서큐버스 연애물 |
| Succumate | 5 | Sexual Content 282, Hentai 205 | 서큐버스 연애물 |
| 너의 아내 | — | Sexual Content 269, Hentai 214 | 성인 비주얼노벨 |
| Scars of Summer | 5 | Sexual Content 289, Hentai 179 | 성인 비주얼노벨 |
| BLACK SOULS | 5 | Sexual Content 840, Hentai 463 | 성적 표현이 많은 RPG |
| BLACK SOULS II | — | Sexual Content 407 | BLACK SOULS 후속작 |
| 당신과 그녀와 그녀의 사랑 | 5 | Sexual Content 222, Hentai 131 | 성적 표현이 있는 비주얼노벨 |
| 두 사람의 여름의 소리 | — | Sexual Content 167, Hentai 95 | 성인 비주얼노벨 |
| Demons Roots | 5 | Sexual Content 79, Hentai 58 | 성적 표현이 있는 RPG |
| Pronoun Palace | 1, 5 | Sexual Content 11 | 노골적인 글 묘사 |
| Sultan's Game | 1, 5 | — | 글로 묘사되는 성적 선택지가 핵심 |

## 검토했지만 제외하지 않은 게임

| 게임 | 이유 |
|---|---|
| Fate/stay night REMASTERED | 원작은 성인물이지만 리마스터는 전연령판 (Hentai 88표는 원작 영향) |
| Wuthering Waves | Hentai 402표지만 주류 액션 RPG |
| Scarlet Skips | Hentai 33표 — 기준(50표) 미만 |
| Princess Maker 2 Refine | descriptor 1 — 육성 시뮬, 노출은 일부 |
| Breathedge 2 | descriptor 1 — 성인 코미디 소재가 일부 |
| Catherine Classic | descriptor 1 — 주제는 성인 연애지만 퍼즐 게임 |

## 바꾸는 방법

Supabase SQL Editor에서 `update public.games set home_excluded = true where id = '...';` (해제는 `false`) 후 이 문서 표에 추가.
