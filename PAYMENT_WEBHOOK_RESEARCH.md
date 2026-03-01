# Razorpay Payment & Webhook – Deep Dive Research

This document summarizes how **Razorpay** (payment API), **webhooks**, and the **post-booking confirmation flow** work in this codebase, and whether they are fully working or partially broken.

---

## 1. Terminology

- **Razorpay** – The payment gateway used (not “reserve pay”). All online payment flows go through Razorpay.
- **Evoke / Invoke** – The “invocation” of the flow: when the user completes payment, both the **frontend callback** (verify-razorpay-payment) and the **Razorpay webhook** can run. The flow is “invoked” by Razorpay’s redirect + your backend APIs.

---

## 2. Is the Razorpay (Payment) API Working?

**Yes, for the main path.**

| Step | API / Code | Status |
|------|------------|--------|
| Create booking | `POST /api/bookings` | ✅ Creates booking (auth required). |
| Create order | `POST /api/payment/create-razorpay-order` | ✅ Creates Razorpay order with `amount`, `bookingId`, `tripId` in notes; returns `orderId`, `keyId`. |
| User pays | Razorpay Checkout (client) | ✅ Uses `order_id`, `key`, etc. |
| Verify payment | `POST /api/payment/verify-razorpay-payment` | ✅ Verifies signature, fetches payment from Razorpay, updates booking, creates `payment_transactions`, increments `trips.current_participants`, processes referral. |

- **Signature verification**: Uses `razorpay_order_id|razorpay_payment_id` with HMAC SHA256 and `payment_settings.razorpay_key_secret` (from DB). Matches Razorpay’s docs.
- **Booking ownership**: Verify route checks `existingBooking.user_id === user.id` before updating.
- **Amount check**: Ensures paid amount ≥ booking `final_amount` (with small tolerance).

So the **Razorpay payment API path** (create order → pay → verify) is implemented correctly and should work.

---

## 3. Are Webhooks Working?

**Partially. Several things can break the webhook path.**

### 3.1 Webhook endpoint and signature

- **Endpoint**: `POST /api/webhooks/razorpay` (see `app/api/webhooks/razorpay/route.ts`).
- **Signature**: Uses raw body and `payment_settings.razorpay_webhook_secret` from DB (not `RAZORPAY_WEBHOOK_SECRET` from `.env`). HMAC SHA256, `.digest('hex')`, compared to `X-Razorpay-Signature`. This matches Razorpay’s “raw body + HMAC SHA256” requirement.
- **Events**: Handles `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid` (logs only).

So **webhook receipt and signature verification** are implemented and can work **if** the webhook secret in **Admin → Payment Settings** is set and matches the one in the Razorpay Dashboard.

### 3.2 Webhook secret source

- The webhook route reads **only** `payment_settings.razorpay_webhook_secret` (database).
- `RAZORPAY_WEBHOOK_SECRET` in `.env.local` is **not** used by the webhook. So the value in `.env` (e.g. `Nobi`) has no effect on webhook verification. You must set the **Webhook Secret in Admin → Settings → Payment** and ensure it matches Razorpay.

### 3.3 Critical bug: webhook cannot find booking if it runs first

**Flow today:**

1. User clicks “Pay with Razorpay” → `POST /api/bookings` creates booking (no `razorpay_order_id` or `razorpay_payment_id` yet).
2. `POST /api/payment/create-razorpay-order` creates order with `receipt: bookingId` but **does not update the booking** with `razorpay_order_id`.
3. User pays; Razorpay sends `payment.captured` webhook and redirects the browser to the success handler.
4. **If the webhook is processed before the client calls verify-razorpay-payment**, the webhook looks up the booking by:
   - `razorpay_payment_id`, or  
   - `razorpay_order_id`
   But at that moment the booking has **neither** stored (they are set only inside `verify-razorpay-payment`). So the webhook query returns no row and you get “Booking not found for payment” and the webhook does not update the booking, send email, or increment participants.

So **webhooks are partially broken**: they work only when the **client verify-razorpay-payment** runs before the webhook. If the webhook runs first (common with fast delivery), it will not find the booking.

**Fix**: When creating the Razorpay order, update the booking with `razorpay_order_id` (and optionally store it in a way the webhook can use). Then the webhook can find the booking by `razorpay_order_id` even when it runs before the client. (A code fix is applied below.)

### 3.4 Webhook → send-notification (email/WhatsApp)

After updating the booking, the webhook calls:

- `POST .../api/bookings/send-notification` with `{ bookingId, status: 'confirmed' }`
- `POST .../api/whatsapp/send-booking-notification` with `{ bookingId }`

Both use `internalFetchHeaders()`, which adds `x-internal-secret: <INTERNAL_API_SECRET>` only if `INTERNAL_API_SECRET` is set in the environment.

- **send-notification** allows the request only if:
  - `isInternalRequest(request)` is true (i.e. `x-internal-secret` matches `INTERNAL_API_SECRET`), **or**
  - The user is admin or the booking owner (with session).
- The webhook request has **no user session**, so it **must** use the internal secret to be accepted.

If `INTERNAL_API_SECRET` is **not** set (as in the current `.env.local`):

- `internalFetchHeaders()` does not send `x-internal-secret`.
- `isInternalRequest(request)` is false.
- send-notification will return **401 Unauthorized** for the webhook’s call.
- Result: **Confirmation email and WhatsApp are not sent when the webhook path is used.**

So **webhooks are partially broken** also in the sense that, without `INTERNAL_API_SECRET`, the webhook cannot trigger send-notification successfully.

**Fix**: Set `INTERNAL_API_SECRET` in your environment (e.g. in `.env.local` and production) to a random secret, and ensure no other caller uses that secret. Then the webhook’s internal calls to send-notification (and optionally WhatsApp) will be accepted.

