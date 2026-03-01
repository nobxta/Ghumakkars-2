# WhatsApp Integration – Full Technical Breakdown

## 1. Library and Version

| Item | Value |
|------|--------|
| **Library** | **@whiskeysockets/baileys** (not whatsapp-web.js, open-wa, or official WhatsApp Cloud API) |
| **Exact version** | **6.7.21** (from `package-lock.json`; declared as `^6.7.21` in `package.json`) |
| **Declared as** | `optionalDependencies` in `package.json` |
| **Other deps** | `qrcode`, `pino`, `@hapi/boom` (also optional) |

**References:**
- `package.json` (optionalDependencies): `"@whiskeysockets/baileys": "^6.7.21"`
- `lib/whatsapp.ts`: `require('@whiskeysockets/baileys')`

---

## 2. Where It Is Initialized

- **Single entry point:** `lib/whatsapp.ts` – `WhatsAppService` class and singleton getter `getWhatsAppService()`.
- **API usage:**
  - **POST** `app/api/whatsapp/init/route.ts` – calls `getWhatsAppService()` then `whatsapp.initialize()` (fire-and-forget) and polls for QR/ready.
  - **GET** `app/api/whatsapp/init/route.ts` – calls `getWhatsAppService()` and returns `whatsapp.getReady()`.
  - **POST** `app/api/whatsapp/send-booking-notification/route.ts` – uses same singleton to send messages.
  - **POST** `app/api/whatsapp/test-notification/route.ts` – same singleton for test messages.

**Initialization flow (code path):**
1. Admin clicks “Connect WhatsApp” → `app/admin/settings/page.tsx` → `initializeWhatsApp()` → `POST /api/whatsapp/init`.
2. Route calls `getWhatsAppService()` (creates singleton if needed) and `whatsapp.initialize()` **without awaiting**.
3. Route then polls `whatsapp.getQRCode()` every 500ms (max 20 attempts = 10s) until it gets a QR string or `ready`.
4. Baileys runs inside the Node process; connection and QR are handled in `lib/whatsapp.ts` via `connection.update` and `creds.update`.

---

## 3. Complete Workflow

```
Admin opens /admin/settings → WhatsApp tab
    → GET /api/whatsapp/init → { ready: boolean }
    → If not ready, admin clicks "Connect WhatsApp"
    → POST /api/whatsapp/init
        → getWhatsAppService().initialize() [not awaited]
        → Loop: every 500ms call getQRCode() (max 20x)
            → If getReady() → return { ready: true }
            → If getQRCode() returns string → return { qrCode, qrCodeImage }
        → If 10s elapse with no QR/ready → return "QR not yet available"
    → Frontend shows QR (or "Initializing...") and/or polls GET /api/whatsapp/init every 3s for ready
    → User scans QR in WhatsApp app
    → Baileys emits connection.update(connection: 'close', statusCode 515) then new socket connects
    → connection.update(connection: 'open') → isReady = true, emit('ready')
```

**Booking notification flow:**
- Booking confirmed (e.g. `app/api/bookings/send-notification/route.ts` or Razorpay webhook) → `POST /api/whatsapp/send-booking-notification` with `bookingId`.
- That route loads booking + trip, gets phone number, then `getWhatsAppService()` → `initialize()` if not ready → `waitForReady()` → `sendBookingConfirmation()`.

---

## 4. QR Generation

- **Source:** Baileys emits a QR **string** in `connection.update` when `update.qr` is set.
- **In code:** `lib/whatsapp.ts` lines 134–156:
  - On `connection.update`, if `qr` is present: `this.qrCode = qr`, `this.emit('qr', qr)`.
  - Optional: `qrcode.toDataURL(qr)` for image (result not stored; only logged).
- **How API exposes it:** `getQRCode()` returns `this.qrCode` or waits for `once('qr')` (5s timeout). `getQRCodeImage()` uses `getQRCode()` then `qrcode.toDataURL(qr)`.

---

## 5. Where QR Is Stored/Cached

- **In memory only:** `WhatsAppService.qrCode` (and optionally the image from `getQRCodeImage()` in the API response).
- **Not** persisted to DB, file, S3, or Redis. If the process dies or a new serverless instance runs, the QR is lost and a new one is generated on next init.

