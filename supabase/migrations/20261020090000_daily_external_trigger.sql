create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_daily_workflow()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  pat text;
  req_id bigint;
begin
  select decrypted_secret into pat
  from vault.decrypted_secrets
  where name = 'github_actions_pat';

  if pat is null then
    raise exception 'vault secret github_actions_pat not found';
  end if;

  select net.http_post(
    url := 'https://api.github.com/repos/Paul-creation/Local/actions/workflows/daily.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || pat,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'jamidunow-pg-cron',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main'),
    timeout_milliseconds := 10000
  ) into req_id;

  return req_id;
end;
$$;

revoke all on function public.trigger_daily_workflow() from public, anon, authenticated;

select cron.schedule(
  'daily-workflow-dispatch',
  '17 18 * * *',
  $cron$select public.trigger_daily_workflow()$cron$
);
