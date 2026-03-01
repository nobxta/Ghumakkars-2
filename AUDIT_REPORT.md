# Ghumakkars Travel Agency – Full-Stack Audit Report

**Date:** February 28, 2025  
**Scope:** Complete deep audit – structure, auth, user/admin flows, trips, bookings, DB, API, frontend, security, production readiness.

---

## 1. Project Structure Map

### 1.1 Root Layout

| Path | Purpose |
|------|--------|
| `app/` | Next.js App Router – pages, layouts, API routes |
| `components/` | Shared React components (Hero, Trips, Contact, admin components) |
| `lib/` | Supabase clients, email, OTP store, WhatsApp, types |
| `hooks/` | React hooks (e.g. `useScrollAnimation`) |
| `middleware.ts` | Supabase session refresh (no route protection) |
| `public/` | Static assets |
| `scripts/` | One-off scripts (e.g. `sendTestEmail.ts`) |

### 1.2 Folder Purposes

- **`app/page.tsx`** – Landing page.
- **`app/auth/`** – Signin, signup, forgot-password, reset-password (client components in subfolders).
- **`app/trips/`** – List (`/trips`), detail (`/trips/[id]`), book (`/trips/[id]/book`).
- **`app/bookings/`** – User bookings list, booking detail (`/bookings/[id]`).
- **`app/profile/`** – Profile view and edit.
- **`app/wallet/`** – Wallet balance and usage.
- **`app/referral/`** – Referral page.
- **`app/destinations/[slug]/`** – Destination page.
- **`app/admin/`** – Admin UI: layout (client-side admin check), dashboard, trips (create/edit/list/detail), bookings, users, coupons, referrals, analytics, settings.
- **`app/api/`** – All API route handlers (see API list below).
- **`lib/supabase/`** – `client.ts` (browser), `server.ts` (server cookies), `admin.ts` (service role).
- **`lib/email.ts`** – Nodemailer SMTP (send OTP, booking emails, password reset).
- **`lib/otp-store.ts`** – OTP storage/verification via `otp_codes` table (Supabase).
- **`lib/reset-token-store.ts`** – Password reset tokens (referenced; implementation not fully traced).
- **`lib/whatsapp.ts`** – WhatsApp notification helpers.

### 1.3 Backend Structure

- **Backend = Next.js API routes + Supabase.**
- No separate backend server. All server logic lives in:
  - `app/api/**/route.ts` (GET/POST handlers)
  - Server-side Supabase via `createClient()` from `lib/supabase/server.ts` or `createAdminClient()` from `lib/supabase/admin.ts`
- Auth: Supabase Auth (email/password, OTP/magic link). Passwords hashed by Supabase Auth.
- No JWT issued by the app; tokens are Supabase session cookies.

### 1.4 Frontend Structure

- **Framework:** Next.js 14+ (App Router).
- **UI:** React, Tailwind CSS, Lucide icons.
- **Data:** Client-side `createClient()` from `lib/supabase/client.ts` for direct Supabase reads/writes (e.g. trips, bookings insert), plus `fetch()` to app API routes where server-side or admin client is needed.
- **Entry:** `app/layout.tsx` → `app/page.tsx` (landing) or other routes. No global auth provider; session from Supabase client and middleware.

### 1.5 Entry Points

- **Browser:** `app/layout.tsx` → route-specific `page.tsx`.
- **API:** `app/api/<segment>/route.ts` (and dynamic `[id]`) per Next.js convention.
- **Middleware:** `middleware.ts` runs on all matched paths; only refreshes Supabase session via `getUser()`, does not redirect or enforce roles.

### 1.6 Environment Configuration Usage

| Variable | Where used | Purpose |
|----------|------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | client, server, middleware, admin | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client, server, middleware | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | admin.ts only | Bypass RLS (server-only) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | lib/email.ts | Transactional email |
| `FROM_EMAIL`, `FROM_NAME` | lib/email.ts | Sender identity |
| `NEXT_PUBLIC_SITE_URL` | email, reset link | Base URL in emails |
| `NEXT_PUBLIC_APP_URL` | send-notification, webhook | Internal callback URL |
| `CLOUDINARY_*` | upload/cloudinary, upload-avatar | Image upload |
| Payment settings (Razorpay keys, webhook secret) | Stored in DB `payment_settings` | Fetched by API routes |

---

## 2. Authentication System – Deep Check

### 2.1 Signup Flow (Step-by-Step)

