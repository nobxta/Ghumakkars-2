import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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
const QUEUE_FILE = path.resolve(DATA_DIR, 'whatsapp-send-queue.json');
const LOG_DIR = path.resolve(DATA_DIR, 'logs');
const LOG_FILE = path.resolve(LOG_DIR, 'whatsapp-worker.jsonl');
const MAX_RECONNECT_DELAY_MS = Number(process.env.WA_MAX_RECONNECT_DELAY_MS || 60_000);
const MAX_QUEUE_SIZE = Number(process.env.WA_MAX_QUEUE_SIZE || 100);
const QUEUE_RETRY_MS = Number(process.env.WA_QUEUE_RETRY_MS || 15_000);
const QUEUE_MAX_ATTEMPTS = Number(process.env.WA_QUEUE_MAX_ATTEMPTS || 12);
const BAD_SESSION_RECOVERY_ATTEMPTS = Number(process.env.WA_BAD_SESSION_RECOVERY_ATTEMPTS || 3);
const LOG_MAX_BYTES = Number(process.env.WA_LOG_MAX_BYTES || 5_000_000);

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
let startPromise = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let stableTimer = null;
let lockFd = null;
let shuttingDown = false;
let queueTimer = null;
let lastDisconnectInfo = null;
let lastConnectedAt = null;
let lastMessageAt = null;
let stateLabel = 'starting';
let socketSeq = 0;
let currentSocketId = null;
let badSessionAttempts = 0;
const pendingSends = [];

const numberFromJid = (id) => (id ? String(id).split(':')[0].split('@')[0] : null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeJson(value) {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

function persistLogLine(line) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    try {
      if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > LOG_MAX_BYTES) {
        const rotated = path.resolve(LOG_DIR, `whatsapp-worker-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
        renameSync(LOG_FILE, rotated);
      }
    } catch {}
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {}
}

function emit(level, event, data = {}) {
  const line = safeJson({ ts: new Date().toISOString(), service: 'whatsapp-worker', level, event, ...data });
  persistLogLine(line);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function log(event, data = {}) {
  emit('info', event, data);
}

function warn(event, data = {}) {
  emit('warn', event, data);
}

function errorLog(event, data = {}) {
  emit('error', event, data);
}

function maskedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits ? '****' : '';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function hasAuthFiles() {
  return existsSync(path.join(AUTH_DIR, 'creds.json'));
}

function setState(state, data = {}) {
  stateLabel = state;
  log('connection_state', { state, socketId: currentSocketId, ...data });
}

function prepareDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(AUTH_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
}

function scheduleReconnect(state, data = {}, delayOverride = null) {
  if (manualLogout || shuttingDown) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempts = Math.min(reconnectAttempts + 1, 8);
  const baseDelay = delayOverride == null ? 3000 * (2 ** (reconnectAttempts - 1)) : delayOverride;
  const delay = Math.min(baseDelay + Math.floor(Math.random() * 750), MAX_RECONNECT_DELAY_MS);
  setState(state, { attempt: reconnectAttempts, delayMs: delay, ...data });
  log('reconnect_scheduled', { state, attempt: reconnectAttempts, delayMs: delay, ...data });
  reconnectTimer = setTimeout(() => startSock(), delay);
}

function persistQueue() {
  try {
    prepareDirs();
    const tmp = `${QUEUE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items: pendingSends }, null, 2));
    renameSync(tmp, QUEUE_FILE);
    log('queue_persisted', { queued: pendingSends.length, queueFile: QUEUE_FILE });
  } catch (e) {
    errorLog('queue_persist_failed', { error: e?.message || String(e), queueFile: QUEUE_FILE });
  }
}

function loadQueue() {
  try {
    if (!existsSync(QUEUE_FILE)) return;
    const parsed = JSON.parse(readFileSync(QUEUE_FILE, 'utf8') || '{}');
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    pendingSends.splice(0, pendingSends.length, ...items);
    log('queue_loaded', { queued: pendingSends.length, queueFile: QUEUE_FILE });
  } catch (e) {
    errorLog('queue_load_failed', { error: e?.message || String(e), queueFile: QUEUE_FILE });
  }
}

