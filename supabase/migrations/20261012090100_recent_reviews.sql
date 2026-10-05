-- 스팀 최근 평가(지난 30일) 칸 + 서버 방식 정리 (한 파일로 모음)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (행·가격 기록은 지우지 않음)
-- 1~2만 이미 실행했어도 파일 전체를 다시 실행하면 됨

-- 1) 스팀 최근 평가 (scripts/enrich-recent-reviews.mjs, 매일 갱신)
--    한국 상점 페이지 "최근 평가" 줄 그대로: 지난 30일, 모든 언어
--    스팀이 최근 평가를 안 보여주면(30일 리뷰 10개 미만) pct·count·label은 null, recent_reviews_at만 기록
--    표시 규칙은 docs/recent-reviews.md
alter table public.games add column if not exists recent_review_pct smallint;
alter table public.games add column if not exists recent_review_count integer;
alter table public.games add column if not exists recent_review_label text;
alter table public.games add column if not exists recent_reviews_at timestamptz;

-- 2) 서버 방식: 스팀 공식 분류에 Online Co-op 또는 Online PvP가 있는데 '오프라인 전용'으로 들어간 게임 20개
--    → '온라인 + 오프라인' (fill-game-details.mjs의 Haiku 판단 오류, 아직 '오프라인 전용'인 행만 바꿈)
update public.games
set server_type = '온라인 + 오프라인'
where server_type = '오프라인 전용'
  and steam_appid in (
    '1086940',  -- Baldur's Gate 3 (Online Co-op)
    '1527950',  -- Wartales (Online Co-op)
    '2273430',  -- BlazBlue Entropy Effect (Online Co-op)
    '601150',   -- Devil May Cry 5 (Online Co-op)
    '936720',   -- Wrench (Online Co-op)
    '1794680',  -- Vampire Survivors (Online Co-op)
    '270880',   -- American Truck Simulator (Online Co-op)
    '2186680',  -- Warhammer 40,000: Rogue Trader (Online Co-op)
    '3263320',  -- Carry The Glass (Online Co-op)
    '2280',     -- DOOM + DOOM II (Online Co-op, Online PvP)
    '1637320',  -- Dome Keeper (Online Co-op, Online PvP)
    '2215430',  -- Ghost of Tsushima (Online Co-op, Online PvP)
    '637650',   -- FINAL FANTASY XV (Online Co-op, Online PvP)
    '1158310',  -- Crusader Kings III (Online PvP)
    '289070',   -- Civilization VI (Online PvP)
    '2835570',  -- Buckshot Roulette (Online PvP)
    '415600',   -- Kart Racing Pro (Online PvP)
    '261550',   -- Mount & Blade II: Bannerlord (Online PvP)
    '94400',    -- Nidhogg (Online PvP)
    '1342330'   -- Mad Games Tycoon 2 (Online PvP)
  );

-- 3) 서버 값을 두 칸으로 나눔
--    server_type: 인터넷 필요 여부 → '상시 온라인' / '온라인 + 오프라인' / '오프라인 전용'
--    multiplayer_host: 멀티 호스팅 방식 → '전용 서버' / 'P2P' / null (멀티 없거나 모름)
alter table public.games add column if not exists multiplayer_host text;

-- 3-1) 지금 '전용 서버'·'P2P'인 값을 multiplayer_host로 옮김
--      ANOTHER EDEN·젠레스 존 제로는 온라인 멀티가 없어서 옮기지 않음 ('전용 서버'는 게임 서버 뜻)
update public.games
set multiplayer_host = server_type
where server_type in ('전용 서버', 'P2P') and multiplayer_host is null
  and id not in (
    'eafd0fba-33b7-4a2d-a200-735adda5b86f',  -- ANOTHER EDEN
    '04ee3be2-2051-475f-91f0-566918fd73d0'   -- 젠레스 존 제로
  );