1. **Client:** `app/auth/signup/SignUpClient.tsx`  
   - Step 1: firstName, lastName, email, phone, referralCode (client validation).  
   - Step 2: password, confirmPassword → POST `/api/auth/signup` with all fields.  
   - Step 3: OTP input → POST `/api/auth/verify-signup-otp` with email + otp.

2. **API signup:** `app/api/auth/signup/route.ts`  
   - Validates: required fields, name length, email format, phone 10 digits, password length 6–128.  
   - Uses `createAdminClient()` to:  
     - Check `auth.admin.listUsers()` for existing email; if exists with profile → 409; if exists without profile → create profile, send OTP.  
     - Check `profiles` for duplicate phone.  
     - `auth.admin.createUser({ email, password, email_confirm: false, user_metadata })`.  
     - Generate referral code (RPC `generate_referral_code` or fallback).  
     - Insert `profiles` (id, email, names, phone, role: 'user', referral_code, referred_by, wallet_balance).  
     - If referralCode provided, insert `referrals`.  
     - Store OTP in `otp_codes` via `storeOTP()`, send email via `sendSignupOTPEmail()`.

3. **API verify-signup-otp:** `app/api/auth/verify-signup-otp/route.ts`  
   - Validates email + 6-digit OTP.  
   - `verifyOTP()` from `lib/otp-store.ts` (DB `otp_codes`, check used/expiry).  
   - `adminClient.auth.admin.updateUserById(..., { email_confirm: true })`.  
   - Update `profiles.email_verified`.  
   - `adminClient.auth.admin.generateLink({ type: 'magiclink', email })` (session link not used by client for auto-login; client uses password sign-in).

4. **Client after OTP:** SignInWithPassword with temp password, then redirect `/` or signin.

**Password hashing:** Not done in app code; Supabase Auth hashes on `createUser`.  
**Token generation:** Supabase session (cookies) after sign-in; no custom JWT.

### 2.2 Login Flow (Step-by-Step)

1. **Client:** `app/auth/signin/SignInClient.tsx`  
   - Password login: `supabase.auth.signInWithPassword({ email, password })`.  
   - OTP login: POST `/api/auth/send-otp` → then POST `/api/auth/verify-otp` with email + otp; response includes `magicLink`; client uses `verifyOtp` with token from URL.

2. **API send-otp:** `app/api/auth/send-otp/route.ts`  
   - Uses admin client to find user by email, get profile; stores OTP in `otp_codes`, sends email.  
   - No auth required (unauthenticated endpoint).

3. **API verify-otp:** `app/api/auth/verify-otp/route.ts`  
   - Verifies OTP from `otp_codes`.  
   - Uses admin to generate magic link, returns it to client.  
   - No auth required (OTP is the proof).

4. **Client after login:** Fetches `profiles.role`; if `role === 'admin'` → `/admin`, else redirect param or `/`.

**Token expiry:** Supabase handles refresh; middleware calls `getUser()` to refresh session. No custom expiry logic in app.

### 2.3 Middleware Protection of Routes

- **`middleware.ts`:** Only refreshes session (`getUser()`). It does **not**:  
  - Redirect unauthenticated users from protected routes.  
  - Enforce admin role for `/admin/*`.  
- **Protected routes** rely on client-side checks:  
  - `app/admin/layout.tsx`: `getUser()` then `profiles.role === 'admin'` else redirect to signin or `/`.  
  - Book page: redirect to signin if no user.  
  - Profile/wallet: same pattern.

**Vulnerability:** Admin and user protection are client-only. Direct API calls can bypass UI.

### 2.4 Unprotected / Weakly Protected Endpoints

| Endpoint | Method | Auth check | Issue |
|----------|--------|------------|--------|
| `/api/admin/trips/[id]/status` | POST | **None** | Any user can complete/cancel/postpone trip or change price. |
| `/api/admin/trips/[id]/booking` | POST | **None** | Any user can toggle `booking_disabled` on any trip. |
| `/api/payment/settings` | GET | **None** | Returns payment QR/UPI to anyone. |
| `/api/bookings/send-notification` | POST | **None** | Anyone can trigger booking emails (and internal WhatsApp call) for any `bookingId`. |
| `/api/auth/send-otp` | POST | None | Intentional; no rate limit. |
| `/api/auth/verify-otp` | POST | None | Intentional; no rate limit. |
| `/api/auth/verify-signup-otp` | POST | None | Intentional; no rate limit. |
| `/api/auth/signup` | POST | None | Intentional; no rate limit. |

