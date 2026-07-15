# WhatsApp Integration – Production Audit Report

**Scope:** `@whiskeysockets/baileys` in Next.js 14. Analysis only; no code changes.

---

## 1. Is WhatsApp only working in test-notification route?

### Full flow comparison

| Aspect | `/api/whatsapp/test-notification` | `/api/whatsapp/send-booking-notification` |
|--------|-----------------------------------|-------------------------------------------|
| **Singleton** | `getWhatsAppService()` (line 24) | `getWhatsAppService()` (line 87) |
| **Send path** | `whatsapp.sendBookingConfirmation(...)` (line 55) | `whatsapp.sendBookingConfirmation(...)` (line 104) |
| **Readiness** | `getReady()` only; if false → **return 503** (lines 35–40) | `getReady()`; if false → **`await initialize()` then `await waitForReady()`** (lines 98–100) |

**File references:**

- **Test notification:** `app/api/whatsapp/test-notification/route.ts`  
  - Lines 24, 35–40, 55: same singleton, `sendBookingConfirmation`, but **no** `initialize()` or `waitForReady()` when not ready; returns 503 immediately.
- **Send booking notification:** `app/api/whatsapp/send-booking-notification/route.ts`  
  - Lines 87, 98–100, 104: same singleton, same `sendBookingConfirmation`, and **does** call `initialize()` + `waitForReady()` when not ready.

**Conclusion:** Both use the same `getWhatsAppService()` singleton and the same `sendBookingConfirmation()` → `sendMessage()` path. The only difference is readiness handling: test-notification **requires** the client to already be ready (503 if not); send-booking-notification **tries** to make it ready (init + wait) before sending.

**Production implication:** Booking notifications can still be sent when the client was not ready at request start (init + wait then send). Test notification will always fail with 503 if the client is not already connected.

**Risk level:** Low for booking notifications; Medium for test-notification (depends on prior connection).

**Recommended action:** None for behavior; document that test-notification is “send only when already connected” and send-booking-notification is “connect if needed, then send.”

---

## 2. Where is the session saved?

### useMultiFileAuthState

- **Called at:** `lib/whatsapp.ts` line **153**  
  `const { state, saveCreds } = await createAuthState('.wwebjs_auth');`  
  (`createAuthState` is `useMultiFileAuthState` from Baileys – line 134.)

### Path

- **Argument:** `'.wwebjs_auth'` (relative string).
- **Resolution:** Baileys resolves this relative to the **current working directory** at runtime. The same codebase uses `process.cwd()` for the same logical dir elsewhere (e.g. `path.join(process.cwd(), '.wwebjs_auth')` at lines 140 and 679), so the effective path is **`<process.cwd()>/.wwebjs_auth`**.
- **Type:** Effectively absolute at runtime (cwd-based); the string passed to Baileys is relative.

### Files created

- `useMultiFileAuthState` (Baileys) typically creates:
  - `creds.json` (credentials)
  - Key files under the same directory (e.g. `app-state-sync-*.json`, key bundles).  
  Exact filenames are from the library; the app only references the directory as `.wwebjs_auth` / `process.cwd() + '/.wwebjs_auth'`.

### clearSession()

- **Location:** `lib/whatsapp.ts` lines **671–686**.
- **Behavior:**  
  - Calls `await this.destroy()` (socket teardown).  
  - Then, in Node: `sessionDir = path.join(process.cwd(), '.wwebjs_auth')`; if `fs.existsSync(sessionDir)`, runs `fs.rmSync(sessionDir, { recursive: true, force: true })`.  
- **Conclusion:** `clearSession()` **does** delete the `.wwebjs_auth` directory (and thus all session files, including creds and keys) for the current process cwd.

**Production implication:** Session is stored on the local filesystem under the app’s cwd. Persistence and sharing depend entirely on that filesystem’s lifetime and whether it is shared across instances (see Sections 3 and 4).

**Risk level:** Low for local/long-lived single process; High when filesystem is ephemeral or not shared (e.g. serverless).

---

## 3. What happens if deployed to Vercel?

### Vercel filesystem

- **Serverless (default):** Each invocation can run in a new, short-lived environment. The filesystem is **ephemeral**: not shared across invocations and not guaranteed across cold starts or instance replacement. Writes to `.wwebjs_auth` may not persist to the next request.
- **Persistent storage:** Vercel does **not** provide a persistent, shared filesystem for serverless functions. There is no guarantee that `.wwebjs_auth` survives cold starts, scaling, or replacement.