function tailLogLines(limit = 200) {
  try {
    if (!existsSync(LOG_FILE)) return [];
    const lines = readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-Math.max(1, Math.min(limit, 1000))).map((line) => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
  } catch {
    return [];
  }
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
  const oldSocketId = currentSocketId;
  try { sock?.ev?.removeAllListeners?.(); } catch {}
  try { sock?.end?.(undefined); } catch {}
  sock = null;
  currentSocketId = null;
  if (oldSocketId) log('socket_destroyed', { socketId: oldSocketId });
}

async function startSock() {
  if (shuttingDown) return;
  if (startPromise) return startPromise;
  startPromise = startSockInner().catch((e) => {
    starting = false;
    ready = false;
    const msg = e?.message || String(e);
    lastDisconnectInfo = { code: 'startup', reason: 'startup_failed', message: msg, at: new Date().toISOString() };
    errorLog('socket_start_failed', { error: msg, authExists: hasAuthFiles() });
    scheduleReconnect('reconnecting', { reason: 'startup_failed' });
  }).finally(() => {
    startPromise = null;
  });
  return startPromise;
}

async function startSockInner() {
  if (starting || shuttingDown) return;
  starting = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (stableTimer) {
    clearTimeout(stableTimer);
    stableTimer = null;
  }

  destroySocket();
  prepareDirs();
  setState(hasAuthFiles() ? 'connecting' : 'disconnected', { authDir: AUTH_DIR, authExists: hasAuthFiles() });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  currentSocketId = `sock_${Date.now()}_${++socketSeq}`;
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
  log('socket_created', { socketId: currentSocketId, registered: !!sock.authState.creds.registered });

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
    try {
      await saveCreds();
      log('credentials_saved', { socketId: currentSocketId, authDir: AUTH_DIR });
    } catch (e) {
      errorLog('credentials_save_failed', { socketId: currentSocketId, error: e?.message || String(e) });
    }
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
      badSessionAttempts = 0;
      lastQR = null;
      lastDisconnectInfo = null;
      lastConnectedAt = new Date().toISOString();
      currentNumber = numberFromJid(sock.user?.id);
      setState('connected', { number: maskedPhone(currentNumber), queued: pendingSends.length });
      stableTimer = setTimeout(() => {
        reconnectAttempts = 0;
        log('connection_stable', { socketId: currentSocketId, stableForMs: 30_000 });
      }, 30_000);
      flushQueue();
      return;
    }

    if (connection !== 'close') return;

    ready = false;
    const code = lastDisconnect?.error?.output?.statusCode;
    const reason = Object.keys(DisconnectReason).find((key) => DisconnectReason[key] === code) || 'unknown';
    const message = lastDisconnect?.error?.message || '';
    const stackHead = String(lastDisconnect?.error?.stack || '').split('\n').slice(0, 3).join(' | ');
    lastDisconnectInfo = { code, reason, message, at: new Date().toISOString(), stackHead };
    warn('whatsapp_disconnected', { socketId: currentSocketId, code, reason, message, authExists: hasAuthFiles() });
    if (stableTimer) {
      clearTimeout(stableTimer);
      stableTimer = null;
    }

    if (code === DisconnectReason.loggedOut) {
      lastQR = null;
      genuinelyLoggedOut = false;
      warn('remote_logged_out_ignored', {
        code,
        reason,
        authDir: AUTH_DIR,
        authExists: hasAuthFiles(),
        note: 'Worker did not call logout and did not delete auth. Recovering saved session because only manual admin logout should end the local session.',
      });
      scheduleReconnect('recovering_session', { code, reason, authDir: AUTH_DIR }, 10_000);
      return;
    }

    if (code === DisconnectReason.badSession) {
      lastQR = null;
      badSessionAttempts += 1;
      const canRecover = hasAuthFiles() && badSessionAttempts <= BAD_SESSION_RECOVERY_ATTEMPTS;
      warn('bad_session_observed', {
        code,
        reason,
        message,
        attempt: badSessionAttempts,
        maxAttempts: BAD_SESSION_RECOVERY_ATTEMPTS,
        authDir: AUTH_DIR,
        authExists: hasAuthFiles(),
        pid: process.pid,
      });

      if (!canRecover) {
        genuinelyLoggedOut = false;
        errorLog('bad_session_recovery_continues', {
          code,
          reason,
          message,
          attempts: badSessionAttempts,
          authDir: AUTH_DIR,
          authExists: hasAuthFiles(),
          pid: process.pid,
          note: 'Auth was not deleted and logout was not called. Worker will keep retrying until manual admin logout/relink.',
        });
        scheduleReconnect('recovering_session', { code, reason, authDir: AUTH_DIR, attempts: badSessionAttempts }, MAX_RECONNECT_DELAY_MS);
        return;
      }

      scheduleReconnect('recovering_session', {
        attempt: badSessionAttempts,
        maxAttempts: BAD_SESSION_RECOVERY_ATTEMPTS,
        code,
        reason,
      }, 2000 * badSessionAttempts);
      return;
    }

    if (code === DisconnectReason.connectionReplaced) {
      genuinelyLoggedOut = false;
      warn('connection_replaced_duplicate_client', { code, reason, authDir: AUTH_DIR });
      scheduleReconnect('duplicate_session', { code, reason, authDir: AUTH_DIR }, 30_000);
      return;
    }

    if (manualLogout || shuttingDown) return;

    scheduleReconnect('reconnecting', { code, reason }, code === DisconnectReason.restartRequired ? 1000 : null);
  });
}