### 3.5 Summary: webhooks working or not?

| Check | Result |
|-------|--------|
| Webhook URL and handler exist | ✅ |
| Signature verification (HMAC, raw body) | ✅ Correct if DB webhook secret matches Razorpay |
| Webhook secret source | ⚠️ DB only; `.env` value ignored |
| Finding booking when webhook runs first | ❌ Booking not found (no `razorpay_order_id` on booking until verify runs) |
| Webhook → send-notification (email/WhatsApp) | ❌ 401 if `INTERNAL_API_SECRET` not set |

So: **webhooks are only fully working if** (1) the booking is updated with `razorpay_order_id` when the order is created (see fix below), and (2) `INTERNAL_API_SECRET` is set so the webhook can call send-notification.

---

## 4. How It Works After Confirmation (Frontend + Backend)

### 4.1 What the user sees (frontend)

- After successful Razorpay payment, the checkout `handler` runs (in `app/trips/[id]/book/page.tsx`).
- It calls `POST /api/payment/verify-razorpay-payment` with `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `bookingId`.
- If that returns success:
  - It calls `POST /api/bookings/send-notification` with `{ bookingId, status: 'confirmed' }` (so the user’s session is sent; no internal secret needed for this path).
  - Shows “Payment successful! Your booking is confirmed.”
  - Redirects to `/bookings/${bookingData.id}`.

On the **booking details page** (`/bookings/[id]`):

- Fetches booking + trip from Supabase.
- Shows status (e.g. confirmed), trip details, payment info, and options (e.g. pay remaining, view trip).

So from the user’s perspective, after confirmation they see the success message and then the booking details page; behaviour is correct for the **client-verify** path.

### 4.2 What happens in the backend (two paths)

**Path A – Client verify runs first (typical when user stays on page):**

1. `verify-razorpay-payment`: updates booking (paid, confirmed, `razorpay_order_id`, `razorpay_payment_id`), creates payment_transaction, increments trip participants, processes referral.
2. Client calls `send-notification` with session → confirmation email (+ WhatsApp from send-notification).
3. Later, webhook may run: finds booking by `razorpay_order_id`/`razorpay_payment_id`, sees already confirmed, skips (idempotent).

**Path B – Webhook runs first (e.g. user closed tab before verify):**

1. Without the fix: webhook often **does not find** the booking (see 3.3), so it does nothing.
2. With the fix (booking has `razorpay_order_id` when order is created): webhook finds booking, updates it, creates transaction, increments participants, then calls send-notification and WhatsApp. If `INTERNAL_API_SECRET` is set, those calls succeed; if not, they return 401 and no email/WhatsApp from webhook.

So **backend behaviour after confirmation** is correct when the client verify path runs; the webhook path is currently broken for “find booking” and “call send-notification” unless you apply the fixes above.

---

## 5. Recommendations

1. **Store `razorpay_order_id` on the booking when creating the order**  
   In `create-razorpay-order`, after `razorpay.orders.create(options)`, update the booking (by `bookingId`) and set `razorpay_order_id: order.id`. Then the webhook can find the booking even when it runs before the client.

2. **Set `INTERNAL_API_SECRET`**  
   Add to `.env.local` and production a random value, e.g.  
   `INTERNAL_API_SECRET=your-random-secret-here`  
   so that webhook (and any other server-side caller) can successfully call `send-notification` and WhatsApp.

3. **Optional: fallback booking lookup in webhook**  
   If you ever need to support the case where the order was created without updating the booking, the webhook could fetch the Razorpay order by `payment.order_id` and read `order.receipt` (your `bookingId`) and look up the booking by `id` as a fallback.

4. **Webhook secret**  
   Ignore `RAZORPAY_WEBHOOK_SECRET` in `.env` for webhook verification; configure the webhook secret only in **Admin → Settings → Payment** and keep it in sync with the Razorpay Dashboard.

5. **Production URL**  
   For production, set `NEXT_PUBLIC_APP_URL` to your real base URL so webhook callbacks to send-notification and WhatsApp use the correct origin.

---

## 6. Quick reference – flow diagram

```
User pays (Razorpay)
       │
       ├─────────────────────────────────────────────────────────┐
       │                                                         │
       ▼                                                         ▼
Browser handler runs                              Razorpay sends webhook
       │                                                         │
       ▼                                                         ▼
POST /api/payment/verify-razorpay-payment         POST /api/webhooks/razorpay
       │                                                         │
       │  • Verify signature                                      │  • Verify X-Razorpay-Signature
       │  • Fetch payment from Razorpay                            │  • Find booking by payment_id or order_id
       │  • Update booking (paid, confirmed)                      │  • (Currently fails if run first – fix: set order_id on booking when creating order)
       │  • Create payment_transaction                             │  • Update booking, create transaction, increment participants
       │  • Increment trip participants                            │  • POST .../send-notification (needs INTERNAL_API_SECRET)
       │  • Process referral                                       │  • POST .../whatsapp/send-booking-notification
       │                                                         │
       ▼                                                         │
POST /api/bookings/send-notification (with session)               │
       │                                                         │
       ▼                                                         │
Redirect to /bookings/[id]                                       │
```

---

**Conclusion**: The **Razorpay payment API** (create order, verify payment) is working. **Webhooks** are only partially working: signature verification is correct, but (1) the webhook often cannot find the booking when it runs before the client, and (2) it cannot trigger send-notification/WhatsApp without `INTERNAL_API_SECRET`. Applying the two fixes (store `razorpay_order_id` when creating the order, and set `INTERNAL_API_SECRET`) will make the webhook path work end-to-end.