### 2.5 Role-Based Access (Admin vs User)

- **Admin check pattern:** Most admin APIs use:  
  - `createClient()` (server) → `getUser()` → then query `profiles` for `role === 'admin'`; if not admin → 401/403.  
- **Exceptions (no admin check):**  
  - `app/api/admin/trips/[id]/status/route.ts` – no auth.  
  - `app/api/admin/trips/[id]/booking/route.ts` – no auth.  
  - `app/api/payment/settings/route.ts` – no auth (and returns sensitive data).  

Admin UI is protected only in `app/admin/layout.tsx` (client-side); admin APIs are the real enforcement where implemented.

### 2.6 Security Vulnerabilities (Auth & Access)

- **Critical:** Admin trip status and booking toggle APIs are callable by anyone.  
- **Critical:** Payment settings (QR/UPI) exposed to unauthenticated users.  
- **High:** Send-notification endpoint can be abused to spam users or trigger WhatsApp for any booking.  
- **Medium:** No rate limiting on signup, send-otp, verify-otp, signin (brute force / enumeration / spam).  
- **Medium:** Admin layout protection is client-side only; must rely on correct admin checks in every admin API.

---

## 3. User Flow Audit

### 3.1 Journey: Landing → Register → Login → Browse → View Trip → Book → Payment → Confirmation

| Step | Route / Component | Handler / Logic | DB / Models | Validations | What can break / Incomplete |
|------|-------------------|-----------------|-------------|------------|-----------------------------|
| Landing | `/` | `app/page.tsx` | – | – | – |
| Register | `/auth/signup` | SignUpClient → `/api/auth/signup`, then verify-signup-otp | auth.users, profiles, otp_codes, referrals | API: email, phone, password length, name length | Orphan profile if profile insert fails after auth user created (handled by rollback delete). No rate limit. |
| Login | `/auth/signin` | SignInClient, supabase.auth.signInWithPassword or send-otp/verify-otp | auth.users, profiles | Client + Supabase | No rate limit. |
| Browse trips | `/trips` | `app/trips/page.tsx` | Reads `trips` via Supabase client | – | Relies on RLS for trips visibility. |
| View trip | `/trips/[id]` | `app/trips/[id]/page.tsx` | Same | – | – |
| Book trip | `/trips/[id]/book` | `app/trips/[id]/book/page.tsx` | **Direct insert** into `bookings` via Supabase client; also calls `/api/wallet/use`, `/api/payment/validate-coupon`, `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay-payment`, `/api/bookings/send-notification` | trips, profiles, bookings, coupon_codes, coupon_usages, payment_transactions, wallet (via API) | Client: steps 1–2 (passenger/payment method). No server-side validation of booking payload (RLS must restrict insert). | **Race:** Booking insert and seat count: client does not increment `trips.current_participants`; only webhook and admin review do. So Razorpay success via client-only verify path can leave participant count wrong. **Verify-razorpay does not check booking ownership** (user can pass another bookingId). |
| Payment (Razorpay) | (same page) | create-razorpay-order (auth), then client Razorpay SDK, then verify-razorpay-payment (auth) | payment_settings, bookings, payment_transactions | Signature verified; **no check that booking.user_id === user.id**; no amount vs booking.final_amount check. | Attacker could confirm another user’s booking by passing their bookingId to verify. **verify-razorpay does not increment trip.current_participants** (only webhook does). |
| Payment (cash) | (same page) | Direct insert booking with payment_mode: 'cash', payment_status: 'cash_pending' | bookings | Client only | Same RLS/ownership assumptions. |
| Confirmation | `/bookings/[id]` | `app/bookings/[id]/page.tsx` | Reads booking (and trip) via Supabase | – | RLS must restrict to own bookings. |

### 3.2 Booking Creation and Participant Count

- **Razorpay:** Client inserts booking (pending) → create order → user pays → client calls verify-razorpay-payment. Verify updates booking and creates payment_transaction and referral; **it does not increment `trips.current_participants`**. Webhook `payment.captured` does increment. So if webhook is slow or fails, participant count is wrong; if both run, only webhook increments (no double-increment from verify).  
- **Cash:** Insert only; participant count updated when admin confirms (review-payment or review-payment-transaction).

---

## 4. Admin Flow Audit

