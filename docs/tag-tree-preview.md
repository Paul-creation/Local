# 태그 나무 미리보기

`data/tags/tree.json`(2차안, 2026-10-04 — 검토 반영)을 사람이 보기 좋게 옮긴 것. 검토 의견을 반영해 `tree.json`을 고치면 이 문서도 같이 다시 만든다.

- 괄호 숫자: 그 칸(하위 포함)에 해당하는 우리 게임 수 / 스팀 태그가 아닌 묶음 칸은 **굵게**
- ~~취소선~~: 우리 게임 663개에 한 번도 안 쓰여 화면에서 숨길 칸 (`hidden_empty`)
- `← 합침:` 같은 뜻이라 이 칸으로 합친 스팀 태그 / `(스팀: …)` 스팀 한국어 이름을 다듬은 경우 원래 이름
- 원칙: 최대 4단계, 어느 칸이든 바로 아래 자식은 10개 이하 (아코디언에서 한 번에 너무 많이 펼쳐지지 않게)

## 요약

| 최상위 | 게임 수 | 바로 아래 칸 |
|---|---|---|
| 장르 | 634 | 액션, 슈팅, RPG, 전략, 시뮬레이션, 어드벤처, 퍼즐, 호러, 스포츠, 캐주얼 |
| 플레이 방식 | 615 | 세계 구조, 생존·제작, 진행 방식, 스토리 중심, 전투·조작, 자유도·창작 |
| 세계관·배경 | 370 | 판타지, SF, 디스토피아, 포스트아포칼립스, 역사, 현대, 장소 |
| 소재 | 266 | 괴물·초자연, 인물, 동물, 기계·탈것, 전쟁·군사, 범죄·첩보, 마법·신화, 과학·기술, 게임 소재 |
| 분위기 | 372 | 힐링, 귀여운, 코미디, 어두운, 긴장감, 감성적, 심리적, 초현실, 추억 소환 |
| 시점·그래픽 | 592 | 시점, 2D·3D, 그래픽 스타일, 시네마틱, VR |
| 이용 연령·표현 | 225 | 가족 친화, 선정성, 폭력, 고어·유혈 |

- 전체 노드 393개 (스팀 태그 359개 + 묶음 칸 34개), 최대 4단계, 자식 최대 10개
- 합친 태그 28개, 제외한 태그 59개 → 스팀 태그 446개 모두 나무·합치기·제외 중 한 곳에 들어감
- 화면에서 숨길 0개짜리 칸 36개
- 진입장벽: 낮음 180 · 보통 251 · 높음 108 · 판단 보류(null) 124

## 나무

### 장르 (634)

- 액션 (430) · Action
  - 핵앤슬래시 (56) · Hack and Slash (스팀: 핵 앤 슬래시)
  - 액션 어드벤처 (111) · Action-Adventure
  - 격투 (21) · Fighting
    - 2D 격투 (11) · 2D Fighter
    - 3D 격투 (8) · 3D Fighter
  - 벨트스크롤 액션 (20) · Beat 'em up (스팀: 비뎀업)
    - 무쌍 (4) · Musou
  - 캐릭터 액션 (16) · Character Action Game (스팀: 캐릭터 액션 게임)
    - 스펙터클 액션 (14) · Spectacle fighter (스팀: 스펙터클 파이터)
  - 플랫포머 (75) · Platformer (스팀: 플랫폼)
    - 2D 플랫포머 (17) · 2D Platformer (스팀: 2D 플랫폼)
    - 3D 플랫포머 (21) · 3D Platformer (스팀: 3D 플랫폼)
    - 정밀 플랫포머 (8) · Precision Platformer (스팀: 정밀 플랫폼)
    - 퍼즐 플랫포머 (18) · Puzzle Platformer (스팀: 퍼즐 플랫폼)
    - 수집형 플랫포머 (12) · Collectathon (스팀: 컬렉터톤)
    - 러너 (1) · Runner
  - 메트로배니아 (13) · Metroidvania
  - 소울라이크 (48) · Souls-like
    - 보스 러시 (2) · Boss Rush
  - 액션 로그라이크 (34) · Action Roguelike
  - 아케이드 (44) · Arcade
    - 스코어 어택 (11) · Score Attack
    - 핀볼 (1) · Pinball
    - ~~타임 어택 (0) · Time Attack (스팀: 시간 공격)~~
