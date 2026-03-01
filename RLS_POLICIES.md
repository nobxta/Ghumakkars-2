# Supabase RLS (Row Level Security) Policies – Recommended

## Environment (for server-to-server protection)

- **`INTERNAL_API_SECRET`** (optional but recommended): Set a random secret. When set, server-side calls to `POST /api/bookings/send-notification` (e.g. from the Razorpay webhook or other API routes) must send header `x-internal-secret: <value>`. If unset, internal requests are not accepted (only admin or booking owner can call send-notification).

This document describes the RLS policies that should be in place so that client-side Supabase access is safe. Apply these in the Supabase Dashboard (SQL Editor or Table Editor → RLS).

## 1. `profiles`

- **SELECT**: Authenticated users can read their own row (`id = auth.uid()`). Service role bypasses RLS.
- **INSERT**: Only service role (or a trigger from `auth.users` insert) should insert. If app creates profiles via API with admin client, no direct client insert needed.
- **UPDATE**: Users can update their own row (`id = auth.uid()`). Admin updates via API with service role.
- **DELETE**: Prefer no direct delete; or restrict to service role only.

## 2. `trips`

- **SELECT**: Allow read for active/draft trips as needed. Typical: `is_active = true` OR `status = 'active'` for anon/authenticated so the landing and trip list work. Stricter: only authenticated can read. Admin sees all via API (service role).
- **INSERT**: Only admins. Implement by: allow if `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`. If admin trip create is done only from server (API) with service role, you can disable client insert and leave INSERT to service role only.
- **UPDATE**: Same as INSERT – only admin or service role.
- **DELETE**: Only admin or service role.

## 3. `bookings`

- **SELECT**: Users can read their own bookings (`user_id = auth.uid()`). Admin reads via API (service role).
- **INSERT**: Option A: Allow authenticated users to insert with `user_id = auth.uid()` only (enforce in policy). Option B: Disable client insert and create bookings only via API (recommended after adding POST /api/bookings).
- **UPDATE**: Users should not update bookings (only admin/backend). Allow only service role for UPDATE, or admin-only policy.
- **DELETE**: Service role or admin only; or disable.

## 4. `payment_transactions`

- **SELECT**: Users can read transactions for their own bookings (join via `bookings.user_id = auth.uid()`), or restrict to service role only.
- **INSERT**: Only backend (service role) or admin.
- **UPDATE/DELETE**: Service role only.

## 5. `payment_settings`

- **SELECT**: Should not be public. Allow only authenticated users (for booking page) or only service role and serve via API (recommended: GET /api/payment/settings is now protected with requireAuth).
- **INSERT/UPDATE/DELETE**: Service role or admin only.

## 6. `otp_codes`

- **ALL**: Service role only (OTP handled in API with admin client). No client access.

## 7. `coupon_codes`, `coupon_usages`

- **coupon_codes SELECT**: Authenticated can read active coupons for validation; or do validation only in API.
- **coupon_usages**: Insert only via API. Select own usages only if needed.

## 8. `referrals`

- **SELECT**: Users read own (referrer_id or referred_user_id = auth.uid()). Admin via API.
- **INSERT**: Backend only (signup API).

## 9. Indexes (recommended)

- `bookings(user_id, trip_id)` – list user’s bookings, prevent duplicate booking checks.
- `bookings(razorpay_order_id)`, `bookings(razorpay_payment_id)` – webhook lookups.
- `otp_codes(email, type, expires_at)` – OTP verification.
- `profiles(referral_code)` – referral lookup.
- `trips(is_active, start_date)` – listing active trips.

## 10. Enabling RLS

For each table:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- ... etc.
```

Then create policies as above. Test with anon and authenticated roles in the Supabase client to ensure the app still works and no unauthorized access is possible.
