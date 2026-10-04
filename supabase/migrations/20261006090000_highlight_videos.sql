-- 하이라이트·쇼츠 영상 (game_videos kind='highlight') + 게임별 진행 상태
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)

-- 하이라이트 영상을 마지막으로 찾아본 시각 (scripts/fetch-highlight-videos.mjs가 채움, 30일마다 갱신)
alter table public.games add column if not exists highlight_videos_at timestamptz;

-- game_videos.kind 제약 넓히기: 지금 있는 kind 제약(이름 모름)을 찾아 지우고,
-- 기존에 쓰던 값 + 지금 표에 들어 있는 값 + 'highlight'를 모두 허용하는 제약으로 다시 만든다
do $$
declare
  c record;
  allowed text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'game_videos' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%'
  loop
    execute format('alter table public.game_videos drop constraint %I', c.conname);
  end loop;

  select string_agg(quote_literal(k), ', ' order by k) into allowed
  from (
    select distinct kind as k from public.game_videos where kind is not null
    union select 'coop'
    union select 'highlight'
  ) s;

  execute format('alter table public.game_videos add constraint game_videos_kind_check check (kind in (%s))', allowed);
end $$;

notify pgrst, 'reload schema';
