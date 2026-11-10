# Deploying on the VPS

The whole site is one Next.js app running as a single long-lived Node process
on our own VPS. Everything lives in it — pages, API routes, emails, Razorpay
webhooks, Telegram, **and WhatsApp**. There is no separate worker, tunnel or
`api.ghumakkars.in` anymore.

```
Browser ──► nginx (443, TLS) ──► next start (:3000)
                                   ├─ pages + /api/*
                                   ├─ WhatsApp (Baileys, in-process)  ── data/whatsapp/
                                   └─ talks to Supabase, Razorpay, SMTP, Cloudinary, Telegram
```

## 1. Build and run

```bash
git pull
npm ci
npm run build
pm2 start npm --name ghumakkars -- start      # first time
pm2 restart ghumakkars                        # after each deploy
pm2 save && pm2 startup                       # survive reboots
```

**Run exactly ONE instance** (PM2 fork mode — never `-i max` / cluster mode).
WhatsApp allows one linked socket per number; a lock file
(`data/whatsapp/whatsapp-client.lock`) makes a second process skip WhatsApp and
the admin panel shows the reason.

`next start` listens on `PORT` (default 3000). Put nginx/Caddy in front for
HTTPS and proxy to it.

## 2. Environment (`.env` / `.env.local` in the project root)

Same as before (Supabase, SMTP, Cloudinary, Razorpay, `INTERNAL_API_SECRET`,
`NEXT_PUBLIC_SITE_URL`), plus:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.ghumakkars.in` — used by the Razorpay/Telegram webhooks to call back into the app |
| `WA_DATA_DIR` | optional; where WhatsApp keeps its session/queue/logs. Default `./data/whatsapp` |
| `WHATSAPP_DISABLED=1` | optional; don't start WhatsApp in this process |

No longer used: `WHATSAPP_API_URL`, `VPS_API_SECRET`, `WHATSAPP_API_SECRET`,
`CF_HOSTNAME`, `GREEN_API_*`.

## 3. WhatsApp

- Code: `lib/whatsapp/service.ts` (connection, reconnects, queue, logs),
  `lib/whatsapp.ts` (`sendWhatsApp()` used by routes), `instrumentation.ts`
  (starts it with the server), `app/api/admin/whatsapp/route.ts` (admin panel).
- Link once: **Admin → Settings → WhatsApp** → pairing code or QR.
- Session is saved in `data/whatsapp/session/` (git-ignored). Keep this folder
  between deploys and back it up — deleting it means relinking.
- If WhatsApp is briefly disconnected, messages are queued in
  `data/whatsapp/send-queue.json` and sent after reconnect.
- Logs: `data/whatsapp/logs/whatsapp.jsonl`, or `GET /api/admin/whatsapp?logs=200`
  as an admin.
- Don't keep WhatsApp Web open for the same number while the server runs.

### Moving the existing session from the old Pterodactyl worker (optional)

To avoid relinking: **stop the Pterodactyl server first** (two clients on one
session will fight), then copy the contents of its
`whatsapp-worker/data/whatsapp-session/` into `data/whatsapp/session/` on the VPS
and restart the app. Otherwise just link again from the admin panel.
