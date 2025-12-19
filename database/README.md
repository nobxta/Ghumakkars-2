# Database Migration Files

This folder contains all SQL migration files for the Ghumakkars database schema.

## Main Schema File

**`supabase-schema.sql`** - The main schema file that creates the core tables (trips, bookings, profiles) and basic RLS policies. Run this first when setting up a new database.

## Migration Files (Run in Order)

The following files contain incremental schema updates and should be run after the main schema:

1. `supabase-otp-table.sql` - OTP codes table for authentication
2. `supabase-profile-enhancements.sql` - Profile table enhancements
3. `supabase-trips-enhancement.sql` - Trip table enhancements
4. `supabase-booking-enhancement.sql` - Booking table enhancements
5. `supabase-payment-modes.sql` - Payment modes support
6. `supabase-payment-transactions.sql` - Payment transactions table
7. `supabase-payment-settings-coupons.sql` - Payment settings and coupons tables
8. `supabase-coupon-enhancements.sql` - Coupon system enhancements
9. `supabase-referral-system.sql` - Referral system (initial)
10. `supabase-referral-system-update.sql` - Referral system updates
11. `supabase-referral-reward-fix.sql` - Referral reward fixes
12. `supabase-referral-reward-configurable.sql` - Configurable referral rewards
13. `supabase-bookings-wallet-fix.sql` - Wallet integration for bookings
14. `supabase-transaction-id-update.sql` - Transaction ID updates
15. `supabase-booking-rejection-reason.sql` - Booking rejection reason field
16. `supabase-trip-management-enhancements.sql` - Trip management improvements
17. `supabase-rpc-increment-participants.sql` - RPC function for incrementing participants
18. `supabase-rpc-increment-coupon-usage.sql` - RPC function for coupon usage
19. `supabase-admin-activity-log.sql` - Admin activity logging
20. `supabase-storage-buckets.sql` - Storage bucket setup
21. `supabase-schema-update.sql` - General schema updates

## Setup Instructions

1. Start with `supabase-schema.sql` to create the base schema
2. Run the migration files in chronological order based on when features were added
3. Some migrations may conflict if run out of order - check for `IF NOT EXISTS` clauses
4. Always test migrations on a development database first

## Notes

- Most migrations use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` to be idempotent
- Some migrations may need to be adapted if you're starting fresh
- Refer to `DOCUMENTATION.md` in the root directory for complete database schema documentation