-- 3-2) 그 게임들의 server_type을 세 값 중 하나로 다시 판단 (스팀 분류·싱글 가능 여부·알려진 접속 방식)
--      애매한 12개는 null (보고 목록)
-- server_type → '상시 온라인'
update public.games set server_type = '상시 온라인' where server_type in ('전용 서버', 'P2P') and id in (
  'bba4cd29-aca7-480c-a4cb-a9cb9fe933b5',  -- 2XKO (전용 서버)
  '0c5fcb7f-edc8-4406-87b1-38dc4ccedf7a',  -- Among Us 3D (P2P)
  'eafd0fba-33b7-4a2d-a200-735adda5b86f',  -- ANOTHER EDEN (전용 서버)
  'a69d2df5-0475-4b57-9457-7efb7b454dc1',  -- Apex 레전드™ (전용 서버)
  'efac2013-433e-461e-9beb-fbab259671e4',  -- ARC Raiders (전용 서버)
  'f0494f37-c6a6-4be8-a3e5-ec303da62bc4',  -- Arena Breakout: Infinite (전용 서버)
  '43b6865e-f5cb-4f74-abc9-450b0894e941',  -- Battlefield™ 2042 (전용 서버)
  'fe7ab058-f4b6-4356-9c66-2dd3ca4f0159',  -- Black Squad (전용 서버)
  '60539b14-2bb5-461b-a444-1d464c87447a',  -- Blood Strike (전용 서버)
  '12dad2cb-5c8c-4f62-9c56-869aa7b33d71',  -- Chained in the Backrooms (P2P)
  '7cd2a357-86af-46eb-81cc-096fd40f165f',  -- DayZ (전용 서버)
  '4228c5f5-38e7-4c6c-b891-b7f12f2733be',  -- DEAD OR ALIVE Xtreme Venus Vacation (전용 서버)
  '9cad6a34-3e5c-4c8e-99ef-f33c5f546201',  -- eFootball™ (전용 서버)
  '0178a517-2450-44f2-bb42-e68d7380d5d1',  -- Evitania Online - Idle RPG (전용 서버)
  '245a5214-9af9-4488-801e-b8ae52441325',  -- Fallout 76 (전용 서버)
  '1ff764ab-076a-4780-99bb-74b553be0227',  -- Fortnite (전용 서버)
  'f1f6643a-55fb-4fff-9163-c0473635f7c6',  -- Goose Goose Duck (전용 서버)
  'fa4579ae-d199-43e8-9414-9cba447644f9',  -- GrandChase (전용 서버)
  '7e4b5d46-a6fa-444e-bfee-90448dc67c77',  -- Heroes of the Storm (전용 서버)
  '52b688f4-7ff2-4d63-b0f0-408b2aee3d76',  -- Hunt: Showdown 1896 (전용 서버)
  '3ad99a41-8afb-4aaa-afff-8af04c4a0b6d',  -- League of Legends (전용 서버)
  'f95d086c-66b7-4068-842a-2d445daa5cb7',  -- Legends of Runeterra (전용 서버)
  '81ce66d0-2b4c-4573-a070-598e44a53b03',  -- MLB 9이닝스 라이벌 26 (전용 서버)
  'ed82934a-c050-4ce8-8f72-fd74d6c58cbc',  -- NARAKA: BLADEPOINT (전용 서버)
  'c2043443-23fd-469a-8830-99d577753add',  -- Once Human (전용 서버)
  '8b7409e8-7839-4542-9a9d-6c9658e10854',  -- Overwatch 2 (전용 서버)
  '6b481be3-306e-48f0-a495-f6444070af7e',  -- Paladins® (전용 서버)
  '52621a4c-6ba0-4a84-8220-6f6052e6fe80',  -- PUBG: BATTLEGROUNDS (전용 서버)
  'fe8986b9-3d89-4a86-ad52-cf5f9dadc3e8',  -- Rec Room (전용 서버)
  '24716631-e005-453b-bff6-644473085279',  -- Rust (전용 서버)
  'deb9dc26-a2aa-4eaa-8425-f9f54852bad0',  -- Sea of Thieves: 2026 Edition (전용 서버)
  '984a56b7-4884-43ef-b3cc-05b8581660a9',  -- Sky 빛의 아이들 (전용 서버)
  '5a0db7e3-d99e-4cfa-8ff3-563ccc08796b',  -- SMITE® (전용 서버)
  '7cf59424-6121-4657-8e22-afd542277dd3',  -- Strinova (전용 서버)
  'a60a9ab3-9e65-463f-9d78-63e409402eda',  -- Teamfight Tactics (전용 서버)
  '1cef4185-7412-437c-aedd-2377b71de0de',  -- The Elder Scrolls® Online (전용 서버)
  '4e9c4614-d285-4090-8474-fab8d8ad8836',  -- Transformice (전용 서버)
  '2c7068dd-be71-431d-bfab-664eb27755ce',  -- Trove (전용 서버)
  'a7d304ec-9484-42b2-a142-e310cacecb1f',  -- VALKYRIE CONNECT (전용 서버)
  '70beb304-f248-4cbe-baec-90b9a683e714',  -- VALORANT (전용 서버)
  '2651b2fa-b423-48b6-8ff0-f0b46bd242ee',  -- Warframe (전용 서버)
  'c7c6ca7f-8f69-4b32-b5ba-d8a23c459eab',  -- We Were Here Forever (P2P)
  'b2fbc232-8543-43ee-b454-f1fb27c30667',  -- World of Tanks Blitz (전용 서버)
  '5765dffa-f0ac-4e51-b309-da64801a4959',  -- World of Warcraft (전용 서버)
  '663fa958-9b02-4d44-97e5-0c7cf47d225e',  -- World of Warships (전용 서버)
  '4edda79f-1e37-47dc-a60d-503a1369f57b',  -- Wuthering Waves (전용 서버)
  '19d97fe9-7166-489e-917d-5a17f5a8e442',  -- Yu-Gi-Oh! Duel Links (전용 서버)
  '72959ae5-5cfe-48ae-9042-43f0b7f597de',  -- Yu-Gi-Oh! Master Duel (전용 서버)
  '99990cb7-b662-4831-a282-1babf876edac',  -- 데스티니 가디언즈 (전용 서버)
  '3d674169-e171-410d-94ee-b4ca9d364cc0',  -- 디즈니 스피드스톰 -- Disney Speedstorm (전용 서버)
  'cd42df88-7e76-4e7d-8943-d4a7b133186f',  -- 소울워커 (전용 서버)
  'de957594-be93-41d8-8a59-21f14dcd1903',  -- 스매시 레전드 (전용 서버)
  '97486df5-813a-4f25-9569-43014dde0a72',  -- 이터널 리턴 (전용 서버)
  '2f78e619-8524-468a-bb39-7344bbbd6194',  -- 이환 (전용 서버)
  '03553137-386b-4c11-9c4f-822e97348104',  -- 작혼: 리치 마작 (전용 서버)
  '04ee3be2-2051-475f-91f0-566918fd73d0',  -- 젠레스 존 제로 (전용 서버)
  '08e71c25-b72b-426e-82e0-e4d595426932',  -- 콜 오브 듀티® (전용 서버)
  'f356c1fc-cee3-4ea4-a5ca-9ec293149724',  -- 토치라이트:인피니트 (전용 서버)
  '4ed77613-2877-4f47-9eb8-a021dc3625a5',  -- 톰 클랜시의 레인보우식스 시즈 (전용 서버)
  '7fd9aa2c-0cb6-4fbe-bb7a-42e177972364',  -- 퍼니싱: 그레이 레이븐 (전용 서버)
  '1957593c-e8d0-450c-bf4a-0a868dbc4b73'  -- 포 아너 (전용 서버)
);
-- server_type → '온라인 + 오프라인'
update public.games set server_type = '온라인 + 오프라인' where server_type in ('전용 서버', 'P2P') and id in (
  'e24ae059-3266-4d4c-9ab5-d36670867082',  -- A Way Out (P2P)
  '054ddadd-7559-4657-bdad-b3fdd55941c2',  -- Abiotic Factor (P2P)
  '6b8d66ce-0922-445d-b030-8a2d6eb235c8',  -- ASTRONEER (P2P)
  'c128e870-3896-478d-be3f-c8c0d711da68',  -- Backrooms: Escape Together (P2P)
  '061f958c-de9e-4841-b848-2d29260ea04e',  -- Borderlands Game of the Year (P2P)
  'fce3db70-2a91-4d71-a023-8c83a1834acf',  -- Deep Rock Galactic (P2P)
  'f47e9272-7b6f-4016-99fa-bc6f9636edec',  -- DEVOUR (P2P)
  '6e94d231-e194-4f13-bfe6-ba3dd9480195',  -- Diablo II: Resurrected (전용 서버)
  'ddae6eb1-d431-4319-abe1-b71adb672cb8',  -- Don't Starve Together (전용 서버)
  '41ce34ce-bfc8-4931-8f0c-14b4df5fe500',  -- ENDLESS Legend™ 2 엔들리스 레전드 2 (전용 서버)
  '8399262f-0354-46e1-ad62-e6076f6649ca',  -- Granblue Fantasy: Relink (전용 서버)
  'e9b91f01-d2fc-41fc-a4a3-dcb0d45361c7',  -- It Takes Two (P2P)
  '47d877d6-5e48-4a27-8e49-3c3503a325e2',  -- Lethal Company (P2P)
  '14f5acc3-0054-4a20-a75e-00bac3fdadca',  -- Melty Blood Actress Again Current Code (P2P)
  '0b826b74-1d45-49d1-a002-2084b46de374',  -- Monster Hunter Wilds (전용 서버)
  'f6d16536-bfa1-4a41-81a3-6f3a6ff2df9e',  -- Necesse: 네세스 (P2P)
  'c36a74f3-6933-4eb7-9066-f8ff9eb706b3',  -- Palworld / 팰월드 (P2P)
  'ce9472ff-40c4-40b3-8276-5e78ec8375d5',  -- PAYDAY 2 (P2P)
  'b7d84cf7-b254-4803-bc4f-4dabb6ae4d57',  -- PICO PARK 2 (P2P)
  '3a4c2b29-e953-4bd5-9ba0-be57a0c83471',  -- Risk of Rain 2 (P2P)
  '248e309e-c740-4a08-bea7-4ac7d739674d',  -- Rocket League® (전용 서버)
  'ac52ab00-22d2-492c-ac35-ccb3f946ebf0',  -- SCUM (전용 서버)
  'd2ffd8f1-74b1-4e36-bc5f-c2c4354c3a2a',  -- Sons Of The Forest (P2P)
  '4c85366b-37bd-475d-b9d9-d1f98ed0d5e2',  -- Soulmask (P2P)
  '887dfe3f-7990-4350-b048-aac5c96e056d',  -- StarCraft: Remastered (전용 서버)
  '59514d14-dbcc-4e73-999b-6db117773e7d',  -- The Forest (P2P)
  'f80995d9-dc96-43b0-92e5-945aae36d590',  -- The Planet Crafter (P2P)
  'dbbe5a71-09d8-4b5b-9ee7-3c406dbf5900',  -- Valheim (P2P)
  'e3c65f2e-a6ac-4f93-8616-9913ae621fb4',  -- Warhammer 40,000: Dawn of War - Definitive Edition (전용 서버)
  'f547edb5-7eab-48a9-afa6-f16ad97bb86a',  -- Warhammer: Vermintide 2 (P2P)
  'b0daafc9-a4d5-4e8e-ac89-482a2aedafc5',  -- 낚시 방법 (P2P)
  'a1d5c310-a0d8-4b81-b551-4fe6edb004f7',  -- 노움 강도단 (P2P)
  '6c6bf534-ac91-4170-9dee-2bd7c4b2612c',  -- 라스트 에포크 (전용 서버)
  'fba08a07-c711-4379-8fe5-76ec3f26f1a6',  -- 방 탈출 시뮬레이터2 (P2P)
  '51267b1d-fbae-4309-87b9-e9498e181968'  -- 서브노티카 2 (P2P)
);
-- server_type → null (애매함, 아래 보고 목록)
update public.games set server_type = null where server_type in ('전용 서버', 'P2P') and id in (
  'e9a4fe41-4c30-452a-a751-7d0308506914',  -- Brawlhalla (전용 서버)
  'ea50ea1d-e399-4839-9374-01a78fbbfe3b',  -- Card Shop Simulator Multiplayer (전용 서버)
  '2db3cc9e-628a-4d90-b489-1b985030ccf2',  -- Counter-Strike 2 (전용 서버)
  '49f441ae-e2ef-4657-bcd9-4ae13b363abb',  -- DDNet (전용 서버)
  '0ced0c1e-077a-4375-93ab-727beed37325',  -- EZ2ON REBOOT : R (전용 서버)
  '1e18114b-9024-415d-af63-3082315c2f9b',  -- Gamble With Your Friends (전용 서버)
  '55d07921-b4d1-4ee8-9355-4e666a45dba4',  -- Halo Infinite (전용 서버)
  '6abedf3d-15ec-4ea8-8b94-d6f8fbb2bb16',  -- PANICORE (패니코어) (전용 서버)
  '382aead2-6a12-4a76-9f89-792974e84bbb',  -- Team Fortress 2 (전용 서버)
  'a181d13b-e645-4777-97a2-4ea00b548ad5',  -- Tick Tock: A Tale for Two (P2P)
  'f5f3870b-279e-4fd5-b7b3-8810be86561c',  -- WEBFISHING (전용 서버)
  '5975c530-2909-4298-82b1-341f7cb61e51'  -- 연운 (전용 서버)
);

