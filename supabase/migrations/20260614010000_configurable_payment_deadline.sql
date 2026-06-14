-- Global default: balance due N days before departure (used when a trip has no override).
alter table public.payment_settings add column if not exists seat_lock_due_days_before integer not null default 5;

-- Per-trip override (nullable -> falls back to the global default).
alter table public.trips add column if not exists payment_due_days_before integer;
