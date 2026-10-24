alter table public.curator_posts add column if not exists post_title text;
notify pgrst, 'reload schema';
