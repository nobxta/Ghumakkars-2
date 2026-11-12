-- Bookings, their payment rows and coupon usages are now created only by the
-- server (/api/bookings, which uses the service role and re-checks prices,
-- coupons and wallet balance). Remove the policies that let a signed-in user
-- insert these rows straight from the browser with any status or amount.
drop policy if exists "Users can create their own bookings" on public.bookings;
drop policy if exists "Users can insert payment transactions for their own bookings" on public.payment_transactions;
drop policy if exists "Users can record their own coupon usage" on public.coupon_usages;

-- debit_wallet: lock the profile row while checking the balance so two
-- bookings at the same moment can't both spend the same wallet money.
create or replace function public.debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_type character varying default null,
  p_reference_id uuid default null
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_current_balance numeric(10, 2);
  v_new_balance numeric(10, 2);
begin
  if p_amount is null or p_amount <= 0 then
    return false;
  end if;

  select coalesce(wallet_balance, 0) into v_current_balance
  from profiles
  where id = p_user_id
  for update;

  if v_current_balance is null or v_current_balance < p_amount then
    return false;
  end if;

  update profiles
  set wallet_balance = v_current_balance - p_amount
  where id = p_user_id
  returning wallet_balance into v_new_balance;

  insert into wallet_transactions (
    user_id, transaction_type, amount, balance_after, description, reference_type, reference_id
  ) values (
    p_user_id, 'debit', p_amount, v_new_balance, p_description, p_reference_type, p_reference_id
  );

  return true;
end;
$$;

-- Only the server (service role) spends wallet money.
revoke execute on function public.debit_wallet(uuid, numeric, text, character varying, uuid) from public, anon, authenticated;
grant execute on function public.debit_wallet(uuid, numeric, text, character varying, uuid) to service_role;
