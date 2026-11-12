-- Error logs auto-cleanup, v2.
-- Before: rows were only pruned when a NEW log was written, and fixed rows were never removed.
-- Now the same rules run on every insert AND every time the admin Logs page loads:
--   • fixed (resolved) logs        → deleted after 3 days
--   • warnings (routine activity)  → deleted after 7 days
--   • everything else              → deleted after 30 days
--   • never more than 2000 rows in total (newest kept)

create or replace function public.cleanup_error_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer := 0;
  n integer;
begin
  delete from public.error_logs where resolved and created_at < now() - interval '3 days';
  get diagnostics n = row_count; removed := removed + n;

  delete from public.error_logs where level = 'warning' and created_at < now() - interval '7 days';
  get diagnostics n = row_count; removed := removed + n;

  delete from public.error_logs where created_at < now() - interval '30 days';
  get diagnostics n = row_count; removed := removed + n;

  delete from public.error_logs
  where id in (select id from public.error_logs order by created_at desc offset 2000);
  get diagnostics n = row_count; removed := removed + n;

  return removed;
end;
$$;

revoke execute on function public.cleanup_error_logs() from public, anon, authenticated;
grant execute on function public.cleanup_error_logs() to service_role;

create or replace function public.prune_error_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cleanup_error_logs();
  return null;
end;
$$;

revoke execute on function public.prune_error_logs() from public, anon, authenticated;

create index if not exists error_logs_resolved_created_idx on public.error_logs (resolved, created_at);
