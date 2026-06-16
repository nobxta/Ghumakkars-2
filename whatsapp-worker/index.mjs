import 'dotenv/config';
import http from 'node:http';
import { rm } from 'node:fs/promises';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';
import { startTunnel } from './tunnel.mjs';

// ── config ──
// Pterodactyl exposes only its allocated port via SERVER_PORT — bind that.
const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 8080);
// Shared VPS internal secret (reusable across services). Falls back to the old
// WHATSAPP_API_SECRET name.
const API_SECRET = process.env.VPS_API_SECRET || process.env.WHATSAPP_API_SECRET;
// Headless login: set WA_PAIRING_NUMBER (digits, with country code) to log in
// with an 8-char pairing code instead of scanning a QR — ideal for a console.
const PAIR_NUMBER = (process.env.WA_PAIRING_NUMBER || '').replace(/\D/g, '');

if (!API_SECRET) {
  console.error('Missing VPS_API_SECRET in .env (the shared secret the website sends as x-api-key).');
  process.exit(1);
}

const logger = pino({ level: 'warn' });
let sock = null;
let ready = false;
let currentNumber = null;   // the linked WhatsApp number (digits), once connected
let manualLogout = false;   // set during /logout so the close handler doesn't auto-reconnect
let lastQR = null;          // latest QR string from Baileys (for panel QR login)

const numberFromJid = (id) => (id ? String(id).split(':')[0].split('@')[0] : null);

// ── WhatsApp connection (session persisted to ./auth) ──
async function startSock() {
  // Tear down any previous socket so we don't stack listeners / sockets.
  try { sock?.ev?.removeAllListeners?.(); sock?.end?.(undefined); } catch {}

  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false, browser: ['Ghumakkars', 'Chrome', '1.0'] });

  // Optional console fallback: set WA_PAIRING_NUMBER to auto-print a pairing code
  // on boot. Normally you link from the admin panel via POST /login instead.
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
    // Linking is done from the admin panel (pairing code). Only print a console
    // QR if you explicitly opt in with WA_PRINT_QR=1 — keeps the console clean.
    if (qr) {
      lastQR = qr;   // exposed to the admin panel for QR login
      if (process.env.WA_PRINT_QR === '1') {
        console.log('\n📱 Scan this QR in WhatsApp → Linked devices → Link a device:\n');
        qrcode.generate(qr, { small: true });
      }
    }
    if (connection === 'open') {
      ready = true;
      lastQR = null;
      currentNumber = numberFromJid(sock.user?.id);
      console.log(`✅ WhatsApp connected (${currentNumber}). API is live.`);
    }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      if (loggedOut) { currentNumber = null; lastQR = null; }
      console.log(`⚠️ Connection closed (code ${code}).`, loggedOut ? 'Logged out — re-link from the admin panel.' : 'Reconnecting…');
      if (!loggedOut && !manualLogout) startSock();
    }
  });
}

// Request a fresh pairing code on demand (admin panel → POST /login).
async function requestPairing(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('phone required');
  if (ready) return { alreadyConnected: true, number: currentNumber };
  // Start a clean socket and give the WebSocket a moment to open before asking.
  manualLogout = false;
  await startSock();
  await new Promise((r) => setTimeout(r, 2500));
  if (sock.authState.creds.registered) return { alreadyConnected: true, number: currentNumber };
  const code = await sock.requestPairingCode(digits);
  console.log(`🔗 pairing code issued for ${digits}: ${code}`);
  return { pairingCode: code };
}

// Start a socket for QR login and return the QR as a PNG data URL.
async function startForQR() {
  if (ready) return { alreadyConnected: true, number: currentNumber };
  manualLogout = false;
  if (!sock || sock.authState.creds.registered) { lastQR = null; await startSock(); }
  // Wait briefly for Baileys to emit the first QR.
  for (let i = 0; i < 30 && !lastQR; i++) await new Promise((r) => setTimeout(r, 300));
  if (!lastQR) throw new Error('no QR yet — try again in a moment');
  return { qr: await QRCode.toDataURL(lastQR, { margin: 1, width: 320 }) };
}