- 슈팅 (153) · Shooter
  - FPS (93) (스팀: 1인칭 슈팅)
    - 부머 슈터 (4) · Boomer Shooter (스팀: 부머 슈팅)
    - 아레나 슈터 (6) · Arena Shooter (스팀: 아레나 슈팅)
    - 히어로 슈터 (11) · Hero Shooter (스팀: 히어로 슈팅)
  - 3인칭 슈터 (41) · Third-Person Shooter (스팀: 3인칭 슈팅)
  - 탑다운 슈터 (9) · Top-Down Shooter (스팀: 탑다운 슈팅)
    - 트윈스틱 슈터 (3) · Twin Stick Shooter (스팀: 트윈 스틱 슈팅)
  - 슛뎀업 (19) · Shoot 'Em Up
    - 탄막 (14) · Bullet Hell (스팀: 탄막 지옥)
    - 탄막 천국(뱀서류) (7) · Bullet Heaven (스팀: 탄막 천국)
  - ~~레일 슈터 (0) · Rail Shooter (스팀: Rail Shooter) ← 합침: On-Rails Shooter~~
  - 루터 슈터 (15) · Looter Shooter (스팀: 약탈 슈팅)
  - 익스트랙션 슈터 (10) · Extraction Shooter
  - 배틀로얄 (10) · Battle Royale (스팀: 배틀 로얄)
  - 저격 (3) · Sniper (스팀: 저격수)
- RPG (227)
  - 액션 RPG (87) · Action RPG
  - JRPG (58)
  - CRPG (8)
  - 파티 기반 RPG (27) · Party-Based RPG
  - 전략·전술 RPG (21) · Strategy RPG (스팀: 전략 RPG) ← 합침: Tactical RPG
  - MMORPG (12)
  - 던전 탐험 (21) · Dungeon Crawler (스팀: 던전 크롤러)
    - 미스터리 던전 (1) · Mystery Dungeon
  - 크리처 수집 (8) · Creature Collector (스팀: 생명체 수집)
- 전략 (195) · Strategy
  - 실시간 전략 (23) · RTS
    - 액션 RTS (3) · Action RTS
  - 턴제 전략 (44) · Turn-Based Strategy
    - 4X (11)
  - 대전략 (22) · Grand Strategy
  - 전술 (82) · Tactical
    - 턴제 전술 (23) · Turn-Based Tactics
    - 실시간 전술 (13) · Real Time Tactics
  - 타워 디펜스 (9) · Tower Defense
  - 오토 배틀러 (5) · Auto Battler
  - MOBA (6)
  - 워게임 (19) · Wargame (스팀: 전쟁 게임)
  - 카드 게임 (24) · Card Game
    - 덱빌딩 (16) · Deckbuilding
    - 로그라이크 덱빌딩 (8) · Roguelike Deckbuilder
    - 카드 배틀러 (10) · Card Battler (스팀: 카드 배틀)
    - TCG (5) · Trading Card Game (스팀: 트레이딩 카드 게임)
    - 솔리테어 (1) · Solitaire
    - ~~포커 (0) · Poker~~
- 시뮬레이션 (247) · Simulation
  - 경영 (71) · Management
    - 가게 운영 (4) · Shop Keeper
    - 동물원 경영 (1) · Zoo (스팀: 동물원)
    - 도시 건설 (24) · City Builder
    - 군락 시뮬레이션 (12) · Colony Sim (스팀: 개척 시뮬레이션)
  - 생활 시뮬레이션 (74) · Life Sim
    - 농장 시뮬레이션 (15) · Farming Sim ← 합침: Farming, Agriculture
    - 연애 시뮬레이션 (26) · Dating Sim
    - 오토메 (2) · Otome
    - 직업 시뮬레이션 (9) · Job Simulator
    - ~~취미 시뮬레이션 (0) · Hobby Sim~~
    - 요리 (12) · Cooking
    - 청소 (5) · Cleaning
    - 정리 (4) · Organizing
    - 꾸미기 (3) · Decorating (스팀: 장식)
  - **탈것 시뮬레이션** (41) · Vehicle Sim
    - 운전 (21) · Driving
    - 자동차 시뮬레이션 (20) · Automobile Sim
    - 비행 (5) · Flight (스팀: 제트) ← 합침: Combat Flight Simulator, Jet
    - 우주 시뮬레이션 (1) · Space Sim
    - 기차 (6) · Trains
    - 교통·운송 (10) · Transportation (스팀: 교통 수단)
    - 항해 (4) · Sailing
  - 정치 시뮬레이션 (4) · Political Sim
  - 갓 게임 (3) · God Game (스팀: 신 게임)
  - ~~의학 시뮬레이션 (0) · Medical Sim~~
  - 전염병 시뮬레이션 (1) · Outbreak Sim (스팀: 아웃브레이크 시뮬레이션)
  - 사냥 (5) · Hunting
  - 낚시 (11) · Fishing
