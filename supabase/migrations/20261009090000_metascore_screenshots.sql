alter table public.games add column if not exists metascore integer;
alter table public.games add column if not exists screenshots jsonb;
alter table public.games add column if not exists lowest_price_shop text;