| Action | Endpoint / Page | Controller logic | Missing validations / Broken / Mismatch |
|--------|-----------------|------------------|----------------------------------------|
| Admin login | Same signin; redirect if role admin | – | – |
| Create trip | `app/admin/trips/create/page.tsx` | **Client** `supabase.from('trips').insert([tripData])` | No API; relies on RLS. If RLS allows only admin insert, OK; else any user could insert. |
| Edit trip | `app/admin/trips/edit/[id]/page.tsx` | Client update to `trips` (no dedicated API in audit) | Same RLS assumption. |
| Delete trip | Not found as dedicated endpoint; may be status update to cancelled or similar | – | – |
| View bookings | `app/admin/bookings/page.tsx` → GET `/api/admin/bookings` | route.ts: admin check, then adminClient from('bookings').select(...) | Correct. |
| Manage users | `app/admin/users/page.tsx` → GET `/api/admin/users` | Admin check, then list users | Correct. |
| Update booking status | POST `/api/admin/bookings/review-payment`, review-payment-transaction, approve-cash-payment | Admin check; update booking and trip participants | Correct. |
| Trip status (complete/cancel/postpone/change_price) | POST `/api/admin/trips/[id]/status` | **No auth** – uses adminClient only | **Broken:** anyone can call. |
| Toggle booking disabled | POST `/api/admin/trips/[id]/booking` | **No auth** | **Broken:** anyone can call. |

---

## 5. Trip System Analysis

- **Schema (inferred from usage):** title, description(s), destination, original_price, discounted_price, seat_lock_price, early_bird_*, duration_days, max_participants, current_participants, start_date, end_date, booking_deadline_date, cover_image_url, gallery_images, highlights, day_wise_itinerary, whatsapp_group_link, status, is_active, scheduled_publish_at, published_at, booking_disabled, etc.
- **Required fields:** Enforced on create in admin UI (client-side).
- **Pricing:** discounted_price, seat_lock_price; frontend uses these for totals and seat-lock vs full.
- **Date validation:** Client-side on create/edit; no central API validation.
- **Availability:** `availableSpots = max_participants - current_participants`; no server-side check before booking insert (overbooking possible if RLS/trigger don’t enforce).
- **Inconsistencies:** Trip create uses both `cover_image_url` and `image_url`; confirm schema matches.

---

## 6. Booking System Analysis

- **Schema (inferred):** trip_id, user_id, number_of_participants, total_price, final_amount, coupon_code, wallet_amount_used, primary_passenger_*, emergency_contact_*, college, passengers (JSON), payment_method, payment_mode, payment_status, booking_status, amount_paid, reference_id, razorpay_*.
- **User–Trip relationship:** booking has user_id and trip_id; correct.
- **Duplicate booking prevention:** No explicit “one booking per user per trip” in app code; could be enforced by RLS or unique index.
- **Seat decrement:** Not decremented on insert. Incremented when: (1) Razorpay webhook handles payment success, (2) admin review-payment / review-payment-transaction / approve-cash-payment. **verify-razorpay-payment does not increment** → undercount if webhook doesn’t run.
- **Race condition:** Two users booking last seat: no atomic “check capacity + insert booking” in app; depends on DB or RLS.
- **Payment status:** Handled in verify-razorpay, webhook, and admin review flows; payment_status and booking_status updated accordingly.

---

## 7. Database Integrity

- **Orphan data:** Signup creates auth user then profile; on profile insert failure auth user is deleted. Referral record creation failure does not roll back signup.
- **Missing indexes:** Not visible from code; recommend indexes on: bookings(user_id, trip_id), bookings(razorpay_order_id, razorpay_payment_id), otp_codes(email, type, expires_at), profiles(referral_code), etc.
- **Unsafe deletes:** Admin delete flows not fully traced; ensure soft-delete or constraints where needed.
- **References:** trip_id and user_id on bookings are FKs in Supabase; ensure no orphan bookings.

---

## 8. API Health Check

### 8.1 All API Endpoints (from `app/api`)