- 어드벤처 (387) · Adventure
  - 비주얼 노벨 (51) · Visual Novel
  - 포인트 앤 클릭 (42) · Point & Click (스팀: 포인트 앤드 클릭)
    - 숨은 그림 찾기 (9) · Hidden Object (스팀: 숨은 그림 및 물체)
    - 방 탈출 (11) · Escape Room
  - 인터랙티브 픽션 (34) · Interactive Fiction (스팀: 쌍방향 소설)
    - 텍스트 기반 (7) · Text-Based
    - 선택형 어드벤처 (23) · Choose Your Own Adventure (스팀: 자신이 선택하는 모험)
  - 걷기 시뮬레이션 (12) · Walking Simulator
  - 탐정·추리 (45) · Detective (스팀: 추리)
    - 수사 (27) · Investigation
  - 실사 영상(FMV) (6) · FMV (스팀: FMV)
- 퍼즐 (98) · Puzzle
  - 논리 (12) · Logic
  - 소코반 (1) · Sokoban (스팀: 창고지기)
  - ~~매치 3 (0) · Match 3~~
  - 블록 쌓기 (1) · Falling Blocks (스팀: 블록 낙하)
  - 단어 게임 (1) · Word Game (스팀: 낱말 게임)
    - 맞춤법 (1) · Spelling
  - ~~상식 퀴즈 (0) · Trivia~~
  - ~~레밍스류 (0) · Lemmings (스팀: 레밍)~~
- 호러 (157) · Horror (스팀: 공포)
  - 서바이벌 호러 (61) · Survival Horror (스팀: 생존 공포)
  - 심리 공포 (95) · Psychological Horror (스팀: 심리적 공포)
  - 점프 스케어 (3) · Jump Scare (스팀: 깜놀)
- 스포츠 (36) · Sports
  - **팀 구기 종목** (6) · Team Ball Sports
    - 축구 (3) · Football (Soccer)
    - 미식축구 (1) · Football (American)
    - 야구 (2) · Baseball
    - ~~농구 (0) · Basketball~~
    - 배구 (1) · Volleyball
    - ~~하키 (0) · Hockey~~
    - ~~럭비 (0) · Rugby~~
    - ~~크리켓 (0) · Cricket~~
  - **개인 종목** (2) · Individual Sports
    - ~~테니스 (0) · Tennis~~
    - 골프 (2) · Golf ← 합침: Mini Golf
    - ~~볼링 (0) · Bowling~~
    - ~~당구 (0) · Billiards ← 합침: Pool, Snooker~~
    - ~~활쏘기 (0) · Archery~~
    - ~~복싱 (0) · Boxing~~
    - ~~레슬링 (0) · Wrestling~~
  - **겨울·익스트림 스포츠** (1) · Winter & Extreme
    - 스키 (1) · Skiing
    - 스노보딩 (1) · Snowboarding
    - ~~스케이트보딩 (0) · Skateboarding~~
    - ~~스케이팅 (0) · Skating~~
    - ~~사이클링 (0) · Cycling~~
  - 레이싱 (25) · Racing
    - 전투 레이싱 (4) · Combat Racing
    - 오프로드 (1) · Offroad
    - ~~모터크로스 (0) · Motocross~~
    - ~~BMX (0)~~
    - ~~ATV (0)~~
    - ~~바이크 (0) · Bikes ← 합침: Motorbike~~