---

## 6. Session Storage

- **Mechanism:** Baileys `useMultiFileAuthState('.wwebjs_auth')` in `lib/whatsapp.ts` line 99.
- **Location:** **Local filesystem** under `process.cwd() + '/.wwebjs_auth'` (e.g. `creds.json` and key files).
- **Not:** Database, S3, Redis, or any shared store.
- **Clear:** `clearSession()` deletes the `.wwebjs_auth` directory and calls `destroy()`.

**Implication:** On Vercel/Lambda (or any serverless), the filesystem is ephemeral and/or read-only. Session written in one invocation is not available in the next, so **auth state does not persist across serverless invocations**.

---

## 7. Connection State Tracking

- **In-memory flags in** `lib/whatsapp.ts`:
  - `isReady`: set true on `connection === 'open'`, false on close/logout.
  - `isInitializing`: true from start of `initialize()` until `open` or terminal failure.
  - `qrCode`: current QR string or null.
- **No** DB or external store for “connected” state. Admin panel “connected” = `GET /api/whatsapp/init` → `whatsapp.getReady()` on the **current process**.

---

## 8. What Triggers Logout / Reconnection

**Logout / invalid session (no auto-reconnect):**
- `connection === 'close'` and `statusCode === DisconnectReason.loggedOut` (401) or `badSession` (500):
  - `clearSession()`, set `isReady = false`, `isInitializing = false`, `emit('disconnected')`. User must init again and scan QR.

**Reconnect logic:**
- **After “connection closed” when already connected:** `connection === 'close'` and `this.isReady` → set `isReady = false`, then `setTimeout(..., 2000)` → `initialize()` again.
- **During init, no QR yet:** If close with non–connectionClosed status → after 2s: `clearSession()` then `initialize()` again.
- **bufferUtil error during init:** Retry `initialize()` after 1s (once).
- **515 (restart required) and 408 (e.g. “QR refs attempts ended”):** **Not handled.** Code falls through to the “if (this.isReady)” branch; since we’re still initializing, `isReady` is false, so it only sets `isInitializing = false` and **does not** call `initialize()` again. So after 515/408 the socket is dead and no reconnect happens.

---

## 9. How Admin Panel Knows If WhatsApp Is Connected

- **Single source:** `GET /api/whatsapp/init` in `app/api/whatsapp/init/route.ts`.
- Response includes `ready: whatsapp.getReady()`.
- **Frontend:** `app/admin/settings/page.tsx`:
  - `checkWhatsAppStatus()` calls `GET /api/whatsapp/init`, then sets `whatsappStatus = data.ready ? 'ready' : 'not_ready'`.
  - On load and every 30s: `checkWhatsAppStatus()`.
- So “connected” = the **current Node process** has `whatsapp.getReady() === true`. There is no shared or persisted “connected” state across instances.

---

## 10. Why QR Generation Is Inconsistent

- **Timing:** Init route does **not** await `initialize()`. It starts it and immediately polls `getQRCode()` for up to 10s. If Baileys takes longer to connect and emit the first QR (e.g. slow network, cold start), the route returns “QR not yet available.”
- **Connection closes before QR:** If the previous session is invalid (e.g. 401), Baileys may emit `close` before ever emitting `qr`. The route keeps polling; if 401 triggers `clearSession()` and retry after 2s, the **next** `initialize()` may emit QR after the HTTP request has already timed out.
- **Multiple in-flight POST /api/whatsapp/init:** If the admin double-clicks or refreshes, a second POST can call `initialize()` again. `initialize()` does guard with `isInitializing` and “wait for ready,” but the first request’s polling loop is tied to whatever socket/state the singleton had at that moment; races and duplicate sockets are possible.
- **Serverless:** Each invocation can be a new process; singleton and in-memory QR are per process. So one request might create the socket and emit QR in process A, while the client might hit process B on the next request and see no QR.

---

## 11. Why QR Sometimes Doesn’t Appear

