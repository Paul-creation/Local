alter table public.curators add column if not exists bio text;
notify pgrst, 'reload schema';
