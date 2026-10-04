-- 성인 콘텐츠 표시: 스팀 content descriptors 저장 + 메인 노출 제외
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (행·기록은 지우지 않음)
-- content_descriptor_ids: 스팀 appdetails의 content_descriptors.ids
--   1 일부 노출 또는 성적인 콘텐츠 · 2 빈번한 폭력 또는 유혈 · 3 성인 전용 성적인 콘텐츠
--   4 빈번한 노출 또는 성적인 콘텐츠 · 5 일반 성인용 콘텐츠
--   null = 아직 확인 안 함, {} = 확인했고 없음 (채우기: scripts/fill-content-descriptors.mjs)
-- home_excluded: 이번주의 게임·지금 뜨는 게임·메인 배너·추천 섹션에서 뺌 (검색·상세·비교에는 그대로)
--   목록과 기준은 docs/home-excluded-games.md

alter table public.games add column if not exists content_descriptor_ids int[];
alter table public.games add column if not exists home_excluded boolean not null default false;

update public.games set home_excluded = true
where home_excluded = false and id in (
  '14bd1b05-2334-4703-b004-fbd5722363b6', -- 하숙생이 전부 미녀입니다만? 시즌2
  '4228c5f5-38e7-4c6c-b891-b7f12f2733be', -- DEAD OR ALIVE Xtreme Venus Vacation
  '96394f9e-b6ec-4813-a0f0-7f6b8a47b4a6', -- Genital Jousting
  'f8461df4-5701-4c47-bf0a-b647ae3f10da', -- DRAMAtical Murder
  '346dc3bc-fd7f-4b4a-95d9-800a9278fe1d', -- 사야의 노래
  'c06eace2-d123-4cd9-afa5-177729d9c258', -- Winter Memories
  '3c9a1409-772c-49d3-a03e-cde5efa76a3f', -- Summer Pockets REFLECTION BLUE
  '55a5e2a4-e003-4ed7-a446-4bc607e2d602', -- ATLYSS
  '85f9f173-0bcb-46c9-808a-091d6d5349bf', -- Succubus Affection
  'fde27465-4bf6-42a4-800f-06c68edd3335', -- Succumate
  '8538bb60-993f-4a14-9450-f29588947965', -- 너의 아내
  '53bb48a8-9e73-4605-8607-3e81ab1f9833', -- Scars of Summer
  'd2550046-218f-45c0-89e3-ab24688dc8eb', -- BLACK SOULS
  '3202a455-226a-4421-9dc9-408a45ca74fe', -- BLACK SOULS II
  'cb669593-6492-4125-ab7b-53e03ca21584', -- 당신과 그녀와 그녀의 사랑
  'f45ca6a3-9890-4f71-8868-941ae102ea90', -- 두 사람의 여름의 소리
  '2be170ec-e79b-4b29-9612-c7f184d23d97', -- Demons Roots
  '27313551-8fb2-44a8-b4e6-56d3cbef5eaf', -- Pronoun Palace
  'e5150c7e-0d89-4ca3-9204-a65dd6ea6606'  -- Sultan's Game
);

notify pgrst, 'reload schema';