- **401 before QR:** Existing `.wwebjs_auth` is invalid (e.g. logged out from phone). Baileys connects, then immediately gets `close` with 401. Code clears session and retries `initialize()` after 2s, but the **HTTP request** that was polling has already exited or is still polling the old (dead) socket. So the client never sees the new QR.
- **408/515 after QR:** QR was emitted and shown; then Baileys closes with “QR refs attempts ended” (408) or “Stream Errored (restart required)” (515). Code does **not** treat 515 as “restart and reconnect”; it only sets `isInitializing = false`. So the connection is dead; the UI may still show an old QR or “not ready,” and no new QR is requested automatically.
- **Polling timeout:** If `getQRCode()` never sees a QR within the route’s 20×500ms window, the API returns “QR not yet available.” Frontend then shows “Initialization in progress” or similar; user may need to click again.
- **Serverless:** As above: QR is in memory in one instance; GET/POST from another instance see a different singleton with no QR.

---

## 12. Why It Sometimes Disconnects After Connecting

- **515 (restart required):** Normal after pairing: WhatsApp closes the connection and expects a new socket with the same creds. Current code does **not** call `initialize()` again on 515, so the client never reconnects and appears “disconnected.”
- **408 (e.g. timeout/QR refs ended):** Same: no special handling, no reconnect.
- **Process exit (e.g. serverless):** Process ends; in-memory state is lost. Next request is a new process with no socket and no `isReady`; session may still be on disk only on that same instance (and on serverless, disk is ephemeral).
- **Network/WebSocket drops:** Only the “was previously connected” branch does delayed reconnect; 515/408 during or right after init don’t trigger that.

---

## 13. WebSocket Disconnections / connection.update

- Baileys uses a WebSocket under the hood. All state changes come from `connection.update`.
- **Handled:** `connection`, `lastDisconnect`, `qr`; close with 401/500 (logout/bad session); close when `this.isReady` (reconnect after 2s); close during init without QR (clear + retry after 2s); bufferUtil retry.
- **Unhandled useful cases:** statusCode **515** (restart required) and **408** (e.g. timeout) are not handled; the code does not call `initialize()` again to create a new socket. So these are effectively unhandled for reconnection.

---

## 14. Auth State Persistence

- **Persistence:** `useMultiFileAuthState('.wwebjs_auth')` + `creds.update` → `saveCreds` (Baileys built-in) write to the `.wwebjs_auth` directory.
- **Failing in serverless:** Yes. In Vercel/Lambda the runtime filesystem is not shared and often read-only or short-lived. So:
  - Session written in one invocation is not visible in another.
  - Even if one invocation “connects,” the next request may hit another instance with no auth and no socket.
- **On a long-lived Node server:** Persistence works for that process; restart loses in-memory state but can reload from `.wwebjs_auth` on next `initialize()`.

---

## 15. Serverless vs Persistent Process

- **No `vercel.json` or explicit serverless config** was found; the app is a standard Next.js app that **can** be deployed to Vercel (or similar).
- **If deployed on Vercel (or Lambda):**
  - Each API request can run in a different instance.
  - Singleton is **per instance**; no shared in-memory state.
  - `.wwebjs_auth` is **ephemeral** (or read-only); session does not persist across invocations.
  - WebSocket/long-lived connection is not guaranteed; instances can freeze or shut down.
- **Conclusion:** Running this Baileys-based WhatsApp flow on serverless is a **core architectural mismatch**: the design assumes one long-lived process with a single socket and local filesystem session. That is why serverless is a strong candidate for “session reset” and “QR/connection inconsistent” behavior.

---

## 16. Race Conditions / Multiple Sockets

- **Singleton:** One `WhatsAppService` per process; one socket per service (previous socket is destroyed in `initialize()` before creating a new one).
- **Races:**
  - **Double init:** Two concurrent `initialize()` calls: second waits on `once('ready')` if `isInitializing` is true, but the first request’s polling loop might already be reading `getQRCode()`/`getReady()`; the second call can still call `destroy()` and create a new socket, so the first request’s loop might be looking at a destroyed socket.
  - **POST init and GET status:** GET returns `getReady()`; if POST is still initializing in the same process, GET can see `ready: false` and then `ready: true` once Baileys opens. No lock between routes.
  - **Multiple POST /api/whatsapp/init:** Same as double init; possible duplicate or replaced socket during the same request window.

