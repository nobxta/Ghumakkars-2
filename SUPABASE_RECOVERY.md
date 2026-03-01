# Supabase database recovery

## Current status

- **Project:** Ghumakkars (ref: `xlgnerhklrjqjojtdpfg`), linked in this repo.
- **Migrations:** All 22 local migrations are applied on the remote (see `npx supabase migration list`).
- **Schema fix:** `supabase/migrations/20240101000001_supabase_schema.sql` was updated to add `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` so `uuid_generate_v4()` works on a fresh Postgres instance.
- **Seed data:** There is no separate `seed.sql`. Default/seed-like data is inside migrations (e.g. `payment_settings` and `storage.buckets` inserts).

## Using Supabase MCP in Cursor

Your Supabase MCP is configured in Cursor (`mcp.json`) with project ref `xlgnerhklrjqjojtdpfg`. Use these MCP tools when the Supabase MCP server is connected:

1. **Check remote state**
   - `list_migrations` – confirm which migrations are applied.
   - `list_tables` – list public (and other) tables.
   - `list_policies` – list RLS policies.

2. **If remote is empty or missing migrations**
   - `apply_migrations` – apply all local migrations in order.

3. **If you need to run custom SQL**
   - `run_sql` (or equivalent) – run one-off SQL (e.g. verification queries).

4. **After recovery**
   - Call `list_tables` and `list_policies` again to confirm tables and RLS.
   - Confirm indexes, triggers, and functions from your migrations exist (via SQL or MCP if available).

## Using Supabase CLI (alternative)

From the project root:

```bash
# Ensure you're linked and logged in
npx supabase login
npx supabase link --project-ref xlgnerhklrjqjojtdpfg

# Push all migrations (already done; remote is up to date)
npx supabase db push

# Check migration status
npx supabase migration list
```

If the remote was reset but migration history still shows migrations as applied, you can repair and re-push:

```bash
# Mark all migrations as not applied (use with care)
npx supabase migration repair 20240101000001 --status reverted
# ... repeat for each migration, or repair the last one and push
npx supabase db push
```

## Migration order (local)

All under `supabase/migrations/`:

1. `20240101000001_supabase_schema.sql` – core tables (trips, bookings, profiles), RLS, triggers  
2. `20240101000002_supabase_otp_table.sql`  
3. `20240101000003_supabase_profile_enhancements.sql`  
4. `20240101000004_supabase_trips_enhancement.sql`  
5. `20240101000005_supabase_booking_enhancement.sql`  
6. `20240101000006_supabase_payment_modes.sql`  
7. `20240101000007_supabase_payment_transactions.sql`  
8. `20240101000008_supabase_payment_settings_coupons.sql` – payment_settings, coupon_codes, default payment_settings row  
9. `20240101000009_supabase_coupon_enhancements.sql`  
10. `20240101000010_supabase_referral_system.sql`  
11. `20240101000011_supabase_referral_system_update.sql`  
12. `20240101000012_supabase_referral_reward_fix.sql`  
13. `20240101000013_supabase_referral_reward_configurable.sql`  
14. `20240101000014_supabase_bookings_wallet_fix.sql`  
15. `20240101000015_supabase_transaction_id_update.sql`  
16. `20240101000016_supabase_booking_rejection_reason.sql`  
17. `20240101000017_supabase_trip_management_enhancements.sql`  
18. `20240101000018_supabase_rpc_increment_participants.sql`  
19. `20240101000019_supabase_rpc_increment_coupon_usage.sql`  
20. `20240101000020_supabase_admin_activity_log.sql`  
21. `20240101000021_supabase_storage_buckets.sql` – storage bucket inserts  
22. `20240101000022_supabase_schema_update.sql`  

## Verification checklist

- [ ] `list_migrations` (or `supabase migration list`) shows all 22 applied.
- [ ] `list_tables` includes at least: `trips`, `bookings`, `profiles`, `otp_codes`, `payment_settings`, `payment_transactions`, `coupon_codes`, referral/wallet tables, `admin_activity_log`, etc.
- [ ] `list_policies` shows RLS policies on `trips`, `bookings`, `profiles`, and other secured tables.
- [ ] Storage bucket(s) exist (from migration 21).
- [ ] No pending migrations; migration history matches local.

## Verification result (this run)

- **`npx supabase migration list`** – All 22 migrations show as applied on remote (Local and Remote columns match).
- **`npx supabase db push`** – Reported "Remote database is up to date"; no pending migrations.
- **`npx supabase db pull`** – Not run (requires Docker). Use Supabase Dashboard → Table Editor / SQL Editor or MCP `list_tables` / `list_policies` to confirm tables and RLS.

## Note on MCP vs CLI

Recovery was performed using the Supabase CLI because the Supabase MCP tools (`list_migrations`, `apply_migrations`, `run_sql`, `list_tables`, `list_policies`) were not available in this session’s tool set. For future runs, use the Supabase MCP in Cursor when connected so that all database operations go through MCP as intended.
