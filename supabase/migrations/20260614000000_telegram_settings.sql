create table if not exists public.telegram_settings (
  id integer primary key default 1,
  enabled boolean not null default false,
  bot_token text,
  bot_username text,
  admin_chat_ids text[] not null default '{}',
  webhook_secret text,
  notify_new_booking boolean not null default true,
  notify_payments boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint telegram_settings_singleton check (id = 1)
);

insert into public.telegram_settings (id) values (1) on conflict (id) do nothing;

-- Holds the bot token (secret): lock it to the service role only.
alter table public.telegram_settings enable row level security;