---

## 17. Purpose and Features That Depend on WhatsApp

- **Purpose:** Send **booking confirmation** messages over WhatsApp when a booking is confirmed (and optionally a trip WhatsApp group link).
- **Features that depend on it:**
  - **Booking confirmation notifications** (after full payment / confirmation): triggered from `app/api/bookings/send-notification/route.ts` (status `confirmed`) and from `app/api/whatsapp/send-booking-notification/route.ts`.
  - **Test notification** from admin: `POST /api/whatsapp/test-notification`.
- **Not used for:** OTP, generic marketing, or admin alerts; only booking-related notifications and test message.

---

## 18. What Happens If WhatsApp Disconnects

- **Sending a message:** `sendBookingConfirmation` → `sendMessage` → if not ready, `waitForReady()` (up to 60s). If never ready, it throws; the booking notification API catches and returns 500 (or the caller logs and continues, e.g. in send-notification route they catch and don’t fail the whole flow).
- **User experience:** Booking can still be confirmed and email sent; only the WhatsApp message is skipped (with error logged).
- **Admin:** Status shows “Not Connected” until someone reconnects (and on serverless, “reconnect” is unreliable without a persistent process and session store).

---

## 19. Exact Code References

### 19.1 Where WhatsApp is initialized

- **File:** `lib/whatsapp.ts`
- **Singleton:** Lines 386–392: `let whatsappService = null`; `getWhatsAppService()` creates one `WhatsAppService` per process.
- **Init:** Lines 50–283: `initialize()` uses `createAuthState('.wwebjs_auth')`, `makeWASocket()`, and registers `connection.update` and `creds.update`.

### 19.2 Connection event handlers

- **File:** `lib/whatsapp.ts` lines 126–258.
- **`connection.update`:** Reads `connection`, `lastDisconnect`, `qr`. On `qr` → set `this.qrCode`, `emit('qr', qr)`. On `connection === 'close'` → statusCode handling (401/500 clear session; 515/408 not handled for reconnect). On `connection === 'open'` → `isReady = true`, `emit('ready')`. On `connection === 'connecting'` → no-op.
- **`creds.update`:** Line 261: `this.socket.ev.on('creds.update', saveCreds)`.

### 19.3 Auth persistence

- **File:** `lib/whatsapp.ts` line 99: `const { state, saveCreds } = await createAuthState('.wwebjs_auth');` and line 261: `this.socket.ev.on('creds.update', saveCreds)`.
- **Clear:** Lines 364–379: `clearSession()` deletes `.wwebjs_auth` and calls `destroy()`.

### 19.4 QR generation

- **File:** `lib/whatsapp.ts` lines 134–156: inside `connection.update`, if `qr` → `this.qrCode = qr`, `this.emit('qr', qr)`; optional `qrcode.toDataURL(qr)` (log only).
- **Exposure:** Lines 311–336 `getQRCode()` (return stored or wait for `qr` 5s); 341–356 `getQRCodeImage()`.

### 19.5 Reconnect logic

- **File:** `lib/whatsapp.ts` lines 161–246:
  - Logout/bad session (401/500): clear session, no reconnect.
  - bufferUtil during init: retry once after 1s.
  - Close during init without QR: clear and retry after 2s.
  - Close when `this.isReady`: set false, reconnect after 2s.
  - **Missing:** Reconnect on 515 (and 408) by calling `initialize()` again.

### 19.6 Error logs (connection failure)

- **Debug log:** `.cursor/debug.log` (agent ingest logs):
  - 401: “Connection Failure”, then “Clearing invalid session”.
  - 408: “QR refs attempts ended”; no reconnect.
  - 515: “Stream Errored (restart required)”; no reconnect; later a new init and `connection: 'open'` in the same run.

---

## 20. Architectural Flaws (Summary)

