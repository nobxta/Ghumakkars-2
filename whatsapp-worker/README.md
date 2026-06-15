# Ghumakkars WhatsApp worker

A standalone Node process that runs on **your VPS / Pterodactyl** (not Vercel).
It connects to WhatsApp with a self-hosted session (Baileys — no Cloud API, no
domain, no webhook) and polls the Supabase `whatsapp_outbox` table. When the
website inserts a job (OTP, seat-locked, confirmed, remaining-payment reminder,
a PDF, etc.), the worker picks it up within ~2 seconds and sends it.

```
Website (Vercel)  ──insert row──►  whatsapp_outbox (Supabase)  ──poll every 2s──►  worker (VPS)  ──►  WhatsApp
```

The website never talks to WhatsApp directly — it only writes rows, so a
serverless restart never drops the session.

---

## Run it on Pterodactyl (Node.js egg)

### 1. Create the server
Use a **Node.js** egg (Node **20**). In the server's **Startup** tab:

| Field | Value |
|---|---|
| Git Repo Address | `https://github.com/nobxta/Ghumakkars-2.git` |
| Branch | `main` |
| (if the repo is private) Username + Token | your GitHub username + a personal access token |
| Main File / Bot JS File | `whatsapp-worker/index.mjs` |

> The egg clones the **whole repo** into `/home/container`, so the worker lives
> at `/home/container/whatsapp-worker`.

### 2. Set the Startup Command
The worker has its own dependencies (in `whatsapp-worker/package.json`), so it
must install **inside that folder**. Set the startup command to:

```
cd /home/container/whatsapp-worker && npm install --omit=dev --no-audit --no-fund && node index.mjs
```

(That installs on each boot — fine, it's a tiny dependency set. To skip
re-installing, run `npm install` once from the console and use just
`cd /home/container/whatsapp-worker && node index.mjs`.)

### 3. Put the env where it's needed
Open the **File Manager** → go into the **`whatsapp-worker`** folder → **New File**
named `.env` with:

```
SUPABASE_URL=https://ukkusspqmfhaoyxnsmwu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=paste_your_service_role_key
WA_PAIRING_NUMBER=919876543210        # the WhatsApp number that will SEND
POLL_MS=2000
BATCH=5
MAX_ATTEMPTS=3
```

- **Service role key**: Supabase → Project Settings → API → `service_role` secret.
- **WA_PAIRING_NUMBER**: the sending account's number, country code, digits only.
- (You can also set these as Pterodactyl env variables instead of a `.env` file — the worker reads either.)

### 4. Start → log in with a pairing code (no QR)
Click **Start**. On the first run the **console prints an 8-character pairing code**:

```
🔗 PAIRING CODE: 4F7K-2Q9X
```

On the sending phone: **WhatsApp → Settings → Linked devices → Link a device →
"Link with phone number instead" → enter the code.** Once it says
`✅ WhatsApp connected. Worker is live.` you're done. The login is saved in
`whatsapp-worker/auth/`, so you only do this once (don't delete that folder).

---

## How to test it works

**A) Send a manual test message.** In Supabase → SQL editor, insert a row
(use a number that has WhatsApp, with country code):

```sql
insert into whatsapp_outbox (to_phone, kind, body)
values ('919876543210', 'custom', 'Test from the Ghumakkars worker ✅');
```

Within ~2 seconds the console logs `→ sent custom to 919876543210` and the
message arrives. The row's `status` flips to `sent`. Check failures with:

```sql
select to_phone, kind, status, attempts, error, created_at
from whatsapp_outbox order by created_at desc limit 20;
```

**B) End-to-end.** Make/seat-lock/confirm a booking on the site for a user whose
phone has WhatsApp — the website auto-queues the status message and the worker
sends it.

---

## Where it's implemented (in the website repo)

| Piece | File |
|---|---|
| Queue table | `supabase/migrations/20260615000000_whatsapp_outbox.sql` |
| Enqueue helper the app calls | `lib/whatsapp-outbox.ts` → `enqueueWhatsApp({ toPhone, kind, body, mediaUrl, dedupeKey })` |
| Booking status messages (pending / seat-locked / confirmed / rejected / cancelled) | `app/api/bookings/send-notification/route.ts` |
| The worker (this folder) | `whatsapp-worker/index.mjs` |

### Add OTP over WhatsApp
In your OTP route, after generating the code:

```ts
import { enqueueWhatsApp } from '@/lib/whatsapp-outbox';
await enqueueWhatsApp({ toPhone: phone, kind: 'otp', body: `Your Ghumakkars OTP is ${otp}. Valid 10 minutes.` });
```

### Send the confirmation PDF
Generate the ticket PDF → upload to a **public** Supabase Storage bucket → enqueue
with the public URL:

```ts
await enqueueWhatsApp({ toPhone: phone, kind: 'confirmed', body: 'Your ticket 🎫', mediaUrl: publicPdfUrl, mediaFilename: 'ticket.pdf' });
```

---

## ⚠️ Unofficial library — ban risk
Baileys automates a **normal** WhatsApp account; it is **not** the official
Business Cloud API and is against WhatsApp's Terms. High volume or spammy content
can get the number **banned**. The worker already mitigates this (skips
non-WhatsApp numbers, paces ~1 msg/sec, retry cap). Use a **dedicated number you
can afford to lose** and keep volume reasonable. The ban-safe route for
transactional/OTP at scale is Meta's official WhatsApp Cloud API (needs a domain,
webhook and approved templates — the opposite of this self-hosted setup).
