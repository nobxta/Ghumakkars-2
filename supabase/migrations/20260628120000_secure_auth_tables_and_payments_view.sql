-- Security fix (Supabase advisor): the OTP / password-reset / pending-signup
-- tables and the admin payments view were reachable via the public PostgREST
-- API (anon + authenticated had full DML, and v_payments_admin was SECURITY
-- DEFINER). All of these are only ever accessed server-side through the
-- service-role client, which bypasses RLS and keeps its own grants, so locking
-- out the public API roles is safe.

-- 1) Enable RLS (no policies = deny-all for anon/authenticated; service_role bypasses).
alter table public.otp_codes enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.pending_signups enable row level security;

-- 2) Remove the public API grants entirely (defense in depth alongside RLS).
revoke all on public.otp_codes from anon, authenticated;
revoke all on public.password_reset_tokens from anon, authenticated;
revoke all on public.pending_signups from anon, authenticated;

-- 3) Admin payments view: stop exposing it to the public API and make it run
--    with the caller's permissions (it is only queried by the service role).
revoke all on public.v_payments_admin from anon, authenticated;
alter view public.v_payments_admin set (security_invoker = on);
