-- Error logs for the admin "Error Logs" page.
-- Self-cleaning: after every insert, rows older than 7 days are deleted and only
-- the newest 500 are kept, so this table never grows.
-- Service role only (RLS on, no policies): read and written by server routes.

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null default 'error' check (level in ('error', 'warning')),
  category text not null,          -- auth | otp | email | payment | booking | webhook | admin | system
  process text not null,           -- e.g. 'Send login OTP', 'Razorpay payment'
  message text not null,
  code text,                       -- HTTP status, SMTP code, Razorpay error code...
  user_id uuid,
  user_email text,
  booking_id uuid,
  route text,
  method text,
  status integer,
  ip text,
  user_agent text,
  device text,                     -- 'Chrome 130 · Windows · Desktop'
  details jsonb,
  resolved boolean not null default false
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;
revoke all on public.error_logs from anon, authenticated;

create or replace function public.prune_error_logs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.error_logs where created_at < now() - interval '7 days';
  delete from public.error_logs
  where id in (
    select id from public.error_logs order by created_at desc offset 500
  );
  return null;
end;
$$;

revoke execute on function public.prune_error_logs() from public, anon, authenticated;

drop trigger if exists error_logs_prune on public.error_logs;
create trigger error_logs_prune
  after insert on public.error_logs
  for each statement
  execute function public.prune_error_logs();
