import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';
import { startTunnel } from './tunnel.mjs';

const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 8080);
const API_SECRET = process.env.VPS_API_SECRET || process.env.WHATSAPP_API_SECRET;
const PAIR_NUMBER = (process.env.WA_PAIRING_NUMBER || '').replace(/\D/g, '');
const WORKER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(WORKER_ROOT, process.env.WA_DATA_DIR || './data');
const AUTH_DIR = path.resolve(WORKER_ROOT, process.env.WA_AUTH_DIR || './data/whatsapp-session');
const LOCK_FILE = path.resolve(DATA_DIR, 'whatsapp-client.lock');
const MAX_RECONNECT_DELAY_MS = Number(process.env.WA_MAX_RECONNECT_DELAY_MS || 60_000);
const MAX_QUEUE_SIZE = Number(process.env.WA_MAX_QUEUE_SIZE || 100);
const QUEUE_RETRY_MS = Number(process.env.WA_QUEUE_RETRY_MS || 15_000);
const QUEUE_MAX_ATTEMPTS = Number(process.env.WA_QUEUE_MAX_ATTEMPTS || 12);

if (!API_SECRET) {
  console.error('Missing VPS_API_SECRET in .env (the shared secret the website sends as x-api-key).');
  process.exit(1);
}

const logger = pino({ level: process.env.WA_BAILEYS_LOG_LEVEL || 'silent' });
let sock = null;
let ready = false;
let currentNumber = null;
let manualLogout = false;
let genuinelyLoggedOut = false;
let lastQR = null;
let starting = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let lockFd = null;
let shuttingDown = false;
let queueTimer = null;
const pendingSends = [];

const numberFromJid = (id) => (id ? String(id).split(':')[0].split('@')[0] : null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(event, data = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'whatsapp-worker', event, ...data }));
}

function warn(event, data = {}) {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), service: 'whatsapp-worker', level: 'warn', event, ...data }));
}

function errorLog(event, data = {}) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), service: 'whatsapp-worker', level: 'error', event, ...data }));
}

function maskedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits ? '****' : '';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function hasAuthFiles() {
  return existsSync(path.join(AUTH_DIR, 'creds.json'));
}

function prepareDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(AUTH_DIR, { recursive: true });
}

function acquireProcessLock() {
  prepareDirs();
  try {
    lockFd = openSync(LOCK_FILE, 'wx');
    writeFileSync(lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    log('process_lock_acquired', { lockFile: LOCK_FILE, pid: process.pid });
    return;
  } catch (e) {
    let existingPid = null;
    try {
      existingPid = JSON.parse(readFileSync(LOCK_FILE, 'utf8') || '{}')?.pid;
    } catch {}

    if (existingPid) {
      try {
        process.kill(existingPid, 0);
        errorLog('duplicate_process_rejected', { lockFile: LOCK_FILE, existingPid, pid: process.pid });
        process.exit(1);
      } catch {
        warn('stale_process_lock_removed', { lockFile: LOCK_FILE, existingPid });
        try { unlinkSync(LOCK_FILE); } catch {}
        return acquireProcessLock();
      }
    }

    errorLog('process_lock_failed', { lockFile: LOCK_FILE, error: e?.message || String(e) });
    process.exit(1);
  }
}

function releaseProcessLock() {
  try { if (lockFd !== null) closeSync(lockFd); } catch {}
  try { unlinkSync(LOCK_FILE); } catch {}
  lockFd = null;
}

function destroySocket() {
  try { sock?.ev?.removeAllListeners?.(); } catch {}
  try { sock?.end?.(undefined); } catch {}
  sock = null;
}

async function startSock() {
  if (starting || shuttingDown) return;
  starting = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  destroySocket();
  prepareDirs();
  log('whatsapp_starting', { authDir: AUTH_DIR, authExists: hasAuthFiles() });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Ghumakkars', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 2,
  });
  starting = false;

  if (PAIR_NUMBER && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PAIR_NUMBER);
        log('pairing_code_generated', { phone: maskedPhone(PAIR_NUMBER) });
        console.log(`\nPAIRING CODE: ${code}\nWhatsApp -> Settings -> Linked devices -> Link a device -> Link with phone number instead.\n`);
      } catch (e) {
        errorLog('pairing_code_failed', { error: e?.message || String(e) });
      }
    }, 3000);
  }

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    log('credentials_saved');
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      lastQR = qr;
      log('qr_generated');
      if (process.env.WA_PRINT_QR === '1') {
        console.log('\nScan this QR in WhatsApp -> Linked devices -> Link a device:\n');
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'open') {
      ready = true;
      genuinelyLoggedOut = false;
      lastQR = null;
      reconnectAttempts = 0;
      currentNumber = numberFromJid(sock.user?.id);
      log('whatsapp_ready', { number: maskedPhone(currentNumber), queued: pendingSends.length });
      flushQueue();
      return;
    }

    if (connection !== 'close') return;

    ready = false;
    const code = lastDisconnect?.error?.output?.statusCode;
    const reason = Object.keys(DisconnectReason).find((key) => DisconnectReason[key] === code) || 'unknown';
    const message = lastDisconnect?.error?.message || '';
    warn('whatsapp_disconnected', { code, reason, message });

    if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
      currentNumber = null;
      lastQR = null;
      genuinelyLoggedOut = true;
      warn('session_genuinely_logged_out', { code, reason, authDir: AUTH_DIR });
      return;
    }

    if (code === DisconnectReason.connectionReplaced) {
      warn('connection_replaced_duplicate_client', { code, reason });
      return;
    }

    if (manualLogout || shuttingDown) return;

    reconnectAttempts = Math.min(reconnectAttempts + 1, 8);
    const baseDelay = code === DisconnectReason.restartRequired ? 1000 : 3000 * (2 ** (reconnectAttempts - 1));
    const delay = Math.min(baseDelay, MAX_RECONNECT_DELAY_MS);
    log('reconnect_scheduled', { attempt: reconnectAttempts, delayMs: delay, code, reason });
    reconnectTimer = setTimeout(() => startSock(), delay);
  });
}

