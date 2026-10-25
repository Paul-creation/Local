alter table public.review_history add column if not exists source text;
notify pgrst, 'reload schema';
