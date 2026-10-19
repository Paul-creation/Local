alter table public.curators add column if not exists show_on_home boolean not null default false;
notify pgrst, 'reload schema';