async function freshAuth() {
  manualLogout = true;
  destroySocket();
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
  prepareDirs();
  ready = false;
  currentNumber = null;
  lastQR = null;
  genuinelyLoggedOut = false;
  manualLogout = false;
  log('fresh_auth_started', { authDir: AUTH_DIR });
  await startSock();
}

async function requestPairing(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('phone required');
  if (ready) return { alreadyConnected: true, number: currentNumber };
  await freshAuth();
  await sleep(2500);
  const code = await sock.requestPairingCode(digits);
  log('pairing_code_issued', { phone: maskedPhone(digits) });
  return { pairingCode: code };
}

async function startForQR() {
  if (ready) return { alreadyConnected: true, number: currentNumber };
  await freshAuth();
  for (let i = 0; i < 40 && !lastQR; i++) await sleep(400);
  if (!lastQR) throw new Error('no QR yet - try again in a moment');
  return { qr: await QRCode.toDataURL(lastQR, { margin: 1, width: 320 }) };
}

async function logoutAndReset() {
  manualLogout = true;
  try { await sock?.logout(); } catch {}
  destroySocket();
  ready = false;
  currentNumber = null;
  lastQR = null;
  genuinelyLoggedOut = true;
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
  prepareDirs();
  log('manual_logout_session_deleted', { authDir: AUTH_DIR });
  manualLogout = false;
  await startSock();
  return { ok: true };
}

