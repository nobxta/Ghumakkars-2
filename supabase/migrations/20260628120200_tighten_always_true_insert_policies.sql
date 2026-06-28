-- Hardening (Supabase advisor: rls_policy_always_true): replace overly-permissive
-- "WITH CHECK (true)" INSERT policies with scoped ones. Service role (all server
-- routes) bypasses RLS, so these only constrain the public API roles.

-- coupon_usages: the booking page inserts client-side with user_id = the buyer,
-- so a user may only record their OWN coupon usage.
drop policy if exists "System can create coupon usage" on public.coupon_usages;
create policy "Users can record their own coupon usage"
  on public.coupon_usages
  for insert to public
  with check (auth.uid() = user_id);

-- admin_activity_log: only admins (and the service role) may write log rows.
drop policy if exists "System can insert activity logs" on public.admin_activity_log;
create policy "Admins can insert activity logs"
  on public.admin_activity_log
  for insert to public
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and (profiles.role)::text = 'admin'
  ));