1. **No handling for 515 (and 408):** After QR or during pairing, Baileys often closes with 515 (restart required). Code should call `initialize()` again instead of only setting `isInitializing = false`.
2. **Session only on local disk:** `.wwebjs_auth` does not work across serverless instances; session is lost between invocations or on new instances.
3. **Serverless mismatch:** Long-lived WebSocket and single-process singleton are not compatible with stateless, multi-instance serverless; causes “session reset” and inconsistent QR/connection.
4. **Init not awaited in route:** POST /api/whatsapp/init starts `initialize()` and polls; if QR appears late or after a 401-triggered retry, the HTTP response may already be sent; client can miss QR.
5. **Possible multiple sockets under concurrency:** Double init or concurrent POST can lead to destroy + new socket while another request is still polling the old state.
6. **No shared “connected” state:** Admin “connected” is per process; no DB or cache, so different instances can show different status and no health check is shared.

---

## 21. Step-by-Step Why It Fails and How to Fix

### 21.1 Why it fails (short)

1. **515 not handled:** Connection closes with “restart required”; code never calls `initialize()` again, so the client stays disconnected.
2. **401 before QR:** Invalid session closes connection before QR; retry happens after 2s but the HTTP request may have already returned “QR not available.”
3. **Session on local disk only:** On serverless, auth is not persisted across invocations, so every new instance needs a new QR and scan.
4. **Init is fire-and-forget + short poll:** QR might appear after the 10s polling window or in a different process, so the client often doesn’t see it.
5. **Serverless:** One instance creates the socket and QR; another serves the next request and has no socket/QR, so status and QR are inconsistent.

### 21.2 Fixes (in order of impact)

**A. Handle 515 (and 408) in `lib/whatsapp.ts`**

- In the `connection === 'close'` block, after the existing branches, add:
  - If `statusCode === 515` (or 408), do **not** set `isInitializing = false` and stop; instead:
    - Set `this.socket = null` (or call a small cleanup that doesn’t delete `.wwebjs_auth`), then call `initialize()` again (with a short delay if desired) so a new socket is created with the same saved creds.
- This fixes “disconnects right after connecting” when Baileys sends 515 after pairing.

**B. Run WhatsApp in a persistent process (recommended)**

- Run the Next.js app on a **long-lived server** (VPS, container, or always-on Node process), not on serverless, so:
  - One process holds the singleton and one WebSocket.
  - `.wwebjs_auth` persists on disk and is reused.
  - QR and “ready” state are stable for that instance.
- Optionally run only the WhatsApp client in a separate small Node service that your Next.js app calls via HTTP or queue (e.g. “send this booking notification”); that service keeps the single Baileys socket and session.

**C. If you must stay on serverless**

- Move session to a **persistent store** (e.g. S3, DB, or Redis) using a custom Baileys auth state adapter that reads/writes there instead of `useMultiFileAuthState('.wwebjs_auth')`.
- Accept that the **same** serverless instance cannot keep a WebSocket open across requests; you’d need a separate **always-on** worker (e.g. a small EC2/container) that runs the Baileys client and exposes an API for “send message” / “get status” / “get QR”. Next.js then calls that API. Session lives only in that worker.

**D. Init route: await or long poll**

- Option 1: Await `initialize()` (or wait on a promise that resolves on `ready` or first `qr`), then read QR/ready; increase timeout (e.g. 60s) so slow or retried init still returns QR.
- Option 2: Keep polling but lengthen (e.g. 60s) and/or return a “pending” response and have the frontend poll GET for status and a dedicated “current QR” endpoint that reads from the singleton (so at least in a single process the same QR is visible).

**E. Avoid double init**

- In `initialize()`, if `isInitializing` is true, return a promise that resolves when `ready` or `disconnected` (or after a timeout) instead of only `once('ready')`, and ensure only one `initialize()` runs at a time (e.g. a single shared promise for “init in progress” that all callers await).

**F. Admin status on serverless**

- If you keep serverless: either accept that “connected” is per instance and may be wrong, or move “WhatsApp status” to a small persistent worker that your API calls and that returns status/QR from the single long-lived socket.

Implementing **A** and **B** (or B + separate worker) will address the main causes of inconsistent QR, disconnects after connect, and “session reset” in production.
