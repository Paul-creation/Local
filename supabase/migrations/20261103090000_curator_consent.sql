alter table public.curators add column if not exists consent_status text not null default 'pending' check (consent_status in ('pending','granted','revoked'));
alter table public.curators add column if not exists consent_note text;
alter table public.curators add column if not exists consented_at timestamptz;

update public.curators set consent_status = 'granted', consented_at = now() where handle in ('gamelog.archive','gamecuration.kr','glitch_zine','saveslot0_0');
update public.curators set consent_note = '비상업적 아카이빙 한정. 수익화 전 사전 협의 필수. 메인 노출은 답 대기. 새 게시물은 요청 시에만.' where handle = 'saveslot0_0';

revoke select on public.curators from anon, authenticated;
grant select (id, handle, display_name, instagram_url, avatar_url, bio, show_on_home, consent_status, created_at) on public.curators to anon, authenticated;
drop policy if exists "큐레이터 읽기" on public.curators;
create policy "큐레이터 읽기" on public.curators for select to anon, authenticated using (consent_status = 'granted');
drop policy if exists "큐레이터 게시물 읽기" on public.curator_posts;
create policy "큐레이터 게시물 읽기" on public.curator_posts for select to anon, authenticated using (exists (select 1 from public.curators c where c.id = curator_id and c.consent_status = 'granted'));

notify pgrst, 'reload schema';
