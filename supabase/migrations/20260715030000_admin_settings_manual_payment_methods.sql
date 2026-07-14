create table if not exists public.admin_general_settings (
  id smallint primary key default 1,
  email_notifications boolean not null default true,
  booking_alerts boolean not null default true,
  weekly_reports boolean not null default false,
  maintenance_mode boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_general_settings_singleton check (id = 1)
);

insert into public.admin_general_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists public.manual_payment_methods (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  upi_id text not null,
  payee_name text not null,
  qr_image_url text,
  qr_image_public_id text,
  instructions text,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_payment_methods_upi_format check (upi_id ~* '^[a-z0-9._-]{2,255}@[a-z][a-z0-9._-]{2,64}$')
);

create unique index if not exists manual_payment_methods_one_default
  on public.manual_payment_methods ((is_default))
  where is_default = true;

create index if not exists idx_manual_payment_methods_enabled_order
  on public.manual_payment_methods (is_enabled, is_default desc, display_order asc, created_at asc);

alter table public.bookings add column if not exists manual_payment_method_id uuid;
alter table public.bookings add column if not exists manual_payment_snapshot jsonb;
alter table public.payment_transactions add column if not exists manual_payment_method_id uuid;
alter table public.payment_transactions add column if not exists manual_payment_snapshot jsonb;

insert into public.manual_payment_methods (
  nickname,
  upi_id,
  payee_name,
  qr_image_url,
  is_enabled,
  is_default,
  display_order
)
select
  'Primary UPI',
  payment_upi_id,
  'Ghumakkars',
  payment_qr_url,
  true,
  true,
  0
from public.payment_settings
where payment_upi_id is not null
  and payment_upi_id <> ''
  and not exists (select 1 from public.manual_payment_methods);

create or replace function public.update_admin_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists update_admin_general_settings_updated_at on public.admin_general_settings;
create trigger update_admin_general_settings_updated_at
  before update on public.admin_general_settings
  for each row
  execute function public.update_admin_settings_updated_at();

drop trigger if exists update_manual_payment_methods_updated_at on public.manual_payment_methods;
create trigger update_manual_payment_methods_updated_at
  before update on public.manual_payment_methods
  for each row
  execute function public.update_admin_settings_updated_at();

alter table public.admin_general_settings enable row level security;
alter table public.manual_payment_methods enable row level security;

grant select on public.manual_payment_methods to anon, authenticated;
grant select, update on public.admin_general_settings to authenticated;
grant insert, update, delete on public.manual_payment_methods to authenticated;

drop policy if exists "Admins can read general settings" on public.admin_general_settings;
create policy "Admins can read general settings"
  on public.admin_general_settings for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update general settings" on public.admin_general_settings;
create policy "Admins can update general settings"
  on public.admin_general_settings for update
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Anyone can read enabled manual methods" on public.manual_payment_methods;
create policy "Anyone can read enabled manual methods"
  on public.manual_payment_methods for select
  using (is_enabled = true);

drop policy if exists "Admins can manage manual methods" on public.manual_payment_methods;
create policy "Admins can manage manual methods"
  on public.manual_payment_methods for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