- 캐주얼 (202) · Casual
  - 파티 게임 (21) · Party Game ← 합침: Party
    - 미니게임 (5) · Minigames
    - 소셜 디덕션 (4) · Social Deduction
  - 인크리멘탈 (24) · Incremental
    - 방치형 (19) · Idler (스팀: 아이들러)
    - ~~클리커 (0) · Clicker (스팀: Clicker)~~
  - 타자 연습 (3) · Typing (스팀: 타자)
  - 리듬 (11) · Rhythm
    - 음악 (9) · Music
  - 테이블탑 (25) · Tabletop
    - 보드게임 (8) · Board Game
    - ~~체스 (0) · Chess~~
    - ~~주사위 (0) · Dice~~
    - 마작 (1) · Mahjong
    - 도박 (11) · Gambling

### 플레이 방식 (615)

- **세계 구조** (350) · World Structure
  - 오픈월드 (179) · Open World (스팀: 오픈 월드)
  - 샌드박스 (182) · Sandbox
    - 물리 엔진 (66) · Physics (스팀: 물리)
    - 파괴 (15) · Destruction
  - 탐험 (161) · Exploration
  - 절차적 생성 (37) · Procedural Generation
    - 음악 기반 절차적 생성 (2) · Music-Based Procedural Generation
- **생존·제작** (251) · Survival & Crafting
  - 생존 (114) · Survival
    - 오픈월드 생존 제작 (31) · Open World Survival Craft (스팀: 오픈 월드 생존 제작)
  - 크래프팅 (71) · Crafting
  - 건설 (109) · Building
    - 기지 건설 (63) · Base Building
    - 자동화 (18) · Automation
  - **자원·경제 관리** (125) · Resources & Economy
    - 자원 관리 (53) · Resource Management (스팀: 자원관리)
    - 경제 (38) · Economy
    - 무역·거래 (14) · Trading (스팀: 거래)
    - 채광 (6) · Mining (스팀: 마이닝)
    - 시간 관리 (14) · Time Management
    - 인벤토리 관리 (13) · Inventory Management
    - 외교 (9) · Diplomacy
    - 자본주의 (16) · Capitalism
    - 파밍(루팅) (27) · Loot (스팀: 약탈)
- **진행 방식** (135) · Progression
  - 로그라이크 (59) · Roguelike
    - 정통 로그라이크 (1) · Traditional Roguelike
    - 영구 죽음 (16) · Perma Death (스팀: 퍼마 데스)
  - 로그라이트 (50) · Roguelite
  - 짧은 플레이 (11) · Short (스팀: 단편)
  - 턴제 (52) · Turn-Based
    - 턴제 전투 (41) · Turn-Based Combat
  - 실시간 (9) · Real-Time
    - 실시간(일시정지 가능) (6) · Real-Time with Pause (스팀: 일시 정지 가능한 실시간)
  - 빠른 진행 (11) · Fast-Paced
  - 칸 단위 이동 (2) · Grid-Based Movement (스팀: 그리드 기반 움직임)
  - 헥스 그리드 (3) · Hex Grid (스팀: 육각형 그리드)
- 스토리 중심 (318) · Story Rich (스팀: 풍부한 스토리) ← 합침: Narrative
  - **선택과 전개** (114) · Choices & Structure
    - 선택이 중요한 (54) · Choices Matter (스팀: 선택의 중요성)
    - 멀티 엔딩 (58) · Multiple Endings (스팀: 복수 결말)
    - 비선형 (12) · Nonlinear
    - 일직선 진행 (18) · Linear (스팀: 선형)
  - **이야기 방식** (43) · Narration
    - 깊은 세계관 (31) · Lore-Rich
    - 대화 중심 (9) · Dialogue Heavy (스팀: 대화) ← 합침: Conversation
    - 다이내믹 내레이션 (4) · Dynamic Narration
    - 소설 원작 (1) · Based On A Novel (스팀: 소설 기반)
  - **주인공·관계** (110) · Protagonist & Relationships
    - 여성 주인공 (67) · Female Protagonist (스팀: 여주인공)
    - 말 없는 주인공 (5) · Silent Protagonist
    - 악당 주인공 (6) · Villain Protagonist
    - LGBTQ+ (36)
    - 로맨스 (16) · Romance