async function freshAuth(reason = 'manual_relink') {
  manualLogout = true;
  destroySocket();
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
  prepareDirs();
  ready = false;
  currentNumber = null;
  lastQR = null;
  genuinelyLoggedOut = false;
  badSessionAttempts = 0;
  lastDisconnectInfo = null;
  manualLogout = false;
  setState('connecting', { authDir: AUTH_DIR, reason });
  log('fresh_auth_started', { authDir: AUTH_DIR, reason });
  await startSock();
}

async function ensureLoginCanCreateNewSession(forceRelink) {
  if (ready) return { alreadyConnected: true, number: currentNumber };
  if (hasAuthFiles() && !forceRelink) {
    if (!sock && !starting) await startSock();
    return {
      recoveringExistingSession: true,
      state: stateLabel,
      message: 'Existing WhatsApp session found. Reconnecting with saved credentials; use Disconnect and relink to replace it.',
    };
  }
  await freshAuth(forceRelink ? 'forced_relink' : 'new_link');
  return null;
}

async function requestPairing(phone, forceRelink = false) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('phone required');
  const existing = await ensureLoginCanCreateNewSession(forceRelink);
  if (existing) return existing;
  await sleep(2500);
  const code = await sock.requestPairingCode(digits);
  log('pairing_code_issued', { phone: maskedPhone(digits) });
  return { pairingCode: code };
}