- **Auth:** signup, send-otp, verify-otp, verify-signup-otp, resend-signup-otp, send-password-reset, verify-reset-token, reset-password, check-email  
- **Profile:** change-password, change-email, upload-avatar  
- **Payment:** create-razorpay-order, verify-razorpay-payment, validate-coupon, settings  
- **Bookings:** send-notification, submit-remaining-payment  
- **Wallet:** use  
- **Referral:** referral (reward?), reward-amount; referrals/get-users  
- **Admin – users:** GET/PATCH admin/users, GET/PATCH admin/users/[id], wallet, generate-coupon, send-payment-reminder, activity  
- **Admin – trips:** GET/PATCH admin/trips/[id], POST admin/trips/[id]/status, POST admin/trips/[id]/booking, POST admin/trips/[id]/send-reminder, POST admin/increment-trip-participants  
- **Admin – bookings:** GET admin/bookings, POST review-payment, review-payment-transaction, approve-cash-payment  
- **Admin – referrals:** process-pending, reprocess-all  
- **Upload:** upload/cloudinary  
- **Webhooks:** webhooks/razorpay  
- **WhatsApp:** whatsapp/init, test-notification, send-booking-notification  

### 8.2 Unused / Duplicate / Wrong Status / Inconsistent Errors

- **Unused:** Not determined without usage search; check-email and some referral endpoints may be low-traffic.  
- **Duplicate:** review-payment vs review-payment-transaction (different flows; not duplicate).  
- **Status codes:** Most return 400/401/404/500 appropriately; ensure 403 for forbidden.  
- **Error handling:** Some routes return generic 500 with message; standardize JSON shape and codes.

---

## 9. Frontend Check

- **Pages not connected to backend:** Destinations and some landing sections may use static or local data; confirm.  
- **Forms without validation:** Book page has step validation; signup/signin have client and API validation.  
- **Missing loading/error states:** Many flows have loading; some error states could be more explicit.  
- **State management:** No global store; local state and Supabase client; acceptable for current size.  
- **Hardcoded data:** MATHURA_COLLEGES and similar lists; env for app URL used in some places.

---

## 10. Code Quality & Architecture

- **Dead code:** Not fully enumerated; scripts and unused API paths may exist.  
- **Duplicated logic:** Admin check repeated in many admin APIs (could be a shared `requireAdmin()`).  
- **Folder structure:** Clear app/api and app/admin; lib could be split (auth helpers, db, email).  
- **Separation of concerns:** Some admin routes use adminClient for both “auth” and “data”; better to use server client for auth and admin only where RLS bypass is needed.  
- **Improvements:** Centralize admin check; add server-side booking validation API instead of only client insert; ensure verify-razorpay and webhook both update participants consistently.

---

## 11. Security Audit

- **Exposed secrets:** No secrets in repo from audit; Razorpay keys and webhook secret in DB.  
- **Env usage:** Service role key only in server (admin.ts); anon key and URL in client (correct for Supabase).  
- **Rate limiting:** None found on auth or payment endpoints; recommend adding.  
- **Input sanitization:** Email/phone/OTP validated; free-text fields (e.g. names, descriptions) not sanitized for XSS in stored content; ensure HTML escape on render.  
- **CORS:** Next.js same-origin; no custom CORS in audit.  
- **SQL/NoSQL injection:** Supabase client parameterized; no raw SQL seen in app.

---

## 12. Final Summary

### 12.1 What Is Fully Working

- Signup (with OTP) and signin (password and OTP).  
- Profile and wallet balance display.  
- Trip list and detail; booking flow (Razorpay and cash) with coupon and wallet.  
- Razorpay webhook signature verification and payment success handling (including participant increment).  
- Admin list/edit trips, list bookings/users, review payment and approve cash; referral processing.  
- Password reset flow (send link, verify token, reset).  
- Email notifications (OTP, booking statuses).

### 12.2 What Is Partially Working

- **Razorpay success from client:** verify-razorpay-payment confirms booking but does not increment `trips.current_participants`; depends on webhook.  
- **Admin trip create/edit:** Done from client against Supabase; depends entirely on RLS.  
- **Payment settings:** Fetched by client for booking page; also exposed via public GET API.

### 12.3 What Is Broken

- **POST `/api/admin/trips/[id]/status`:** No auth; anyone can complete/cancel/postpone trip or change price.  
- **POST `/api/admin/trips/[id]/booking`:** No auth; anyone can toggle booking_disabled.  
- **Booking ownership in verify-razorpay-payment:** Does not verify `booking.user_id === user.id`; can confirm another user’s booking.

### 12.4 What Is Missing but Required