-- 4) 자유 형식 21개를 세 값 중 하나로 (값이 그대로일 때만). 이름에 서버 방식이 있던 게임은 multiplayer_host도 채움
update public.games set server_type = '온라인 + 오프라인' where id = 'a4a850f8-1bdc-4168-8e7c-3b81cdeb05e0' and server_type = '없음 (세션 기반 오픈월드)';  -- Muck
update public.games set server_type = '상시 온라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = 'b51eb4d4-23d6-4813-8a4f-042716ea923d' and server_type = '전용 서버 (지역별: 아메리카/유럽/아시아/중국)';  -- Hearthstone
update public.games set server_type = '상시 온라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = '4724c5b8-a2ee-49ef-9391-6132c066bc3b' and server_type = '전용 서버(상시 온라인, 오프라인 불가)';  -- Diablo IV
update public.games set server_type = '온라인 + 오프라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = 'bf297e74-591f-4e68-9cd3-d5a9e04dae7e' and server_type = '전용 서버(배틀넷)';  -- Warcraft III: Reforged
update public.games set server_type = '상시 온라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = 'aee396c6-5970-4bdd-9626-1bcd4697f5e6' and server_type = '전용 서버 (배틀넷 상시 접속 필수, 오프라인 불가)';  -- Diablo III
update public.games set server_type = '오프라인 전용' where id = '1674d087-e944-4add-b0ba-5cbeb2c47196' and server_type = '오프라인 가능';  -- Eternal Threads
update public.games set server_type = '오프라인 전용' where id = '4830ff61-2c7d-4e65-a13a-930547ff3dbf' and server_type = '오프라인 가능';  -- Astrea Six Sided Oracles
update public.games set server_type = '오프라인 전용' where id = 'dc54c516-0420-498a-8bf7-672e80eb76c4' and server_type = '오프라인 가능';  -- Out of Sight
update public.games set server_type = '오프라인 전용' where id = 'c3441dd5-bb19-42a8-9d77-2ff90fc59c17' and server_type = '오프라인 가능';  -- 고스트러너 2
update public.games set server_type = '온라인 + 오프라인' where id = 'ec917512-bd6d-4195-a1a0-95ea02c7c5ac' and server_type = '없음 (세션 기반)';  -- PICO PARK
update public.games set server_type = '온라인 + 오프라인' where id = 'e93e7c71-33e1-48d9-8a54-b29f32c43c63' and server_type = '온라인 매치메이킹(GGPO 롤백 넷코드) + 오프라인 로컬 대전 가능';  -- Them's Fightin' Herds
update public.games set server_type = '상시 온라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = 'f33282e7-c469-4da3-9bc4-30400fa407a2' and server_type = '전용 서버(온라인 필수)';  -- Fall Guys
update public.games set server_type = '오프라인 전용' where id = 'bd26f056-e4fe-40c0-a95f-b3b8afc004d2' and server_type = '없음 (세션 기반)';  -- Keep Talking and Nobody Explodes
update public.games set server_type = '상시 온라인', multiplayer_host = coalesce(multiplayer_host, '전용 서버') where id = '176d658f-b34f-4cf9-a63e-ffce2152e420' and server_type = '상시 온라인';  -- 디아블로® IV
update public.games set server_type = '오프라인 전용' where id = '0f5d67d0-e057-45bc-8bd5-11a00bb1f939' and server_type = '오프라인 가능';  -- Alan Wake 2
update public.games set server_type = null where id = 'de6e058f-0d45-4020-80aa-2ed42356d409' and server_type = '온라인 멀티플레이';  -- TerraScape
update public.games set server_type = null where id = '01ac01bc-87cf-4db6-a14e-29b520996b45' and server_type = '없음 (세션 기반, 서버 초기화 개념 없음)';  -- PEAK
update public.games set server_type = '오프라인 전용' where id = '1c4a67ce-93bb-47ca-92a4-9e89d7c39416' and server_type = '오프라인 가능';  -- Luftrausers
update public.games set server_type = '오프라인 전용' where id = 'bd9edebc-ad4a-458c-92b1-978f2e2c6dfc' and server_type = '오프라인 가능';  -- 베리드 스타즈 (BURIED STARS)
update public.games set server_type = null where id = '0769c15f-8ea3-47b9-86a9-bdb046c03336' and server_type = '없음 (세션 기반)';  -- RV There Yet?
update public.games set server_type = '상시 온라인' where id = '4cb3c1a0-fc9f-42be-8711-d1fa5c643320' and server_type = '없음 (세션 기반)';  -- MECCHA CHAMELEON

