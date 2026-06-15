-- Singleton settings row for the self-hosted WhatsApp worker.
-- Stores the last-known linked number + connection state so the admin panel
-- can show it without hitting the VPS on every page load. Source of truth is
-- still the worker's /status; this is just a cache the proxy keeps fresh.
create table if not exists public.whatsapp_settings (
  id               smallint primary key default 1,
  connected        boolean      not null default false,
  connected_number text,
  updated_at       timestamptz  not null default now(),
  constraint whatsapp_settings_singleton check (id = 1)
);

insert into public.whatsapp_settings (id) values (1)
  on conflict (id) do nothing;

-- Admin-only data; accessed via the service-role key from the API. Lock out anon/auth.
alter table public.whatsapp_settings enable row level security;
