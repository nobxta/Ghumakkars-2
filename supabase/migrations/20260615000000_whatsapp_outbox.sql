create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,                 -- digits only, e.g. 919876543210
  kind text not null,                     -- otp | seat_locked | confirmed | rejected | cancelled | remaining_reminder | custom
  body text not null,                     -- the message text
  media_url text,                         -- optional: a public PDF/image URL to attach
  media_filename text,                    -- optional: filename for documents (e.g. ticket.pdf)
  status text not null default 'pending', -- pending | sending | sent | failed
  attempts integer not null default 0,
  dedupe_key text unique,                 -- optional: prevents duplicate sends
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_wa_outbox_pending on public.whatsapp_outbox (created_at) where status = 'pending';

alter table public.whatsapp_outbox enable row level security;
