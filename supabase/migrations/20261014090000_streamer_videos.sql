-- 스트리머 PICK: 스트리머 공식 채널 (streamer_channels) + 게임과 연결된 영상 (streamer_videos)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 채널 목록은 data/streamers/channels.json → scripts/fetch-streamer-videos.mjs --apply가 없는 채널만 넣음
-- 쓰기는 서버(service role)만: 수집 스크립트 + 관리자 API(채널 켜기/끄기, 영상 숨기기)

create table if not exists public.streamer_channels (
  channel_id text primary key,                  -- YouTube 채널 ID (UC...)
  streamer_name text not null,                  -- 사람 이름 (한 사람이 채널 여러 개)
  channel_title text,
  handle text,                                  -- @핸들
  kind text not null check (kind in ('main', 'vod', 'edit', 'game')), -- 본 · 다시보기 · 편집 · 게임
  enabled boolean not null default true,        -- 논란 등으로 뺄 때 false (관리자 페이지)
  uploads_checked_at timestamptz,               -- 업로드 목록을 마지막으로 확인한 시각 (이후 올라온 영상만 새로 봄, 비어 있으면 최근 60일 백필)
  created_at timestamptz not null default now()
);

create table if not exists public.streamer_videos (
  video_id text primary key,
  channel_id text not null references public.streamer_channels(channel_id),
  game_id uuid not null references public.games(id) on delete cascade,
  title text not null,
  published_at timestamptz not null,
  view_count bigint,                            -- 저장할 때의 조회수
  is_short boolean not null default false,      -- 60초 이하
  match_method text not null,                   -- title · description (어디서 게임 이름을 찾았는지)
  hidden boolean not null default false,        -- 잘못 연결된 영상 숨김 (관리자 페이지)
  created_at timestamptz not null default now()
);
create index if not exists streamer_videos_game_idx on public.streamer_videos (game_id, published_at desc);
create index if not exists streamer_videos_channel_idx on public.streamer_videos (channel_id, published_at desc);

-- RLS: 브라우저(anon)는 켜진 채널, 그 채널의 숨기지 않은 영상만 읽기. 쓰기·수정·삭제는 서버(service role)로만
alter table public.streamer_channels enable row level security;
revoke all on public.streamer_channels from anon, authenticated;
-- enabled는 아래 영상 정책의 하위 조회가 읽어야 해서 같이 허용 (anon에게는 어차피 true인 행만 보임)
grant select (channel_id, streamer_name, channel_title, handle, kind, enabled) on public.streamer_channels to anon;
drop policy if exists "켜진 채널만 읽기" on public.streamer_channels;
create policy "켜진 채널만 읽기" on public.streamer_channels for select to anon using (enabled = true);

alter table public.streamer_videos enable row level security;
revoke all on public.streamer_videos from anon, authenticated;
grant select (video_id, channel_id, game_id, title, published_at, view_count, is_short) on public.streamer_videos to anon;
drop policy if exists "켜진 채널의 공개 영상만 읽기" on public.streamer_videos;
create policy "켜진 채널의 공개 영상만 읽기" on public.streamer_videos for select to anon using (
  hidden = false
  and exists (select 1 from public.streamer_channels c where c.channel_id = streamer_videos.channel_id and c.enabled = true)
);

-- API가 새 테이블을 바로 알아보게 스키마 캐시 새로고침
notify pgrst, 'reload schema';
