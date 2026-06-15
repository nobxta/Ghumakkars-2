# Ghumakkars WhatsApp API (self-hosted)

A small HTTP service that runs on **your VPS / Pterodactyl** and sends WhatsApp
messages via **Baileys** (`@whiskeysockets/baileys`) — no Green API, no Cloud
API, no database in between. The website calls it **directly**:

```
Website (Vercel)  ──POST https://api.ghumakkars.in/send──►  worker (VPS) ── Baileys ──►  WhatsApp
```

Auth is a single shared secret (`x-api-key` header). The website never touches
WhatsApp itself — it just makes an HTTP call.

---

## API

`POST /send`  ·  header `x-api-key: <WHATSAPP_API_SECRET>`
```json
{ "to": "9876543210", "body": "Hello 👋", "mediaUrl": "https://…/ticket.pdf", "mediaFilename": "ticket.pdf" }
```
`to` may be 10 digits or full (country code added if missing). `mediaUrl`/`mediaFilename` are optional (attaches a PDF/image). Returns `{ "ok": true }`.

`GET /health` → `{ "ok": true, "ready": true }` (ready = WhatsApp is connected).

---

## Run it on Pterodactyl (Node.js egg)

**1. Startup tab**
| Field | Value |
|---|---|
| Git Repo Address | `https://github.com/nobxta/Ghumakkars-2.git` |
| Branch | `main` |
| (private repo) Username + Token | your GitHub username + a token |
| Main File | `whatsapp-worker/index.mjs` |

The egg clones the repo into `/home/container`, so the worker is at
`/home/container/whatsapp-worker`.

**2. Startup command** (install its own deps inside the folder):
```
cd /home/container/whatsapp-worker && npm install --omit=dev --no-audit --no-fund && node index.mjs
```

**3. Env** — File Manager → open `whatsapp-worker` → New File `.env`:
```
WHATSAPP_API_SECRET=a_long_random_secret
PORT=8080
WA_PAIRING_NUMBER=919876543210
```

**4. Expose the port as api.ghumakkars.in**
Point the subdomain at the server's allocated port. Two common ways:
- **DNS A record** `api.ghumakkars.in → your VPS IP`, then put **nginx/Caddy** in
  front to proxy `:443` → the Pterodactyl port (gives you HTTPS).
- Or use Pterodactyl's port + a reverse proxy you already run.

**5. Start → log in with the pairing code** (printed in the console). On the
sending phone: **WhatsApp → Settings → Linked devices → Link a device → "Link
with phone number instead" → enter the code.** When it prints
`✅ WhatsApp connected. API is live.` you're done (session saved in `auth/` — keep it).

---

## Connect the website (Vercel)
Set two env vars on the site:
```
WHATSAPP_API_URL=https://api.ghumakkars.in
WHATSAPP_API_SECRET=<the same secret as the worker>
```

## Test
```bash
# health
curl https://api.ghumakkars.in/health

# send (replace the number + secret)
curl -X POST https://api.ghumakkars.in/send \
  -H "x-api-key: a_long_random_secret" \
  -H "Content-Type: application/json" \
  -d '{"to":"919876543210","body":"Test from the worker ✅"}'
```
Or just confirm/seat-lock a booking on the site for a user whose phone has
WhatsApp — the site calls `/send` automatically.

## Where it's implemented (website repo)
| Piece | File |
|---|---|
| Client that calls this API | `lib/whatsapp.ts` → `sendWhatsApp({ to, body, mediaUrl })` |
| Booking status messages (pending / seat-locked / confirmed / rejected / cancelled) | `app/api/bookings/send-notification/route.ts` |
| The API/worker (this folder) | `whatsapp-worker/index.mjs` |

To add **OTP** or the **confirmation PDF**, call `sendWhatsApp(...)` from the
relevant route (OTP route / after generating the ticket PDF + uploading it
somewhere public).

## ⚠️ Unofficial library — ban risk
Baileys automates a **normal** WhatsApp account (not the official Cloud API) and
is against WhatsApp's Terms. High volume or spammy content can get the number
**banned**. The API skips non-WhatsApp numbers; keep volume reasonable and use a
**dedicated number you can afford to lose**.
