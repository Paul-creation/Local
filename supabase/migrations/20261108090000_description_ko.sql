alter table games add column if not exists description_ko text;
alter table games add column if not exists description_ko_at timestamptz;
alter table games add column if not exists upcoming_rank integer;
