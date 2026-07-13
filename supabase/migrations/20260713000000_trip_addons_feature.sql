-- Trip Add-ons & Upgrades feature (additive, non-breaking).
-- trip_addons  = admin-configured catalog (one row per add-on per trip)
-- booking_addons = immutable-ish snapshot of what a booking actually selected
-- trips.addons_enabled = per-trip on/off toggle (default off = feature invisible)
-- bookings.addons_total = denormalized mirror so money math needs no join (default 0)

-- ── 1. Per-trip toggle + denormalized total ─────────────────────────────────
alter table public.trips    add column if not exists addons_enabled boolean not null default false;
alter table public.bookings add column if not exists addons_total   numeric not null default 0;

-- ── 2. Catalog table ────────────────────────────────────────────────────────
create table if not exists public.trip_addons (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  name              varchar(120) not null,
  description       text,
  icon_key          varchar(60),
  category          varchar(40),
  price             numeric not null default 0 check (price >= 0),
  pricing_method    varchar(30) not null default 'per_traveller'
                      check (pricing_method in ('per_booking','per_traveller','per_room','per_unit','per_traveller_night')),
  room_occupancy    integer check (room_occupancy is null or room_occupancy > 0),
  exact_occupancy   boolean not null default false,
  partial_occupancy boolean not null default true,
  is_room_upgrade   boolean not null default false,
  chargeable_units  integer check (chargeable_units is null or chargeable_units >= 0),
  min_quantity      integer not null default 1 check (min_quantity >= 0),
  max_quantity      integer check (max_quantity is null or max_quantity >= 1),
  capacity          integer check (capacity is null or capacity >= 0),
  is_required       boolean not null default false,
  is_refundable     boolean not null default true,
  is_active         boolean not null default true,
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists trip_addons_trip_idx on public.trip_addons (trip_id, is_active, display_order);

-- ── 3. Snapshot table ───────────────────────────────────────────────────────
create table if not exists public.booking_addons (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references public.bookings(id) on delete cascade,
  trip_addon_id            uuid references public.trip_addons(id) on delete set null,
  name                     varchar(120) not null,
  description              text,
  icon_key                 varchar(60),
  category                 varchar(40),
  pricing_method           varchar(30) not null,
  unit_price               numeric not null default 0,
  selected_passenger_ids   jsonb not null default '[]'::jsonb,
  selected_passenger_names jsonb not null default '[]'::jsonb,
  quantity                 integer not null default 1,
  room_occupancy           integer,
  room_count               integer,
  chargeable_units         integer,
  addon_total              numeric not null default 0,
  is_refundable            boolean not null default true,
  status                   varchar(20) not null default 'selected'
                             check (status in ('selected','confirmed','cancelled','unavailable')),
  payment_status           varchar(20) not null default 'pending'
                             check (payment_status in ('pending','paid','refund_pending','refunded')),
  refundable_amount        numeric,
  cancellation_reason      text,
  cancelled_at             timestamptz,
  cancelled_by             uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists booking_addons_booking_idx on public.booking_addons (booking_id);
create index if not exists booking_addons_addon_idx   on public.booking_addons (trip_addon_id);

-- ── 4. updated_at triggers (reuse existing helper) ──────────────────────────
drop trigger if exists set_trip_addons_updated_at on public.trip_addons;
create trigger set_trip_addons_updated_at before update on public.trip_addons
  for each row execute function public.update_updated_at_column();
drop trigger if exists set_booking_addons_updated_at on public.booking_addons;
create trigger set_booking_addons_updated_at before update on public.booking_addons
  for each row execute function public.update_updated_at_column();

-- ── 5. RLS: reads for customers/admins; ALL writes go through the service role ──
alter table public.trip_addons    enable row level security;
alter table public.booking_addons enable row level security;

-- Catalog: anyone may read ACTIVE add-ons (mirrors "Anyone can view active trips").
-- Admins read everything through the service-role API, so no extra policy needed.
grant select on public.trip_addons to anon, authenticated;
create policy "Anyone can view active add-ons"
  on public.trip_addons for select to public
  using (is_active = true);

-- Snapshots: a user sees add-ons on THEIR bookings; admins see all.
grant select on public.booking_addons to authenticated;
create policy "Users can view their booking add-ons"
  on public.booking_addons for select to public
  using (exists (select 1 from public.bookings b
                 where b.id = booking_addons.booking_id and b.user_id = auth.uid()));
create policy "Admins can view all booking add-ons"
  on public.booking_addons for select to public
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and (p.role)::text = 'admin'));

grant all on public.trip_addons    to service_role;
grant all on public.booking_addons to service_role;