async function startForQR(forceRelink = false) {
  const existing = await ensureLoginCanCreateNewSession(forceRelink);
  if (existing) return existing;
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
  badSessionAttempts = 0;
  lastDisconnectInfo = { code: 'manual', reason: 'manual_logout', message: 'Disconnected by admin', at: new Date().toISOString() };
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch {}
  prepareDirs();
  setState('relink_required', { authDir: AUTH_DIR, reason: 'manual_logout' });
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
  lastMessageAt = new Date().toISOString();
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
  persistQueue();
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
      persistQueue();
      log('queued_notification_sent', { id: item.id, attempts: item.attempts, queued: pendingSends.length });
    } catch (e) {
      const msg = e?.message || String(e);
      if (item.attempts >= QUEUE_MAX_ATTEMPTS || /not on WhatsApp|to and body are required/i.test(msg)) {
        pendingSends.splice(i, 1);
        i -= 1;
        persistQueue();
        errorLog('queued_notification_failed_permanently', { id: item.id, attempts: item.attempts, error: msg, queued: pendingSends.length });
      } else {
        item.nextAt = Date.now() + Math.min(QUEUE_RETRY_MS * item.attempts, 120_000);
        persistQueue();
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
    return json(res, 200, { ok: true, ready, state: stateLabel, queued: pendingSends.length, loggedOut: genuinelyLoggedOut });
  }

  const authed = req.headers['x-api-key'] === API_SECRET;

  if (req.method === 'GET' && url === '/logs') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    const params = new URL(req.url || '/logs', 'http://localhost').searchParams;
    const limit = Number(params.get('limit') || 200);
    return json(res, 200, { ok: true, logFile: LOG_FILE, lines: tailLogLines(limit) });
  }

  if (req.method === 'GET' && url === '/status') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    let qr = null;
    if (!ready && lastQR) {
      try { qr = await QRCode.toDataURL(lastQR, { margin: 1, width: 320 }); } catch {}
    }
    return json(res, 200, {
      ok: true,
      connected: ready,
      state: stateLabel,
      number: currentNumber,
      qr,
      loggedOut: genuinelyLoggedOut,
      relinkRequired: genuinelyLoggedOut,
      queued: pendingSends.length,
      retryAttempt: reconnectAttempts,
      lastConnectedAt,
      lastDisconnect: lastDisconnectInfo,
      lastMessageAt,
      authDir: AUTH_DIR,
      authExists: hasAuthFiles(),
      logFile: LOG_FILE,
      pid: process.pid,
      socketId: currentSocketId,
    });
  }

  if (req.method === 'POST' && url === '/login') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    const payload = await readJson(req);
    if (!payload) return json(res, 400, { ok: false, error: 'invalid json' });
    try {
      const forceRelink = payload.forceRelink === true;
      log('login_requested', { mode: payload.mode === 'qr' ? 'qr' : 'pairing', forceRelink, phone: maskedPhone(payload.phone) });
      const result = payload.mode === 'qr' ? await startForQR(forceRelink) : await requestPairing(payload.phone, forceRelink);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      errorLog('login_failed', { error: e?.message || String(e) });
      return json(res, 400, { ok: false, error: String(e?.message || e) });
    }
  }

  if (req.method === 'POST' && url === '/logout') {
    if (!authed) return json(res, 401, { ok: false, error: 'unauthorized' });
    try {
      warn('manual_logout_requested', { remoteAddress: req.socket?.remoteAddress || null });
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
      log('send_requested', {
        to: maskedPhone(payload.to),
        hasMediaUrl: !!payload.mediaUrl,
        hasMediaBase64: !!payload.mediaBase64,
        mediaFilename: payload.mediaFilename || null,
        ready,
        state: stateLabel,
      });
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
loadQueue();
log('service_startup', {
  port: PORT,
  cwd: WORKER_ROOT,
  dataDir: DATA_DIR,
  authDir: AUTH_DIR,
  authExists: hasAuthFiles(),
  queued: pendingSends.length,
  node: process.version,
});

const { state: bootState } = await useMultiFileAuthState(AUTH_DIR);
if (bootState.creds.registered || PAIR_NUMBER) {
  await startSock();
} else {
  setState('disconnected', { authDir: AUTH_DIR, authExists: hasAuthFiles() });
  log('whatsapp_not_linked', { authDir: AUTH_DIR });
}

server.listen(PORT, '0.0.0.0', () => log('http_listening', { port: PORT, health: '/health' }));

startTunnel(PORT).catch((e) => errorLog('tunnel_setup_error', { error: e?.message || String(e) }));

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown_started', { signal, queued: pendingSends.length });
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (stableTimer) clearTimeout(stableTimer);
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