- **전투·조작** (252) · Combat & Controls
  - 전투 (126) · Combat
    - 검술 (14) · Swordplay (스팀: 칼싸움)
    - 무술 (16) · Martial Arts
    - 차량 전투 (12) · Vehicular Combat
    - 해상 전투 (5) · Naval Combat
    - 총기 커스터마이즈 (6) · Gun Customization (스팀: 총 커스터마이즈)
    - 불릿 타임 (5) · Bullet Time (스팀: 블렛타임)
    - 직업(클래스) 선택 (10) · Class-Based (스팀: 클래스 기반)
  - 잠입 (52) · Stealth
    - 암살 (5) · Assassins ← 합침: Assassin
  - 파쿠르 (19) · Parkour
  - 고난도 (90) · Difficult (스팀: 초고난도) ← 합침: Unforgiving
  - 퀵타임 이벤트 (4) · Quick-Time Events
  - 시간 조작 (3) · Time Manipulation
  - ~~의도적으로 불편한 조작 (0) · Intentionally Awkward Controls (스팀: 의도적으로 불편한 컨트롤)~~
- **자유도·창작** (182) · Freedom & Creation
  - 레벨 에디터 (14) · Level Editor
  - 모드 지원 (49) · Moddable (스팀: 모드 가능) ← 합침: Mod
  - 캐릭터 커스터마이징 (94) · Character Customization (스팀: 캐릭터 커스터마이즈)
  - 이머시브 심 (49) · Immersive Sim (스팀: 몰입형 시뮬레이션)
  - 코딩 (4) · Programming ← 합침: Coding
    - 해킹 (3) · Hacking

### 세계관·배경 (370)

- 판타지 (139) · Fantasy
  - 다크 판타지 (42) · Dark Fantasy
  - 무협 (2) · Wuxia
  - 선협 (1) · Xianxia
- SF (111) · Sci-fi (스팀: 공상과학)
  - 사이버펑크 (13) · Cyberpunk
  - 우주 (33) · Space
    - ~~화성 (0) · Mars~~
  - 미래 (17) · Futuristic (스팀: 미래적)
  - 스팀펑크 (3) · Steampunk
- 디스토피아 (13) · Dystopian (스팀: 반이상향)
- 포스트아포칼립스 (50) · Post-apocalyptic
- 역사 (81) · Historical
  - 중세 (29) · Medieval
  - 고대 로마 (2) · Rome (스팀: 로마)
  - 1차 세계대전 (2) · World War I (스팀: 제1차 세계 대전)
  - 2차 세계대전 (10) · World War II (스팀: 제2차 세계 대전)
  - 냉전 (4) · Cold War
  - 서부 (5) · Western (스팀: 웨스턴)
  - 대체 역사 (9) · Alternate History
- 현대 (41) · Modern
  - 1980년대 (9) · 1980s
  - 1990년대 (20) · 1990's
- **장소** (29) · Places
  - 수중 (8) · Underwater
  - 지하 (3) · Underground
  - 자연 (16) · Nature
  - 눈 (3) · Snow

### 소재 (266)

- **괴물·초자연** (85) · Monsters & Supernatural
  - 좀비 (26) · Zombies
  - 악마 (14) · Demons (스팀: 악령)
  - 뱀파이어 (6) · Vampires
  - ~~늑대 인간 (0) · Werewolves~~
  - 용 (13) · Dragons
  - 초자연 (8) · Supernatural
  - 러브크래프트(크툴루) (8) · Lovecraftian (스팀: 러브크래프트)
  - 외계인 (16) · Aliens
- **인물** (22) · Characters
  - 닌자 (9) · Ninja
  - 사무라이 (5) · Samurai
  - 해적 (5) · Pirates
  - ~~바이킹 (0) · Vikings~~
  - 슈퍼 히어로 (4) · Superhero
  - 드워프 (4) · Dwarves ← 합침: Dwarf
  - 엘프 (1) · Elves ← 합침: Elf
- 동물 (18) · Animals
  - 개 (2) · Dogs ← 합침: Dog
  - 고양이 (5) · Cats
  - 말 (5) · Horses
  - ~~새 (0) · Birds~~
  - ~~여우 (0) · Foxes ← 합침: Fox~~
  - ~~늑대 (0) · Wolves~~
  - 공룡 (3) · Dinosaurs
  - ~~카피바라 (0) · Capybaras~~
