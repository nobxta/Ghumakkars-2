import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// ── config ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS = Number(process.env.POLL_MS || 2000);
const BATCH = Number(process.env.BATCH || 5);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
// Headless login: set WA_PAIRING_NUMBER (e.g. 919876543210) to log in with an
// 8-char pairing code instead of scanning a QR — ideal for a Pterodactyl console.
const PAIR_NUMBER = (process.env.WA_PAIRING_NUMBER || '').replace(/\D/g, '');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const logger = pino({ level: 'warn' });
let sock = null;
let ready = false;

// ── WhatsApp connection (session persisted to ./auth) ──
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false, browser: ['Ghumakkars', 'Chrome', '1.0'] });

  // Headless pairing-code login (no QR scan). Run once on a fresh ./auth.
  if (PAIR_NUMBER && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PAIR_NUMBER);
        console.log(`\n🔗 PAIRING CODE: ${code}\n   WhatsApp → Settings → Linked devices → Link a device → "Link with phone number instead" → enter this code.\n`);
      } catch (e) {
        console.error('Could not get a pairing code:', e?.message || e);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !PAIR_NUMBER) {
      console.log('\n📱 Scan this QR in WhatsApp → Linked devices → Link a device:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') { ready = true; console.log('✅ WhatsApp connected. Worker is live.'); }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️ Connection closed (code ${code}).`, loggedOut ? 'Logged out — delete ./auth and re-scan.' : 'Reconnecting…');
      if (!loggedOut) startSock();
    }
  });
}

const jidOf = (phone) => `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;

async function sendJob(job) {
  const jid = jidOf(job.to_phone);

  // Optional: skip numbers that aren't on WhatsApp.
  try {
    const [res] = await sock.onWhatsApp(jid);
    if (!res?.exists) throw new Error('Number is not on WhatsApp');
  } catch (e) {
    if (String(e.message).includes('not on WhatsApp')) throw e;
    // onWhatsApp can be flaky; ignore lookup errors and try sending anyway.
  }

  if (job.media_url) {
    const resp = await fetch(job.media_url);
    if (!resp.ok) throw new Error(`media fetch ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('pdf') || (job.media_filename || '').toLowerCase().endsWith('.pdf')) {
      await sock.sendMessage(jid, { document: buf, mimetype: 'application/pdf', fileName: job.media_filename || 'document.pdf', caption: job.body });
    } else {
      await sock.sendMessage(jid, { image: buf, caption: job.body });
    }
  } else {
    await sock.sendMessage(jid, { text: job.body });
  }
}

// ── poll loop ──
async function tick() {
  if (!ready) return;
  const { data: jobs, error } = await supabase
    .from('whatsapp_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) { console.error('poll error:', error.message); return; }
  if (!jobs?.length) return;

  for (const job of jobs) {
    // Claim the row so a second worker instance won't double-send.
    const { data: claimed } = await supabase
      .from('whatsapp_outbox')
      .update({ status: 'sending', attempts: (job.attempts || 0) + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .single();
    if (!claimed) continue;

    try {
      await sendJob(job);
      await supabase.from('whatsapp_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', job.id);
      console.log(`→ sent ${job.kind} to ${job.to_phone}`);
    } catch (e) {
      const attempts = (job.attempts || 0) + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      await supabase.from('whatsapp_outbox').update({ status: dead ? 'failed' : 'pending', error: String(e.message || e) }).eq('id', job.id);
      console.error(`✗ ${job.kind} to ${job.to_phone}: ${e.message}${dead ? ' (gave up)' : ' (will retry)'}`);
    }
    // gentle pacing so we don't hammer WhatsApp
    await new Promise((r) => setTimeout(r, 700));
  }
}

await startSock();
setInterval(() => { tick().catch((e) => console.error('tick error:', e)); }, POLL_MS);
console.log(`Worker started · polling every ${POLL_MS}ms · batch ${BATCH}`);