// Unlink the current number and wipe the saved session.
async function logoutAndReset() {
  manualLogout = true;
  try { await sock?.logout(); } catch {}
  ready = false; currentNumber = null; lastQR = null;
  try { await rm('auth', { recursive: true, force: true }); } catch {}
  await startSock();   // fresh unregistered socket, ready to re-link
  return { ok: true };
}

const jidOf = (phone) => `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;

async function sendMessage({ to, body, mediaUrl, mediaFilename }) {
  if (!ready) throw new Error('WhatsApp not connected yet');
  const digits = String(to || '').replace(/\D/g, '');
  if (!digits || !body?.trim()) throw new Error('to and body are required');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const jid = jidOf(phone);

  // Skip numbers that aren't on WhatsApp.
  try {
    const [res] = await sock.onWhatsApp(jid);
    if (!res?.exists) throw new Error('Number is not on WhatsApp');
  } catch (e) {
    if (String(e.message).includes('not on WhatsApp')) throw e;
  }

  if (mediaUrl) {
    const resp = await fetch(mediaUrl);
    if (!resp.ok) throw new Error(`media fetch ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('pdf') || (mediaFilename || '').toLowerCase().endsWith('.pdf')) {
      await sock.sendMessage(jid, { document: buf, mimetype: 'application/pdf', fileName: mediaFilename || 'document.pdf', caption: body });
    } else {
      await sock.sendMessage(jid, { image: buf, caption: body });
    }
  } else {
    await sock.sendMessage(jid, { text: body });
  }
}

// ── HTTP API (called directly by the website) ──
function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0];

  if (req.method === 'GET' && url === '/health') return json(res, 200, { ok: true, ready });

  // Everything below is admin/control — requires the shared secret.
  const authed = req.headers['x-api-key'] === API_SECRET;

  // Connection status (admin panel polls this). Includes a live QR while a QR
  // login is in progress, so the panel can refresh rotated codes automatically.
  if (req.method === 'GET' && url === '/status') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    let qr = null;
    if (!ready && lastQR) { try { qr = await QRCode.toDataURL(lastQR, { margin: 1, width: 320 }); } catch {} }
    return json(res, 200, { ok: true, connected: ready, number: currentNumber, qr });
  }

  // Start linking. mode:'qr' → returns a QR PNG; otherwise (with phone) → an
  // 8-char pairing code to type into WhatsApp.
  if (req.method === 'POST' && url === '/login') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    const payload = await readJson(req);
    if (!payload) return json(res, 400, { ok: false, error: 'invalid json' });
    try {
      const result = payload.mode === 'qr' ? await startForQR() : await requestPairing(payload.phone);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      console.error('login failed:', e?.message || e);
      return json(res, 400, { ok: false, error: String(e?.message || e) });
    }
  }

  // Unlink the current number.
  if (req.method === 'POST' && url === '/logout') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    try { await logoutAndReset(); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 400, { ok: false, error: String(e?.message || e) }); }
  }

  if (req.method === 'POST' && url === '/send') {
    if (req.headers['x-api-key'] !== API_SECRET) return json(res, 401, { ok: false, error: 'unauthorized' });
    const payload = await readJson(req);
    if (!payload) return json(res, 400, { ok: false, error: 'invalid json' });
    try {
      await sendMessage(payload);
      console.log(`→ sent to ${payload.to}`);
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error('send failed:', e?.message || e);
      return json(res, ready ? 400 : 503, { ok: false, error: String(e?.message || e) });
    }
  }

  json(res, 404, { ok: false, error: 'not found' });
});

// Only auto-connect if WhatsApp was linked before (session already on disk), or
// if a console pairing number is explicitly set. Otherwise stay idle and wait
// for the admin panel to start linking — nothing to do in this console.
const { state: bootState } = await useMultiFileAuthState('auth');
if (bootState.creds.registered || PAIR_NUMBER) {
  await startSock();
} else {
  console.log('ℹ️  WhatsApp not linked yet — link it from Admin → Settings → WhatsApp. Nothing to do in this console.');
}

server.listen(PORT, '0.0.0.0', () => console.log(`WhatsApp API listening on :${PORT}  (POST /send · GET /health)`));

// Expose it on a domain via Cloudflare Tunnel (no shell needed). Non-blocking:
// the first-run authorize step waits in the background, the API stays up.
startTunnel(PORT).catch((e) => console.error('[tunnel] setup error:', e?.message || e));
