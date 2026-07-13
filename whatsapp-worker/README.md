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

`POST /send`  ·  header `x-api-key: <VPS_API_SECRET>`
```json
{ "to": "9876543210", "body": "Hello 👋", "mediaUrl": "https://…/ticket.pdf", "mediaFilename": "ticket.pdf" }
```
`to` may be 10 digits or full (country code added if missing). `mediaUrl`/`mediaFilename` are optional (attaches a PDF/image). Returns `{ "ok": true }`.

`GET /health` → `{ "ok": true, "ready": true }` (ready = WhatsApp is connected, public).

**Admin / control** (header `x-api-key: <VPS_API_SECRET>`) — used by the website's
Settings → WhatsApp panel so you link from the browser, not the console:
- `GET /status` → `{ "connected": true, "number": "9198…" }`
- `POST /login` `{ "phone": "919876543210" }` → `{ "pairingCode": "ABCD1234" }` (or `{ "alreadyConnected": true }`)
- `POST /logout` → unlinks the number and wipes the saved session.

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
VPS_API_SECRET=a_long_random_secret
```
> Don't set PORT — the worker auto-binds Pterodactyl's allocated port
> (`SERVER_PORT`). That's the only port the panel exposes externally.
> `WA_PAIRING_NUMBER` is optional now — you link from the admin panel instead.

**4. Expose it as api.ghumakkars.in — via Cloudflare Tunnel (no shell needed)**
The worker can open the tunnel itself, so you never run a command in the
container. In `.env` set:
```
CF_HOSTNAME=api.ghumakkars.in
```
On the **first** boot the console prints a one-time **authorize URL** — open it,
log in, and pick the `ghumakkars.in` zone. The worker then creates the tunnel,
points DNS (`api.ghumakkars.in` → tunnel) and runs it on every startup. All
cloudflared state (binary, `cert.pem`, `creds.json`, `config.yml`) lives in
`whatsapp-worker/.cloudflared/` inside the persisted volume, so it survives
restarts. No nginx, no open ports, automatic HTTPS.

> **Surviving a full reinstall.** A reinstall wipes the volume. After first
> setup the console prints `CF_CERT=…` and `CF_CREDS=…` (base64) — paste those
> into `.env` and the tunnel rebuilds itself with no re-authorize.

<details><summary>Alternative: plain VPS without Cloudflare</summary>

Leave `CF_HOSTNAME` unset and point the subdomain at the server's primary
allocation (IP:port), with nginx/Caddy proxying `:443 → that port`. Test the raw
allocation first: `curl http://SERVER_IP:PORT/health`.
</details>

**5. Start → link from the admin panel.** Open **ghumakkars.in → Admin →
Settings → WhatsApp**, type the sending number, hit **Get pairing code**, then on
that phone: **WhatsApp → Settings → Linked devices → Link a device → "Link with
phone number instead" → enter the code.** The panel flips to **Connected**
automatically (session saved in `data/whatsapp-session/` - keep it; it survives restarts).

---

## Connect the website (Vercel)
Set two env vars on the site:
```
WHATSAPP_API_URL=https://api.ghumakkars.in
VPS_API_SECRET=<the same secret as the worker>
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

---

## Current production stability settings

This worker uses **Baileys** (`@whiskeysockets/baileys`). It does not use
`whatsapp-web.js`, Venom, WPPConnect, Chromium, Puppeteer, or a browser profile.

Persistent Baileys auth is stored in:

```text
/home/container/whatsapp-worker/data/whatsapp-session
```

The path is inside the Pterodactyl server volume, survives normal process and
container restarts, is not under `/tmp`, and is ignored by Git. Do not delete it
unless you intentionally want to relink WhatsApp.

Optional environment overrides:

```bash
WA_DATA_DIR=/home/container/whatsapp-worker/data
WA_AUTH_DIR=/home/container/whatsapp-worker/data/whatsapp-session
WA_MAX_RECONNECT_DELAY_MS=60000
WA_MAX_QUEUE_SIZE=100
WA_QUEUE_RETRY_MS=15000
```

The worker creates a single-process lock at:

```text
/home/container/whatsapp-worker/data/whatsapp-client.lock
```

If a second copy starts with the same volume/session, it exits and logs
`duplicate_process_rejected`. Run only one Pterodactyl server/allocation/process
for this WhatsApp number.

Recommended startup command:

```bash
if [[ -d .git ]] && [[ "{{AUTO_UPDATE}}" == "1" ]]; then git pull; fi; cd /home/container/whatsapp-worker && /usr/local/bin/npm install --omit=dev --no-audit --no-fund && exec /usr/local/bin/node index.mjs
```

Operational notes:

- Required env: `VPS_API_SECRET` on the worker and website.
- Website env: `WHATSAPP_API_URL=https://api.ghumakkars.in` and the same `VPS_API_SECRET`.
- Do not set `PORT`; Pterodactyl provides `SERVER_PORT`.
- No Chromium dependencies are required because this is Baileys.
- Start with at least 512 MB RAM; use 1 GB if sending PDFs/media frequently.
- Do not keep WhatsApp Web open in a browser for the same number while this worker is active.
- Ordinary disconnects do not delete auth files and do not call logout.
- Temporary disconnects reconnect with capped exponential backoff.
- `/send` queues notifications in memory while temporarily disconnected and retries when connected.
- If WhatsApp reports a genuine logged-out/bad-session state, the worker stops reconnecting and the admin panel must relink once.

Restart verification checklist:

1. Link once from Admin -> Settings -> WhatsApp.
2. Send a test message with `POST /send`.
3. Restart only the Node process; `GET /status` should reconnect without QR.
4. Restart the Pterodactyl server/container; `GET /status` should reconnect without QR.
5. Send another test message.
6. Confirm only one worker is running; duplicate starts log `duplicate_process_rejected`.
7. Confirm `git status --short` does not show files under `whatsapp-worker/data`.
