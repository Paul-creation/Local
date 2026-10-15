-- 가능한 활동 v2 저장 칸 (분류표 키는 app/lib/activities.ts)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음, 기존 games.activities는 건드리지 않음)

alter table public.games add column if not exists activities_confirmed text[] not null default '{}';
alter table public.games add column if not exists activities_unsure text[] not null default '{}';
alter table public.games add column if not exists activities_evidence jsonb;
alter table public.games add column if not exists activities_ai_at timestamptz;

notify pgrst, 'reload schema';
