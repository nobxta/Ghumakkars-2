import 'dotenv/config';
import http from 'node:http';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

// ── config ──
// Pterodactyl exposes only its allocated port via SERVER_PORT — bind that.
const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 8080);
const API_SECRET = process.env.WHATSAPP_API_SECRET;
// Headless login: set WA_PAIRING_NUMBER (digits, with country code) to log in
// with an 8-char pairing code instead of scanning a QR — ideal for a console.
const PAIR_NUMBER = (process.env.WA_PAIRING_NUMBER || '').replace(/\D/g, '');

if (!API_SECRET) {
  console.error('Missing WHATSAPP_API_SECRET in .env (the shared secret the website sends).');
  process.exit(1);
}

const logger = pino({ level: 'warn' });
let sock = null;
let ready = false;

// ── WhatsApp connection (session persisted to ./auth) ──
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false, browser: ['Ghumakkars', 'Chrome', '1.0'] });

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
    if (connection === 'open') { ready = true; console.log('✅ WhatsApp connected. API is live.'); }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️ Connection closed (code ${code}).`, loggedOut ? 'Logged out — delete ./auth and re-link.' : 'Reconnecting…');
      if (!loggedOut) startSock();
    }
  });
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

await startSock();
server.listen(PORT, '0.0.0.0', () => console.log(`WhatsApp API listening on :${PORT}  (POST /send · GET /health)`));
