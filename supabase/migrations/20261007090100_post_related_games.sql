-- 게시글 관련 게임 자동 연결: 글 작성·수정 때 서버가 제목+본문에서 찾은 게임 id(최대 3개)를 저장
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- null = 아직 매칭 안 함, {} = 매칭했지만 관련 게임 없음 (scripts/fill-post-related-games.mjs는 null인 글만 채움)

alter table public.posts add column if not exists related_game_ids uuid[];

-- 게임 상세 "관련 게시물"에서 related_game_ids @> {게임 id} 조회용
create index if not exists posts_related_game_ids_idx on public.posts using gin (related_game_ids);
-- posts.game_id(직접 고른 게임) 조회용
create index if not exists posts_game_id_created_idx on public.posts (game_id, created_at desc);

notify pgrst, 'reload schema';