### Session persistence

- **Across cold starts:** **No.** A new instance has an empty (or different) filesystem; `.wwebjs_auth` from a previous run is not available.
- **Across instance replacement:** **No.** Same as above.
- **Across multiple serverless invocations:** **No.** Different invocations can run on different instances; they do not share a single `.wwebjs_auth` directory.

**Conclusion:** On Vercel serverless, the session is **not** guaranteed to persist. After redeploy, cold start, or a new instance, the app will typically have no valid session and will need a new QR scan (or will fail to send until one is done on that instance).

**Multiple instances:** They do **not** share session. Each instance has its own filesystem; there is no shared store for `.wwebjs_auth`.

**Production implication:** WhatsApp will only work reliably on Vercel if the same instance is reused and not recycled (e.g. always-warm, single instance), which is not guaranteed. In normal serverless use, session will be lost and QR will be required again after redeploy or cold start.

**Risk level:** High for production on Vercel serverless.

**Recommended action:** Document that this setup is not suitable for Vercel serverless without a persistent, shared auth store (e.g. external store used by a custom auth state adapter). No architecture change suggested here; analysis only.

---

## 4. Is this safe for multi-instance production?

### Two serverless instances

- **Shared session:** **No.** Each instance has its own `global.__whatsappService__` and its own filesystem. There is no shared session store; `.wwebjs_auth` is local per instance.
- **440 conflict:** If instance A has an active Baileys socket and instance B starts and creates a **new** socket with the same credentials (e.g. after loading the same session from a shared store, which you don’t have today), WhatsApp can treat the second connection as replacing the first and emit 440. With **current** design (no shared storage), B typically has no session, so it would show QR; the main risk is multiple processes on the same machine (e.g. multiple Node processes) both using the same `.wwebjs_auth` directory, which can cause 440 or bad session behavior.
- **globalThis singleton:** It is **per process**. So it is “sufficient” only in the sense that within one Node process there is one service instance. It does **not** give sharing across serverless instances; each instance has its own `global` and its own singleton.

### Architecture assumption

- The design **does** assume a **single long-lived process** (or one process per WhatsApp client): one in-memory socket, one `.wwebjs_auth` on disk, one `global.__whatsappService__`. It does not assume multiple, independent serverless instances that must share state.

**Production implication:** Safe for single-instance (e.g. one long-running Node process). Not safe for multi-instance serverless without a shared, persistent auth store and a different deployment model (e.g. dedicated worker that holds the socket).

**Risk level:** High for multi-instance serverless; Low for single long-lived process.

**Recommended action:** Document that production should run as a single process (e.g. single Node server, one container, or one worker) if using the current session design. No code change in this audit.

---

## 5. What happens on redeploy?

### App restart (e.g. redeploy, process restart)

- **Session reload:** On startup, the **process** has no in-memory state. The next request that calls `getWhatsAppService()` gets a new `WhatsAppService` instance (or the same one on `global` for that process). No automatic “reload” of session from disk happens until someone calls `initialize()`.
- **initialize() and existing auth:** When `initialize()` runs (e.g. from POST `/api/whatsapp/init` or from send-booking-notification when not ready), it calls `createAuthState('.wwebjs_auth')` (line 153). If `.wwebjs_auth` **exists and is valid** on that instance’s filesystem, Baileys loads it and can connect without QR. If the directory is missing or invalid (e.g. new instance, or after clear), it will need a new QR scan.
- **Redeploy on Vercel:** Typically new instances and new filesystem → no `.wwebjs_auth` → **QR scan required again** after redeploy.

**Conclusion:** Session does **not** “reload automatically” on app restart; it is used when the next `initialize()` runs and reads from `.wwebjs_auth`. On a long-lived server with persistent disk, one redeploy/restart can still have the same directory, so no QR needed. On serverless/redeploy with ephemeral fs, QR will be required again.

**Risk level:** Low for single server with persistent disk; High for serverless/redeploy with ephemeral storage.

---

## 6. Booking notification reliability

### Flow (booking status → WhatsApp)

1. **Status change to confirmed**  
   - From: `app/api/bookings/send-notification/route.ts` (e.g. POST with `status: 'confirmed'`) or from Razorpay webhook in `app/api/webhooks/razorpay/route.ts` after payment success.
