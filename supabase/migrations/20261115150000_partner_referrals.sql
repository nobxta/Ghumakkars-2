-- Partner referrals: hand a customer to another operator and track the money
-- properly.
--
-- Model (per referred booking):
--   customer price  = what the customer owes in total (existing money math)
--   partner price   = what the partner keeps for running the trip (new)
--   margin          = customer price − partner price
--   paid to us      = payment_transactions with collected_by = 'us'
--   paid to partner = payment_transactions with collected_by = 'partner' (new)
--   settlements     = money moved between us and the partner (new table)
--   partner balance = partner price − paid to partner − paid to partner by us
--                     + paid to us by partner   (> 0: we owe them, < 0: they owe us)
--
-- Additive only: no existing column changes meaning, so the currently deployed
-- app keeps working until the new code ships.

-- 1) Partners ---------------------------------------------------------------
create table if not exists public.partners (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  contact_name        text,
  phone               text,
  email               text,
  upi_id              text,
  bank_details        text,
  default_price_basis text not null default 'per_person' check (default_price_basis in ('per_person', 'total')),
  default_price_rate  numeric(12,2) check (default_price_rate is null or default_price_rate >= 0),
  notes               text,
  is_active           boolean not null default true,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists partners_name_ci_key on public.partners (lower(btrim(name)));
alter table public.partners enable row level security;

-- 2) Booking columns ---------------------------------------------------------
alter table public.bookings
  add column if not exists partner_id             uuid references public.partners(id) on delete set null,
  add column if not exists partner_price          numeric(12,2) check (partner_price is null or partner_price >= 0),
  add column if not exists partner_price_basis    text check (partner_price_basis is null or partner_price_basis in ('per_person', 'total')),
  add column if not exists partner_price_rate     numeric(12,2) check (partner_price_rate is null or partner_price_rate >= 0),
  add column if not exists referral_status_before text,
  add column if not exists referred_at            timestamptz,
  add column if not exists referred_by            uuid references auth.users(id) on delete set null;
create index if not exists bookings_partner_id_idx on public.bookings (partner_id) where partner_id is not null;

-- 3) Who received a customer payment ----------------------------------------
alter table public.payment_transactions
  add column if not exists collected_by text not null default 'us';
do $$ begin
  alter table public.payment_transactions
    add constraint payment_transactions_collected_by_check check (collected_by in ('us', 'partner'));
exception when duplicate_object then null; end $$;

-- 4) Settlements between us and a partner -----------------------------------
create table if not exists public.partner_settlements (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete set null,
  direction   text not null check (direction in ('to_partner', 'from_partner')),
  amount      numeric(12,2) not null check (amount > 0),
  method      text,
  reference   text,
  notes       text,
  settled_on  date not null default current_date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists partner_settlements_partner_idx on public.partner_settlements (partner_id, settled_on desc);
create index if not exists partner_settlements_booking_idx on public.partner_settlements (booking_id) where booking_id is not null;
alter table public.partner_settlements enable row level security;
-- No RLS policies on purpose: only the service role (admin API routes) reads or
-- writes partners and settlements. Customers never see any of it.

-- 5) Existing referrals → partner records ------------------------------------
-- One partner per distinct name (case/space-insensitive), keeping the most used
-- spelling. Old referrals keep partner_price NULL = "older referral": their
-- margin is the saved referral_commission and settlement isn't tracked until an
-- admin enters a partner price.
insert into public.partners (name)
select distinct on (lower(btrim(referral_partner))) btrim(referral_partner)
from (
  select referral_partner, count(*) over (partition by referral_partner) as uses
  from public.bookings
  where referral_partner is not null and btrim(referral_partner) <> ''
) s
order by lower(btrim(referral_partner)), uses desc, btrim(referral_partner)
on conflict do nothing;

update public.bookings b
set partner_id = p.id
from public.partners p
where b.partner_id is null
  and b.referral_partner is not null
  and lower(btrim(b.referral_partner)) = lower(btrim(p.name));

-- 6) Referred travellers no longer hold seats on our trip (the partner runs
-- it). Recount seats for trips that have referred bookings.
update public.trips t
set current_participants = coalesce(s.pax, 0),
    updated_at = now()
from (
  select tr.id,
         (select sum(coalesce(b.number_of_participants, 1))
            from public.bookings b
           where b.trip_id = tr.id
             and b.booking_status in ('confirmed', 'seat_locked', 'on_trip', 'completed')) as pax
  from public.trips tr
  where exists (select 1 from public.bookings rb where rb.trip_id = tr.id and rb.booking_status = 'referred')
) s
where s.id = t.id
  and coalesce(t.current_participants, 0) is distinct from coalesce(s.pax, 0);

-- 7) Payments admin view: expose who collected each payment (appended column).
create or replace view public.v_payments_admin with (security_invoker = on) as
 SELECT pt.id,
    pt.booking_id,
    pt.user_id,
    pt.razorpay_order_id,
    pt.razorpay_payment_id,
    pt.transaction_id,
    pt.amount,
    pt.amount_refunded,
    pt.currency,
    pt.payment_status,
    pt.payment_type,
    pt.payment_mode,
    pt.payment_method,
    pt.captured,
    pt.vpa,
    pt.upi_provider,
    pt.card_network,
    pt.card_type,
    pt.card_last4,
    pt.card_issuer,
    pt.bank,
    pt.wallet,
    pt.customer_name,
    pt.customer_email,
    pt.customer_phone,
    pt.paid_at,
    pt.created_at,
    pt.updated_at,
    b.booking_status,
    b.primary_passenger_name,
    b.primary_passenger_email,
    b.primary_passenger_phone,
    t.id AS trip_id,
    t.title AS trip_title,
    t.destination AS trip_destination,
    pt.collected_by
   FROM payment_transactions pt
     LEFT JOIN bookings b ON b.id = pt.booking_id
     LEFT JOIN trips t ON t.id = b.trip_id;