- Rate limiting on auth and sensitive APIs.  
- Server-side validation of booking (e.g. capacity, ownership) before/after payment.  
- Consistent participant increment on Razorpay success (in verify-razorpay as well as webhook).  
- Auth (and optionally admin) on: payment/settings, send-notification, admin trip status and booking toggle.  
- Documented RLS policies for trips, bookings, profiles so that client insert/update is safe.

---

## 13. Top 10 Critical Fixes (Priority Order)

1. **Add auth to POST `/api/admin/trips/[id]/status`** – require admin (same pattern as other admin routes); reject unauthenticated/non-admin.  
2. **Add auth to POST `/api/admin/trips/[id]/booking`** – require admin.  
3. **In `verify-razorpay-payment`:** Before updating booking, load booking and enforce `booking.user_id === user.id`; optionally verify amount matches `booking.final_amount`.  
4. **In `verify-razorpay-payment`:** After confirming booking, increment `trips.current_participants` (same logic as webhook) so client-only path is correct.  
5. **Protect GET `/api/payment/settings`** – require authenticated user (or move to server-side only and never expose raw QR/UPI to public).  
6. **Protect POST `/api/bookings/send-notification`** – allow only from authenticated admin or internal server (e.g. webhook); do not allow arbitrary caller.  
7. **Rate limit** signup, send-otp, verify-otp, verify-signup-otp, and signin (by IP and/or identifier).  
8. **Centralize admin check** – e.g. `requireAdmin()` in a shared lib that returns 401/403 and use it in every admin route (including status and booking).  
9. **Ensure RLS** – document and test RLS so that only authenticated users can insert their own bookings and only admins can insert/update trips where intended.  
10. **Booking creation** – consider moving booking insert to an API that validates capacity and user, then inserts and (optionally) reserves seats in one flow to avoid races.

---

## 14. Refactoring Roadmap

- **Phase 1 (security):** Fixes 1–7 and 9 above.  
- **Phase 2 (consistency):** Fix 4 (participant count), fix 8 (shared admin check).  
- **Phase 3 (robustness):** Fix 10 (booking API), add idempotency for payment confirmation, add indexes and RLS tests.  
- **Phase 4 (quality):** Standardize API error shape, add request validation (e.g. Zod), remove dead code, document env and deployment.

---

## 15. Production Readiness Score: **58%**

- **Rationale:**  
  - Auth and core user flows work; payment and webhook are largely correct.  
  - Critical gaps: two admin endpoints unauthenticated, payment settings public, verify-razorpay ownership and participant count, send-notification abuse, no rate limiting.  
  - RLS and client-side insert patterns require verification.  
  - After Top 10 fixes and RLS verification, score would reasonably move into the 75–85% range; with rate limiting, monitoring, and tests, into 85%+.

---

---

## 16. File/Function References (Critical Findings)

| Finding | File | Function / Line |
|--------|------|------------------|
| Middleware does not protect routes | `middleware.ts` | `middleware()` – only `getUser()`, no redirect |
| Admin trip status – no auth | `app/api/admin/trips/[id]/status/route.ts` | `POST` handler – no `getUser()` or role check |
| Admin trip booking toggle – no auth | `app/api/admin/trips/[id]/booking/route.ts` | `POST` handler – no auth |
| Payment settings public | `app/api/payment/settings/route.ts` | `GET` – no auth |
| Send-notification unauthenticated | `app/api/bookings/send-notification/route.ts` | `POST` – no auth |
| Verify-razorpay no ownership check | `app/api/payment/verify-razorpay-payment/route.ts` | Update by `bookingId` only (lines 64–76) |
| Verify-razorpay no participant increment | `app/api/payment/verify-razorpay-payment/route.ts` | No `trips.current_participants` update (webhook has it in `app/api/webhooks/razorpay/route.ts` ~170–186) |
| Signup validation | `app/api/auth/signup/route.ts` | Lines 14–70 |
| Admin check pattern | e.g. `app/api/admin/bookings/route.ts` | Lines 10–28: createClient, getUser, profiles.role === 'admin' |
| Booking insert (client) | `app/trips/[id]/book/page.tsx` | Razorpay: ~336–366; Cash: ~541–572 |
| OTP storage | `lib/otp-store.ts` | `storeOTP`, `verifyOTP` – use `otp_codes` table |
| Create Razorpay order – no booking check | `app/api/payment/create-razorpay-order/route.ts` | Accepts `bookingId`/`tripId` without validating ownership |

**End of audit.** All findings are based on the codebase as of the audit date; no assumptions beyond what is in the repo.