const jidOf = (phone) => `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;

async function sendMessage({ to, body, mediaUrl, mediaBase64, mediaFilename }) {
  if (!ready) throw new Error('WhatsApp not connected yet');
  const digits = String(to || '').replace(/\D/g, '');
  if (!digits || !body?.trim()) throw new Error('to and body are required');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const jid = jidOf(phone);

  try {
    const [res] = await sock.onWhatsApp(jid);
    if (!res?.exists) throw new Error('Number is not on WhatsApp');
  } catch (e) {
    if (String(e.message).includes('not on WhatsApp')) throw e;
  }

  let buf = null;
  let isPdf = (mediaFilename || '').toLowerCase().endsWith('.pdf');
  if (mediaBase64) {
    buf = Buffer.from(String(mediaBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  } else if (mediaUrl) {
    const resp = await fetch(mediaUrl);
    if (!resp.ok) throw new Error(`media fetch ${resp.status}`);
    buf = Buffer.from(await resp.arrayBuffer());
    if ((resp.headers.get('content-type') || '').includes('pdf')) isPdf = true;
  }

  if (buf) {
    const content = isPdf
      ? { document: buf, mimetype: 'application/pdf', fileName: mediaFilename || 'document.pdf', caption: body }
      : { image: buf, caption: body };
    try {
      await withTimeout(sock.sendMessage(jid, content), 30000, 'media send');
    } catch (e) {
      warn('media_send_failed_fallback_text', { error: e?.message || String(e) });
      await sock.sendMessage(jid, { text: body });
    }
  } else {
    await sock.sendMessage(jid, { text: body });
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function enqueueSend(payload, reason) {
  if (pendingSends.length >= MAX_QUEUE_SIZE) throw new Error('WhatsApp queue is full');
  const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  pendingSends.push({ id, payload, attempts: 0, nextAt: Date.now(), reason });
  warn('notification_queued', { id, reason, queued: pendingSends.length });
  scheduleQueueFlush();
  return id;
}

function scheduleQueueFlush(delay = QUEUE_RETRY_MS) {
  if (queueTimer || shuttingDown) return;
  queueTimer = setTimeout(() => {
    queueTimer = null;
    flushQueue();
  }, delay);
}

async function flushQueue() {
  if (!ready || pendingSends.length === 0 || shuttingDown) {
    if (!ready && pendingSends.length > 0 && !genuinelyLoggedOut) scheduleQueueFlush();
    return;
  }

  const now = Date.now();
  for (let i = 0; i < pendingSends.length; i++) {
    const item = pendingSends[i];
    if (item.nextAt > now) continue;
    item.attempts += 1;
    try {
      await sendMessage(item.payload);
      pendingSends.splice(i, 1);
      i -= 1;
      log('queued_notification_sent', { id: item.id, attempts: item.attempts, queued: pendingSends.length });
    } catch (e) {
      const msg = e?.message || String(e);
      if (item.attempts >= QUEUE_MAX_ATTEMPTS || /not on WhatsApp|to and body are required/i.test(msg)) {
        pendingSends.splice(i, 1);
        i -= 1;
        errorLog('queued_notification_failed_permanently', { id: item.id, attempts: item.attempts, error: msg, queued: pendingSends.length });
      } else {
        item.nextAt = Date.now() + Math.min(QUEUE_RETRY_MS * item.attempts, 120_000);
        warn('queued_notification_retry', { id: item.id, attempts: item.attempts, error: msg, nextDelayMs: item.nextAt - Date.now() });
      }
    }
  }
  if (pendingSends.length > 0) scheduleQueueFlush();
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 15_000_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); }
    });
  });
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = req.url?.split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, ready, queued: pendingSends.length, loggedOut: genuinelyLoggedOut });
  }

  const authed = req.headers['x-api-key'] === API_SECRET;

  if (req.method === 'GET' && url === '/status') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    let qr = null;
    if (!ready && lastQR) {
      try { qr = await QRCode.toDataURL(lastQR, { margin: 1, width: 320 }); } catch {}
    }
    return json(res, 200, {
      ok: true,
      connected: ready,
      number: currentNumber,
      qr,
      loggedOut: genuinelyLoggedOut,
      queued: pendingSends.length,
      authDir: AUTH_DIR,
    });
  }

  if (req.method === 'POST' && url === '/login') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    const payload = await readJson(req);
    if (!payload) return json(res, 400, { ok: false, error: 'invalid json' });
    try {
      const result = payload.mode === 'qr' ? await startForQR() : await requestPairing(payload.phone);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      errorLog('login_failed', { error: e?.message || String(e) });
      return json(res, 400, { ok: false, error: String(e?.message || e) });
    }
  }

  if (req.method === 'POST' && url === '/logout') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    try {
      await logoutAndReset();
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 400, { ok: false, error: String(e?.message || e) });
    }
  }

  if (req.method === 'POST' && url === '/send') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    const payload = await readJson(req);
    if (!payload) return json(res, 400, { ok: false, error: 'invalid json' });
    try {
      if (!ready) {
        if (genuinelyLoggedOut) return json(res, 503, { ok: false, error: 'WhatsApp session logged out; relink required' });
        const id = enqueueSend(payload, 'not_ready');
        return json(res, 202, { ok: true, queued: true, id });
      }
      await sendMessage(payload);
      log('notification_sent', { to: maskedPhone(payload.to) });
      return json(res, 200, { ok: true });
    } catch (e) {
      const msg = e?.message || String(e);
      errorLog('send_failed', { error: msg });
      return json(res, ready ? 400 : 503, { ok: false, error: msg });
    }
  }

  return json(res, 404, { ok: false, error: 'not found' });
});

acquireProcessLock();
log('service_startup', {
  port: PORT,
  cwd: WORKER_ROOT,
  dataDir: DATA_DIR,
  authDir: AUTH_DIR,
  authExists: hasAuthFiles(),
  node: process.version,
});

const { state: bootState } = await useMultiFileAuthState(AUTH_DIR);
if (bootState.creds.registered || PAIR_NUMBER) {
  await startSock();
} else {
  log('whatsapp_not_linked', { authDir: AUTH_DIR });
}

server.listen(PORT, '0.0.0.0', () => log('http_listening', { port: PORT, health: '/health' }));

startTunnel(PORT).catch((e) => errorLog('tunnel_setup_error', { error: e?.message || String(e) }));

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown_started', { signal, queued: pendingSends.length });
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (queueTimer) clearTimeout(queueTimer);
  await new Promise((resolve) => server.close(resolve));
  destroySocket();
  await sleep(500);
  releaseProcessLock();
  log('shutdown_complete', { signal });
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (e) => {
  errorLog('uncaught_exception', { error: e?.message || String(e) });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (e) => {
  errorLog('unhandled_rejection', { error: e?.message || String(e) });
});
