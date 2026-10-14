-- 1) Stop customers from granting themselves admin / wallet credit.
--
-- The "Users can update their own profile" policy has no column restriction, so
-- any signed-in user could run (from the browser, with the public anon key):
--   supabase.from('profiles').update({ role: 'admin', wallet_balance: 99999 })
-- This trigger blocks changes to privileged columns when the request comes
-- straight from a client (PostgREST roles anon/authenticated) and the caller is
-- not an admin. Server code (service_role) and SECURITY DEFINER functions
-- (e.g. process_referral_reward) run as a different role and are unaffected.
--
-- 2) Let admins read every profile from the browser client (Analytics page,
-- Coupons "specific users" picker). Uses a SECURITY DEFINER helper so the policy
-- doesn't recurse into profiles' own RLS.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- NOT security definer on purpose: current_user must reflect the caller.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    new.wallet_balance := 0;
    new.referred_by := null;
    new.email_verified := false;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.wallet_balance is distinct from old.wallet_balance
     or new.referred_by is distinct from old.referred_by
     or new.referral_code is distinct from old.referral_code
     or new.email_verified is distinct from old.email_verified
     or new.email is distinct from old.email then
    raise exception 'Not allowed to change protected profile fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- 3) Deleting a user who reviewed payments / created trips / edited settings
-- failed on these FKs (no ON DELETE rule). Keep the records, just clear the
-- reference. The referenced table is preserved as-is.
do $$
declare
  r record;
begin
  for r in
    select c.conname, rel.relname as table_name, att.attname as column_name,
           c.confrelid::regclass as ref_table, refatt.attname as ref_column
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
    join pg_attribute refatt on refatt.attrelid = c.confrelid and refatt.attnum = c.confkey[1]
    where n.nspname = 'public'
      and c.contype = 'f'
      and c.confdeltype = 'a'  -- NO ACTION
      and array_length(c.conkey, 1) = 1
      and (rel.relname, att.attname) in (
        ('bookings', 'payment_reviewed_by'),
        ('payment_transactions', 'payment_reviewed_by'),
        ('trips', 'created_by'),
        ('coupon_codes', 'created_by'),
        ('payment_settings', 'updated_by'),
        ('admin_general_settings', 'updated_by'),
        ('manual_payment_methods', 'created_by'),
        ('manual_payment_methods', 'updated_by')
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references %s(%I) on delete set null',
      r.table_name, r.conname, r.column_name, r.ref_table, r.ref_column
    );
  end loop;
end $$;