- **기계·탈것** (30) · Machines & Vehicles
  - 로봇 (14) · Robots
  - 메카 (9) · Mechs (스팀: 매크)
  - 탱크 (5) · Tanks
  - 우주선 (2) · Spaceships
  - 잠수함 (3) · Submarine
- **전쟁·군사** (56) · War & Military
  - 전쟁 (44) · War
  - 군사 (36) · Military
  - 해군 (5) · Naval
- **범죄·첩보** (35) · Crime & Espionage
  - 범죄 (26) · Crime
  - 강도 (6) · Heist
  - 첩보 활동 (1) · Espionage
  - 음모 (6) · Conspiracy
- **마법·신화** (39) · Magic & Myth
  - 마법 (28) · Magic
  - 신화 (11) · Mythology
  - 신념 (1) · Faith
- **과학·기술** (36) · Science & Tech
  - 과학 (8) · Science
  - 인공 지능 (21) · Artificial Intelligence
  - 트랜스휴머니즘 (1) · Transhumanism
  - 시간 여행 (7) · Time Travel
- 게임 소재 (4) · Gaming (스팀: 게이밍)

### 분위기 (372)

- 힐링 (66) · Relaxing (스팀: 릴랙싱)
  - 아늑함 (24) · Cozy
  - 건전함 (5) · Wholesome
- 귀여운 (123) · Cute
- 코미디 (170) · Comedy ← 합침: Funny
  - 블랙 유머 (22) · Dark Humor ← 합침: Dark Comedy
  - 패러디 (3) · Parody
  - 풍자 (2) · Satire
  - 밈 (21) · Memes
- 어두운 (90) · Dark
  - 고딕 (7) · Gothic
  - 누아르 (5) · Noir
- **긴장감** (64) · Tension
  - 스릴러 (17) · Thriller
  - 미스터리 (58) · Mystery
- 감성적 (39) · Emotional
- 심리적 (20) · Psychological
  - 철학적 (2) · Philosophical
- 초현실 (24) · Surreal
  - 사이키델릭 (3) · Psychedelic
  - 실험적 (6) · Experimental
- 추억 소환 (9) · Nostalgia

### 시점·그래픽 (592)

- **시점** (368) · Camera
  - 1인칭 (178) · First-Person
  - 3인칭 (141) · Third Person
  - 탑다운 (33) · Top-Down
  - 아이소메트릭 (31) · Isometric
  - 횡스크롤 (19) · Side Scroller
- **2D·3D** (304) · Dimensions
  - 2D (148)
  - 2.5D (17)
  - 3D (156)
- **그래픽 스타일** (392) · Art Style
  - **그림체** (250) · Drawing Style
    - 픽셀 그래픽 (90) · Pixel Graphics
    - 복셀 (5) · Voxel
    - 애니메이션풍 (113) · Anime (스팀: 애니메이션)
    - 카툰풍 (43) · Cartoony (스팀: 만화 같은) ← 합침: Cartoon
    - 만화책 (9) · Comic Book
    - 손으로 그린 (25) · Hand-drawn
    - 레트로 (42) · Retro (스팀: 복고풍)
    - 올드 스쿨 (12) · Old School
  - **색·표현** (215) · Look & Color
    - 양식화된 (43) · Stylized
    - 다채로운 (83) · Colorful
    - 미니멀리스트 (11) · Minimalist
    - 사실적 (106) · Realistic (스팀: 현실적)
    - 추상적 (2) · Abstract
- 시네마틱 (41) · Cinematic
- VR (36) ← 합침: 6DOF

### 이용 연령·표현 (225)

- 가족 친화 (56) · Family Friendly (스팀: 전체 이용가) ← 합침: Kids
- 선정성 (83) · Sexual Content (스팀: 선정적 콘텐츠) ← 합침: Sexual Themes
  - 신체 노출 (42) · Nudity
  - 헨타이 (18) · Hentai
- 폭력 (89) · Violent
- 고어·유혈 (89) · Gore (스팀: 유혈) ← 합침: Blood

