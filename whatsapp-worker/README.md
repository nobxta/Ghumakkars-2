# Ghumakkars WhatsApp worker

A standalone Node process that runs on **your VPS** (not Vercel). It connects to
WhatsApp with a self-hosted session (Baileys — no Cloud API, no domain, no
webhook) and polls the Supabase `whatsapp_outbox` table. When the website
inserts a job (OTP, seat-locked, confirmed, remaining-payment reminder, a PDF,
etc.), the worker picks it up within ~2 seconds and sends it.

```
Website (Vercel)  ──insert──►  whatsapp_outbox (Supabase)  ──poll──►  worker (VPS)  ──►  WhatsApp
```

The website never talks to WhatsApp directly — it only writes rows. Sending is
fully decoupled, so a serverless function restarting never drops the session.

## One-time setup on the VPS

```bash
cd whatsapp-worker
cp .env.example .env        # fill in SUPABASE_SERVICE_ROLE_KEY
npm install
npm start                   # first run prints a QR in the terminal
```

Open WhatsApp on the business phone → **Settings → Linked devices → Link a
device** → scan the QR. The session is saved in `./auth/` so you only scan once.

## Keep it running (pm2)

```bash
npm i -g pm2
pm2 start index.mjs --name wa-worker
pm2 save && pm2 startup     # restart on reboot
pm2 logs wa-worker          # watch sends
```

## How the website enqueues

In the Next.js app, call the helper (server-side only):

```ts
import { enqueueWhatsApp } from '@/lib/whatsapp-outbox';

await enqueueWhatsApp({
  toPhone: '9876543210',           // 10-digit or full; country code added if missing
  kind: 'confirmed',
  body: 'Your booking is confirmed ✅',
  dedupeKey: `confirmed:${bookingId}`,   // optional — prevents duplicate sends
  // mediaUrl: 'https://…/ticket.pdf',   // optional — attaches a PDF/image
  // mediaFilename: 'ticket.pdf',
});
```

Booking status messages (pending / seat-locked / confirmed / rejected /
cancelled) are already wired in `app/api/bookings/send-notification`.

### Sending OTP over WhatsApp
In your OTP route, after generating the code, enqueue it with the user's phone:

```ts
await enqueueWhatsApp({ toPhone: phone, kind: 'otp', body: `Your Ghumakkars OTP is ${otp}. Valid for 10 minutes.` });
```

### Sending the confirmation PDF
Generate the PDF, upload it to a **public** Supabase Storage bucket, then enqueue
with `mediaUrl` set to the public URL and `mediaFilename: 'ticket.pdf'`.

## ⚠️ Important: this uses an unofficial WhatsApp library
Baileys (like whatsapp-web.js) automates a normal WhatsApp account. It is **not**
the official WhatsApp Business Cloud API and is against WhatsApp's Terms — high
sending volume or spammy content can get the number **banned**. Mitigations the
worker already includes: it skips non-WhatsApp numbers, paces sends (~1/sec),
and retries with a cap. For OTP/transactional at scale, the official **WhatsApp
Cloud API** is the ban-safe route (but it needs a Meta app, a domain/webhook and
pre-approved templates — the opposite of this self-hosted setup). Use a
dedicated number you can afford to lose, and keep volume reasonable.
