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

## Run it on Pterodactyl (node.js generic egg)

The generic egg clones the **whole repo** to `/home/container`, so the worker
lives in the `whatsapp-worker` **subfolder**. Two gotchas: `MAIN_FILE` is capped
at 16 chars (can't point at the subfolder), and the default startup runs
`npm install` on the root Next.js `package.json`. So **override the Startup
Command** to `cd` into the worker:

**1. Service config**
- Egg: **node.js generic** · Image: Node 20 or 22 (Node 25 also works).
- Git Repo Address: `https://github.com/nobxta/Ghumakkars-2`
- Branch: `main` · Auto Update: `1`
- If the repo is **private**: set Git **Username** + a **Personal Access Token**.
- **NODE_PACKAGES: leave empty** (deps are installed from the worker's own
  package.json by the command below — you don't need `@hapi/boom`/`groq-sdk`).
- **MAIN_FILE:** anything short (e.g. `index.mjs`) — it's required by the form
  but the custom startup below ignores it.

**2. Startup Command** — paste exactly this:
```bash
if [[ -d .git ]] && [[ "{{AUTO_UPDATE}}" == "1" ]]; then git pull; fi; cd /home/container/whatsapp-worker && /usr/local/bin/npm install --omit=dev --no-audit --no-fund && exec /usr/local/bin/node index.mjs
```

**3. Env** — File Manager → open `whatsapp-worker` → New File `.env`:
```
WHATSAPP_API_SECRET=a_long_random_secret
WA_PAIRING_NUMBER=919876543210
```
> Don't set PORT — the worker auto-binds Pterodactyl's allocated port
> (`SERVER_PORT`). That's the only port the panel exposes externally.

**4. Expose it as api.ghumakkars.in**
Point the subdomain at the server's **primary allocation** (IP:port shown in the
panel). For HTTPS, put **nginx/Caddy** in front proxying `:443 → that port`. Test
the raw allocation first: `curl http://SERVER_IP:PORT/health`.

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
