-- Admin address book: hotels, transport, drivers, guides, trip captains,
-- vendors, partners and emergency numbers used to run trips.
-- Service role only (RLS on, no policies): read and written by admin routes.

create table if not exists public.admin_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other'
    check (category in ('hotel', 'transport', 'driver', 'guide', 'captain', 'food', 'partner', 'emergency', 'other')),
  company text,
  phone text,
  alt_phone text,
  whatsapp boolean not null default true,
  email text,
  location text,                   -- city / area, e.g. 'Kasol', 'Delhi (Kashmere Gate)'
  address text,
  map_url text,
  rates text,                      -- free text, e.g. '₹1,800 / room / night, breakfast incl.'
  rating smallint check (rating between 1 and 5),
  trip_ids uuid[] not null default '{}',
  notes text,
  is_favorite boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_contacts_category_idx on public.admin_contacts (category);

alter table public.admin_contacts enable row level security;
revoke all on public.admin_contacts from anon, authenticated;