-- 5) 협동 플래그 보정
--    그리드랜드: 스팀 분류에 로컬 협동(Shared/Split Screen Co-op)만 있음 → 온라인 협동 끔 (로컬 협동이 켜져 있어 배지 '협동'은 그대로)
update public.games set has_online_coop = false
where id = '15a3c5f8-7bc7-48d3-bd38-6b1ab28fef3e' and has_online_coop = true;
--    Little Fighter 2 Remastered: 개발자 안내로 IP 직접 연결 온라인 대전·협동(최대 8명) 지원 → 온라인 + 오프라인, P2P
--    (스팀 친구 초대는 아직 없음, 온라인 협동 칸은 켜진 그대로)
update public.games
set server_type = '온라인 + 오프라인', multiplayer_host = coalesce(multiplayer_host, 'P2P')
where id = 'c2156456-cb3f-4497-bd08-36738d83f6eb' and server_type = '오프라인 전용';

-- 6) 이 파일을 만든 뒤 새로 들어온 값 정리 (제약을 걸기 위해)
--    '전용 서버'·'P2P'는 multiplayer_host로 옮기고 server_type은 비움, 그 밖의 값도 비움
update public.games
set multiplayer_host = coalesce(multiplayer_host, server_type), server_type = null
where server_type in ('전용 서버', 'P2P');
update public.games
set server_type = null
where server_type is not null and server_type not in ('상시 온라인', '온라인 + 오프라인', '오프라인 전용');

-- 7) 제약: 정해진 값만
alter table public.games drop constraint if exists games_server_type_check;
alter table public.games add constraint games_server_type_check
  check (server_type in ('상시 온라인', '온라인 + 오프라인', '오프라인 전용'));
alter table public.games drop constraint if exists games_multiplayer_host_check;
alter table public.games add constraint games_multiplayer_host_check
  check (multiplayer_host in ('전용 서버', 'P2P'));

notify pgrst, 'reload schema';