2. **Call to WhatsApp route**  
   - Both call:  
     `fetch(NEXT_PUBLIC_APP_URL + '/api/whatsapp/send-booking-notification', { method: 'POST', body: JSON.stringify({ bookingId }) })`.  
   - Refs: `app/api/bookings/send-notification/route.ts` lines 192–199; `app/api/webhooks/razorpay/route.ts` lines 206–212.
3. **send-booking-notification route**  
   - `app/api/whatsapp/send-booking-notification/route.ts`: loads booking, gets phone; `getWhatsAppService()`; if not ready then `await whatsapp.initialize()` and `await whatsapp.waitForReady()` (lines 98–100); then `await whatsapp.sendBookingConfirmation(...)` (line 104).
4. **sendBookingConfirmation**  
   - `lib/whatsapp.ts` line 497: `return this.sendMessage(phoneNumber, message);`
5. **sendMessage**  
   - Lines 414, 429–445: `await this.ensureReadyForSend()`; then `this.socket.sendMessage(...)`; on throw, `triggerSafeReconnect()`, `await this.initialize()`, one retry.

**ensureReadyForSend:** Yes. It is used in `sendMessage()` at line 414. It only calls `initialize()` if `!this.isReady || !this.socket` (lines 398–400); it does not block on WebSocket readyState.

**Auto-reconnect:** Yes. On send failure, `sendMessage` calls `triggerSafeReconnect()` and `await this.initialize()`, then retries send once (lines 434–445). Health monitor and other reconnect logic remain unchanged.

**Failure behavior (booking flow):**

- **send-booking-notification route:** On error it returns 500 and throws (lines 119–124). So the **route** does not fail silently.
- **Callers (send-notification and Razorpay webhook):** They use `fetch(...)` and only catch **exceptions** (e.g. network). They **do not** check `response.ok` or response body. So a 500 from `/api/whatsapp/send-booking-notification` does **not** throw from `fetch()`; only a network error would. Result: **Booking confirmation and payment success still return success to the user even when WhatsApp returns 500.** The error is only logged (e.g. `console.error('Error sending WhatsApp notification:', whatsappError)` in send-notification line 201 and razorpay line 214). So from the **user** perspective, booking notifications can **fail silently** (no WhatsApp sent, no user-visible error).

**Production implication:** Logic inside WhatsApp (ensureReadyForSend, retry, reconnect) is sound. Reliability is limited by session persistence and single-process assumption. Silent failure is due to callers not checking the HTTP response of the WhatsApp API.

**Risk level:** Medium (notifications can be missing without user feedback).

**Recommended action:** None in this audit. For clarity: ensure callers of `/api/whatsapp/send-booking-notification` either check `response.ok`/body or document that WhatsApp failures are best-effort and only logged.

---

## Summary table

| Question | Finding | Risk |
|----------|---------|------|
| 1. Only test-notification? | No; both routes use same singleton and send path. Booking route also does init + wait when not ready. | Low (booking) / Medium (test) |
| 2. Session location | `createAuthState('.wwebjs_auth')` at `lib/whatsapp.ts:153`; path is cwd-based; `clearSession()` deletes that directory (lines 671–686). | Low locally; High if fs ephemeral |
| 3. Vercel | Session does not persist across cold starts / replacement / invocations; QR required again after redeploy; no shared storage. | High |
| 4. Multi-instance | Session not shared; global singleton is per process; design assumes single long-lived process. | High (multi-instance); Low (single process) |
| 5. Redeploy | Session used when `initialize()` next runs; persists only if filesystem persists (e.g. single server). | High on serverless; Low on persistent server |
| 6. Booking reliability | ensureReadyForSend and retry/reconnect used; callers do not check HTTP response → notifications can fail silently. | Medium |

---

## Is the current setup production-safe?

- **Single long-lived Node process with persistent disk (e.g. VPS, single container):** **Yes**, with the caveat that booking WhatsApp failures are not surfaced to the user (silent failure at the caller level).
- **Vercel serverless (default):** **No.** Session does not persist; QR will be needed after redeploy/cold start; multiple instances do not share session.
- **Multi-instance production (several Node processes or serverless instances):** **No.** No shared session; architecture assumes one process.

**Conclusion:** The implementation is **reliable locally** and **production-safe only when run as a single long-lived process with persistent filesystem**. It is **not** suitable for standard Vercel serverless or multi-instance deployment without a persistent, shared auth store and corresponding deployment model.