## 제외한 태그 (59개)

- **인원·협동·대전·멀티 (플래그·인원 슬라이더가 담당)** (17): 협동(218), 온라인 협동(160), 로컬 협동(47), 멀티플레이어(314), PvP(97), PvE(75), 로컬 멀티플레이어(41), 4인 로컬 플레이(16), 협동 캠페인(16), 분할 화면(13), 비동기 멀티플레이어(2), MMO(35), 싱글 플레이어(499), 팀 기반(30), 경쟁(22), e스포츠(16), 비대칭 VR(1)
- **판매·출시 정보** (7): 무료 플레이(59), 앞서 해보기(101), 인디(216), 속편(3), 리메이크(16), 리부트(0), 에피소드(3)
- **게임이 아닌 프로그램·소프트웨어 분류** (16): 디자인 및 일러스트레이션(3), 유틸리티(4), 동영상 제작(1), 사진 편집(0), 애니메이션 및 모델링(0), 오디오 제작(0), 소프트웨어 교육(0), 소프트웨어(1), 게임 개발(2), 하드웨어(2), 360 동영상(0), 벤치마크(0), 교육(5), 언어 학습(1), 데스크톱 컴패니언(3), 튜토리얼(3)
- **기기·입력 방식** (5): 컨트롤러(73), TrackIR(2), 마우스 전용(5), 터치 친화적(2), 보이스 컨트롤(1)
- **평가성 태그 (게임 성격을 나타내지 않음)** (10): 웅장한 사운드트랙(138), 사운드트랙(10), 아름다운(13), 중독성(6), 리플레이 가치(46), 서사(6), 클래식(28), 몰입형(6), 컬트(3), 분위기 있는(249)
- **음악 스타일 (사운드트랙 특징)** (4): 전자 음악(1), 락 음악(0), 인스트루멘탈 음악(0), 8비트 음악(0)

## 합친 태그 (28개)

- Dog (Dog) → 개
- Unforgiving (Unforgiving) → 고난도
- Funny (유머) → 코미디
- Kids (Kids) → 가족 친화
- Assassin (Assassin) → 암살
- Farming (파밍) → 농장 시뮬레이션
- Cartoon (만화) → 카툰풍
- 6DOF (6DOF) → VR
- Blood (Blood) → 고어·유혈
- Mod (모드) → 모드 지원
- Party (파티) → 파티 게임
- Narrative (내러티브) → 스토리 중심
- Dwarf (Dwarf) → 드워프
- Conversation (Conversation) → 대화 중심
- Pool (Pool) → 당구
- Dark Comedy (블랙 코미디) → 블랙 유머
- Tactical RPG (전술 RPG) → 전략·전술 RPG
- Agriculture (농업) → 농장 시뮬레이션
- Mini Golf (미니 골프) → 골프
- Fox (Fox) → 여우
- Combat Flight Simulator (Combat Flight Simulator) → 비행
- Sexual Themes (Sexual Themes) → 선정성
- Coding (Coding) → 코딩
- On-Rails Shooter (레일 슈팅) → 레일 슈터
- Jet (Jet) → 비행
- Elf (Elf) → 엘프
- Motorbike (오토바이) → 바이크
- Snooker (Snooker) → 당구

## 설계 메모

- 최상위 7개: 요청 예시 5개(장르·플레이 방식·세계관·배경·분위기·시점·그래픽) + **소재**(시대·장소가 아닌 등장 요소) + **이용 연령·표현**(빼고 보기 용도).
- 오픈월드는 플레이 방식 › 세계 구조 아래. 오픈월드 생존 제작은 생존 아래.
- 4단계 제한 때문에 묶음을 하나 끼우면 손자 칸을 형제로 올림: 물리 엔진›파괴 → 샌드박스 아래 형제, 선택이 중요한›멀티 엔딩 → 형제, 연애 시뮬레이션›오토메 → 형제, 레트로›올드 스쿨 → 형제.
- MMORPG는 RPG 아래 장르로 남기고, 멀티 관련인 MMO(Massively Multiplayer)는 제외. VR은 즐기는 방식이 달라 시점·그래픽에 남김.
- 분위기 있는(Atmospheric)은 평가성 태그로 보고 제외.
