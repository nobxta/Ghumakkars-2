/**
 * WhatsApp service — runs INSIDE the Next.js server process (Baileys).
 *
 * The site runs as one long-lived `next start` process on our VPS, so the
 * WhatsApp socket lives here too: no separate worker, no tunnel, no HTTP hop.
 *
 *  - Booted on server start by `instrumentation.ts` (and lazily on first use).
 *  - One instance per process, kept on `globalThis` so dev hot-reload and
 *    separately bundled route handlers all share the same socket.
 *  - Session + queue + logs persist in WA_DATA_DIR (default `./data/whatsapp`).
 *  - A lock file guarantees only ONE process links this number. Run the app
 *    as a single instance (PM2 fork mode, not cluster).
 *
 * Server-only. Never import from a client component.
 */
import path from 'node:path';
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { rm } from 'node:fs/promises';

// ── Config ────────────────────────────────────────────────────────────────
const DATA_DIR = path.resolve(process.env.WA_DATA_DIR || path.join(process.cwd(), 'data', 'whatsapp'));
const AUTH_DIR = path.resolve(process.env.WA_AUTH_DIR || path.join(DATA_DIR, 'session'));
const LOCK_FILE = path.join(DATA_DIR, 'whatsapp-client.lock');
const QUEUE_FILE = path.join(DATA_DIR, 'send-queue.json');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'whatsapp.jsonl');
const MAX_RECONNECT_DELAY_MS = Number(process.env.WA_MAX_RECONNECT_DELAY_MS || 60_000);
const MAX_QUEUE_SIZE = Number(process.env.WA_MAX_QUEUE_SIZE || 100);
const QUEUE_RETRY_MS = Number(process.env.WA_QUEUE_RETRY_MS || 15_000);
const QUEUE_MAX_ATTEMPTS = Number(process.env.WA_QUEUE_MAX_ATTEMPTS || 12);
const BAD_SESSION_RECOVERY_ATTEMPTS = Number(process.env.WA_BAD_SESSION_RECOVERY_ATTEMPTS || 3);
const LOG_MAX_BYTES = Number(process.env.WA_LOG_MAX_BYTES || 5_000_000);

export interface SendPayload {
  to: string;
  body: string;
  mediaUrl?: string | null;
  mediaBase64?: string | null;
  mediaFilename?: string | null;
}

interface QueueItem { id: string; payload: SendPayload; attempts: number; nextAt: number; reason: string; createdAt?: number }

interface WAState {
  booted: boolean;
  bootPromise: Promise<void> | null;
  disabledReason: string | null; // set when another process holds the lock
  lockFd: number | null;
  sock: any;
  ready: boolean;
  currentNumber: string | null;
  manualLogout: boolean;
  loggedOut: boolean;
  lastQR: string | null;
  starting: boolean;
  startPromise: Promise<void> | null;
  reconnectTimer: NodeJS.Timeout | null;
  reconnectAttempts: number;
  stableTimer: NodeJS.Timeout | null;
  queueTimer: NodeJS.Timeout | null;
  lastDisconnect: Record<string, unknown> | null;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  stateLabel: string;
  socketSeq: number;
  socketId: string | null;
  badSessionAttempts: number;
  pending: QueueItem[];
  loggedOutStreak: number;   // consecutive 401s
  replacedStreak: number;    // consecutive 440s (another client on this session)
  problem: string | null;    // human-readable issue shown in the admin panel
  lockRetryTimer: NodeJS.Timeout | null;
  sent: Map<string, any>;    // recent sent messages, for WhatsApp's resend requests
}

const g = globalThis as unknown as { __ghumakkarsWhatsApp?: WAState };
const S: WAState = (g.__ghumakkarsWhatsApp ??= {
  booted: false, bootPromise: null, disabledReason: null, lockFd: null,
  sock: null, ready: false, currentNumber: null, manualLogout: false, loggedOut: false,
  lastQR: null, starting: false, startPromise: null, reconnectTimer: null,
  reconnectAttempts: 0, stableTimer: null, queueTimer: null, lastDisconnect: null,
  lastConnectedAt: null, lastMessageAt: null, stateLabel: 'not_started', socketSeq: 0,
  socketId: null, badSessionAttempts: 0, pending: [],
  loggedOutStreak: 0, replacedStreak: 0, problem: null, lockRetryTimer: null, sent: new Map(),
});
// Fill fields added after a hot-reload kept an older state object around.
S.sent ??= new Map();
S.loggedOutStreak ??= 0;
S.replacedStreak ??= 0;
S.problem ??= null;

const QUEUE_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SENT_STORE_MAX = 500;
const LOGGED_OUT_RETRIES = 2;   // 401s tolerated before asking for a relink
const REPLACED_RETRIES = 1;     // 440s tolerated before backing off

// Baileys is heavy and Node-only: load it on demand, never at import time.
async function baileys() {
  const mod: any = await import('@whiskeysockets/baileys');
  return {
    makeWASocket: mod.default?.default ?? mod.default ?? mod.makeWASocket,
    DisconnectReason: mod.DisconnectReason ?? mod.default?.DisconnectReason,
    fetchLatestBaileysVersion: mod.fetchLatestBaileysVersion ?? mod.default?.fetchLatestBaileysVersion,
    loadAuthState: mod.useMultiFileAuthState ?? mod.default?.useMultiFileAuthState,
    cacheableKeys: mod.makeCacheableSignalKeyStore ?? mod.default?.makeCacheableSignalKeyStore,
  };
}
let pinoLogger: any = null;
async function baileysLogger() {
  if (!pinoLogger) {
    const pino: any = (await import('pino')).default;
    pinoLogger = pino({ level: process.env.WA_BAILEYS_LOG_LEVEL || 'silent' });
  }
  return pinoLogger;
}

// ── Logging ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const numberFromJid = (id?: string | null) => (id ? String(id).split(':')[0].split('@')[0] : null);
const errMsg = (e: unknown) => (e as any)?.message || String(e);

function emit(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify(
    { ts: new Date().toISOString(), service: 'whatsapp', level, event, ...data },
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
  );
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    try {
      if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > LOG_MAX_BYTES) {
        renameSync(LOG_FILE, path.join(LOG_DIR, `whatsapp-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`));
      }
    } catch { /* ignore */ }
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch { /* ignore */ }
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
const log = (e: string, d?: Record<string, unknown>) => emit('info', e, d);
const warn = (e: string, d?: Record<string, unknown>) => emit('warn', e, d);
const errorLog = (e: string, d?: Record<string, unknown>) => emit('error', e, d);

function maskedPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits ? '****' : '';
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

const hasAuthFiles = () => existsSync(path.join(AUTH_DIR, 'creds.json'));

function setState(state: string, data: Record<string, unknown> = {}) {
  S.stateLabel = state;
  log('connection_state', { state, socketId: S.socketId, ...data });
}

function prepareDirs() {
  mkdirSync(AUTH_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
}

// ── Single-process lock ───────────────────────────────────────────────────
function acquireLock(): boolean {
  prepareDirs();
  try {
    S.lockFd = openSync(LOCK_FILE, 'wx');
    writeFileSync(S.lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    process.once('exit', releaseLock);
    log('process_lock_acquired', { lockFile: LOCK_FILE, pid: process.pid });
    return true;
  } catch (e) {
    let existingPid: number | null = null;
    try { existingPid = JSON.parse(readFileSync(LOCK_FILE, 'utf8') || '{}')?.pid ?? null; } catch { /* ignore */ }
    if (existingPid === process.pid) return true;
    if (existingPid) {
      try {
        process.kill(existingPid, 0);
        S.disabledReason = `Another process (pid ${existingPid}) is already running WhatsApp. Run the app as a single instance.`;
        errorLog('duplicate_process_rejected', { lockFile: LOCK_FILE, existingPid, pid: process.pid });
        return false;
      } catch {
        warn('stale_process_lock_removed', { lockFile: LOCK_FILE, existingPid });
        try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
        return acquireLock();
      }
    }
    S.disabledReason = `Could not create WhatsApp lock file: ${errMsg(e)}`;
    errorLog('process_lock_failed', { lockFile: LOCK_FILE, error: errMsg(e) });
    return false;
  }
}

function releaseLock() {
  try { if (S.lockFd !== null) closeSync(S.lockFd); } catch { /* ignore */ }
  try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
  S.lockFd = null;
}

// ── Queue (survives restarts) ─────────────────────────────────────────────
function persistQueue() {
  try {
    prepareDirs();
    const tmp = `${QUEUE_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), items: S.pending }, null, 2));
    renameSync(tmp, QUEUE_FILE);
  } catch (e) {
    errorLog('queue_persist_failed', { error: errMsg(e) });
  }
}

function loadQueue() {
  try {
    if (!existsSync(QUEUE_FILE)) return;
    const parsed = JSON.parse(readFileSync(QUEUE_FILE, 'utf8') || '{}');
    const saved: QueueItem[] = Array.isArray(parsed?.items) ? parsed.items : [];
    const known = new Set(S.pending.map((i) => i.id));
    // Merge: anything queued in this process before boot finished is kept.
    S.pending.unshift(...saved.filter((i) => !known.has(i.id)));
    dropExpired();
    log('queue_loaded', { queued: S.pending.length });
  } catch (e) {
    errorLog('queue_load_failed', { error: errMsg(e) });
  }
}

// Messages older than 48h are stale (e.g. "seat locked" two days later) — drop them.
function dropExpired() {
  const cutoff = Date.now() - QUEUE_MAX_AGE_MS;
  const before = S.pending.length;
  for (let i = S.pending.length - 1; i >= 0; i--) {
    if ((S.pending[i].createdAt ?? Date.now()) < cutoff) S.pending.splice(i, 1);
  }
  if (S.pending.length !== before) warn('queue_expired_dropped', { dropped: before - S.pending.length });
}

function enqueue(payload: SendPayload, reason: string) {
  dropExpired();
  if (S.pending.length >= MAX_QUEUE_SIZE) throw new Error('WhatsApp queue is full');
  const id = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  S.pending.push({ id, payload, attempts: 0, nextAt: Date.now(), reason, createdAt: Date.now() });
  warn('notification_queued', { id, reason, queued: S.pending.length });
  persistQueue();
  scheduleQueueFlush();
  return id;
}

function scheduleQueueFlush(delay = QUEUE_RETRY_MS) {
  if (S.queueTimer) return;
  S.queueTimer = setTimeout(() => { S.queueTimer = null; void flushQueue(); }, delay);
}

async function flushQueue() {
  dropExpired();
  if (!S.ready || S.pending.length === 0) {
    if (!S.ready && S.pending.length > 0 && !S.loggedOut) scheduleQueueFlush();
    return;
  }
  const now = Date.now();
  for (let i = 0; i < S.pending.length; i++) {
    const item = S.pending[i];
    if (item.nextAt > now) continue;
    item.attempts += 1;
    try {
      await deliver(item.payload);
      S.pending.splice(i--, 1);
      persistQueue();
      log('queued_notification_sent', { id: item.id, attempts: item.attempts, queued: S.pending.length });
    } catch (e) {
      const msg = errMsg(e);
      if (item.attempts >= QUEUE_MAX_ATTEMPTS || /not on WhatsApp|to and body are required/i.test(msg)) {
        S.pending.splice(i--, 1);
        errorLog('queued_notification_failed_permanently', { id: item.id, attempts: item.attempts, error: msg });
      } else {
        item.nextAt = Date.now() + Math.min(QUEUE_RETRY_MS * item.attempts, 120_000);
        warn('queued_notification_retry', { id: item.id, attempts: item.attempts, error: msg });
      }
      persistQueue();
    }
  }
  if (S.pending.length > 0) scheduleQueueFlush();
}

// ── Socket lifecycle ──────────────────────────────────────────────────────
function scheduleReconnect(state: string, data: Record<string, unknown> = {}, delayOverride: number | null = null) {
  if (S.manualLogout) return;
  if (S.reconnectTimer) clearTimeout(S.reconnectTimer);
  S.reconnectAttempts = Math.min(S.reconnectAttempts + 1, 8);
  const base = delayOverride ?? 3000 * 2 ** (S.reconnectAttempts - 1);
  const delay = Math.min(base + Math.floor(Math.random() * 750), MAX_RECONNECT_DELAY_MS);
  setState(state, { attempt: S.reconnectAttempts, delayMs: delay, ...data });
  S.reconnectTimer = setTimeout(() => void startSock(), delay);
}

function destroySocket() {
  const old = S.socketId;
  try { S.sock?.ev?.removeAllListeners?.(); } catch { /* ignore */ }
  try { S.sock?.end?.(undefined); } catch { /* ignore */ }
  S.sock = null;
  S.socketId = null;
  if (old) log('socket_destroyed', { socketId: old });
}

function startSock(): Promise<void> {
  if (S.startPromise) return S.startPromise;
  S.startPromise = startSockInner()
    .catch((e) => {
      S.starting = false;
      S.ready = false;
      S.lastDisconnect = { code: 'startup', reason: 'startup_failed', message: errMsg(e), at: new Date().toISOString() };
      errorLog('socket_start_failed', { error: errMsg(e), authExists: hasAuthFiles() });
      scheduleReconnect('reconnecting', { reason: 'startup_failed' });
    })
    .finally(() => { S.startPromise = null; });
  return S.startPromise;
}

async function startSockInner() {
  if (S.starting) return;
  S.starting = true;
  if (S.reconnectTimer) { clearTimeout(S.reconnectTimer); S.reconnectTimer = null; }
  if (S.stableTimer) { clearTimeout(S.stableTimer); S.stableTimer = null; }

  destroySocket();
  prepareDirs();
  setState(hasAuthFiles() ? 'connecting' : 'disconnected', { authExists: hasAuthFiles() });

  const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, loadAuthState, cacheableKeys } = await baileys();
  const logger = await baileysLogger();
  const { state, saveCreds } = await loadAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  S.socketId = `sock_${Date.now()}_${++S.socketSeq}`;
  const sock = makeWASocket({
    version,
    // Cached key store: fewer disk writes, no half-written key files.
    auth: { creds: state.creds, keys: cacheableKeys ? cacheableKeys(state.keys, logger) : state.keys },
    // When a recipient's phone can't decrypt a message it asks us to resend it.
    // Without this the message (often the ticket PDF) stays stuck on
    // "Waiting for this message" on their side.
    getMessage: async (key: any) => S.sent.get(key?.id) ?? undefined,
    logger,
    printQRInTerminal: false,
    browser: ['Ghumakkars', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
    retryRequestDelayMs: 2000,
    maxMsgRetryCount: 2,
  });
  S.sock = sock;
  S.starting = false;
  log('socket_created', { socketId: S.socketId, registered: !!sock.authState.creds.registered });

  sock.ev.on('creds.update', async () => {
    try { await saveCreds(); } catch (e) { errorLog('credentials_save_failed', { error: errMsg(e) }); }
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }: any) => {
    if (qr) { S.lastQR = qr; log('qr_generated'); }

    if (connection === 'open') {
      S.ready = true;
      S.loggedOut = false;
      S.badSessionAttempts = 0;
      S.lastQR = null;
      S.lastDisconnect = null;
      S.loggedOutStreak = 0;
      S.replacedStreak = 0;
      S.problem = null;
      S.lastConnectedAt = new Date().toISOString();
      S.currentNumber = numberFromJid(sock.user?.id);
      setState('connected', { number: maskedPhone(S.currentNumber), queued: S.pending.length });
      S.stableTimer = setTimeout(() => { S.reconnectAttempts = 0; }, 30_000);
      void flushQueue();
      return;
    }
    if (connection !== 'close') return;

    S.ready = false;
    const code = lastDisconnect?.error?.output?.statusCode;
    const reason = Object.keys(DisconnectReason).find((k) => DisconnectReason[k] === code) || 'unknown';
    const message = lastDisconnect?.error?.message || '';
    S.lastDisconnect = { code, reason, message, at: new Date().toISOString() };
    warn('whatsapp_disconnected', { socketId: S.socketId, code, reason, message, authExists: hasAuthFiles() });
    if (S.stableTimer) { clearTimeout(S.stableTimer); S.stableTimer = null; }

    // 401 = WhatsApp removed this linked device. A blip is retried briefly, but
    // hammering WhatsApp with a dead session forever gets numbers flagged — so
    // after a couple of tries we stop and ask the admin to relink.
    if (code === DisconnectReason.loggedOut) {
      S.lastQR = null;
      S.loggedOutStreak += 1;
      if (S.loggedOutStreak > LOGGED_OUT_RETRIES || !hasAuthFiles()) {
        void markRelinkRequired('WhatsApp logged this device out (removed from Linked devices, or the number was flagged). Link it again.', { code, reason });
        return;
      }
      warn('remote_logged_out_retry', { code, attempt: S.loggedOutStreak, maxAttempts: LOGGED_OUT_RETRIES });
      scheduleReconnect('recovering_session', { code, reason }, 15_000 * S.loggedOutStreak);
      return;
    }
    if (code === DisconnectReason.badSession) {
      S.lastQR = null;
      S.badSessionAttempts += 1;
      if (S.badSessionAttempts > BAD_SESSION_RECOVERY_ATTEMPTS || !hasAuthFiles()) {
        void markRelinkRequired('The saved WhatsApp session is corrupted. Link it again.', { code, reason });
        return;
      }
      warn('bad_session_observed', { code, attempt: S.badSessionAttempts, maxAttempts: BAD_SESSION_RECOVERY_ATTEMPTS });
      scheduleReconnect('recovering_session', { code, reason }, 2000 * S.badSessionAttempts);
      return;
    }
    // 440 = another client is using this same session (e.g. the old Pterodactyl
    // worker with a copied session folder). Fighting over it is what makes
    // WhatsApp log the device out, so back off and tell the admin.
    if (code === DisconnectReason.connectionReplaced) {
      S.replacedStreak += 1;
      if (S.replacedStreak > REPLACED_RETRIES) {
        if (S.reconnectTimer) { clearTimeout(S.reconnectTimer); S.reconnectTimer = null; }
        destroySocket();
        S.problem = 'Another server or app is using this same WhatsApp session (old Pterodactyl worker? a second copy of the site?). Stop it, then press QR login here to resume.';
        setState('duplicate_session', { code, reason });
        errorLog('connection_replaced_backing_off', { code, streak: S.replacedStreak });
        void alertAdmins('⚠️ <b>WhatsApp paused</b>\nAnother server is using the same WhatsApp session. Stop the other copy (old Pterodactyl worker?), then press QR login in Admin → Settings → WhatsApp to resume.');
        return;
      }
      warn('connection_replaced_duplicate_client', { code, reason, streak: S.replacedStreak });
      scheduleReconnect('duplicate_session', { code, reason }, 30_000);
      return;
    }
    if (S.manualLogout) return;
    scheduleReconnect('reconnecting', { code, reason }, code === DisconnectReason.restartRequired ? 1000 : null);
  });
}

/** Best-effort Telegram ping to admins (uses the bot configured in Settings). */
async function alertAdmins(html: string) {
  try {
    const { sendToAdmins } = await import('../telegram');
    await sendToAdmins(html);
  } catch { /* ignore */ }
}

/**
 * The saved session can no longer connect. Stop retrying, move the dead
 * session aside (kept as a backup, never deleted here) so the next "Link"
 * starts clean, and tell the admin. Queued messages are kept and go out once
 * the number is linked again.
 */
async function markRelinkRequired(message: string, data: Record<string, unknown> = {}) {
  if (S.reconnectTimer) { clearTimeout(S.reconnectTimer); S.reconnectTimer = null; }
  destroySocket();
  let backup: string | null = null;
  if (hasAuthFiles()) {
    backup = `${AUTH_DIR}-invalid-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try { renameSync(AUTH_DIR, backup); } catch { backup = null; }
  }
  prepareDirs();
  Object.assign(S, { ready: false, currentNumber: null, lastQR: null, loggedOut: true, problem: message });
  setState('relink_required', { ...data, backup });
  errorLog('relink_required', { message, backup, queued: S.pending.length, ...data });
  await alertAdmins(`⚠️ <b>WhatsApp disconnected</b>\n${message}\nAdmin → Settings → WhatsApp.${S.pending.length ? `\n${S.pending.length} message(s) waiting to send.` : ''}`);
}

async function freshAuth(reason: string) {
  S.manualLogout = true;
  destroySocket();
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  prepareDirs();
  Object.assign(S, { ready: false, currentNumber: null, lastQR: null, loggedOut: false, badSessionAttempts: 0, lastDisconnect: null, manualLogout: false, loggedOutStreak: 0, replacedStreak: 0, problem: null });
  log('fresh_auth_started', { reason });
  await startSock();
}

// ── Public API ────────────────────────────────────────────────────────────

/** Start WhatsApp for this process. Idempotent; safe to call from anywhere. */
export function bootWhatsApp(): Promise<void> {
  if (S.booted) return S.bootPromise ?? Promise.resolve();
  S.booted = true;
  S.bootPromise = (async () => {
    // Another live process holds the lock (e.g. the old one during a PM2
    // reload). Keep retrying instead of leaving WhatsApp off until next restart.
    while (!acquireLock()) {
      S.stateLabel = 'waiting_for_lock';
      await sleep(15_000);
    }
    S.disabledReason = null;
    loadQueue();
    log('service_startup', { dataDir: DATA_DIR, authExists: hasAuthFiles(), queued: S.pending.length, pid: process.pid });
    if (hasAuthFiles()) {
      await startSock();
    } else {
      setState('disconnected', { authExists: false });
      log('whatsapp_not_linked');
    }
  })().catch((e) => errorLog('boot_failed', { error: errMsg(e) }));
  return S.bootPromise;
}

// Never let a request hang on boot (it can wait on the lock): give it a few
// seconds, then carry on with whatever state we have.
async function ensureBooted() {
  await Promise.race([bootWhatsApp(), sleep(5000)]);
  if (S.stateLabel === 'waiting_for_lock' && S.disabledReason) throw new Error(S.disabledReason);
}

export async function getWhatsAppStatus() {
  await Promise.race([bootWhatsApp(), sleep(5000)]);
  let qr: string | null = null;
  if (!S.ready && S.lastQR) {
    try { qr = await (await import('qrcode')).toDataURL(S.lastQR, { margin: 1, width: 320 }); } catch { /* ignore */ }
  }
  return {
    connected: S.ready,
    state: S.stateLabel,
    number: S.currentNumber,
    qr,
    error: (S.stateLabel === 'waiting_for_lock' ? S.disabledReason : null) || S.problem,
    relinkRequired: S.loggedOut,
    queued: S.pending.length,
    retryAttempt: S.reconnectAttempts,
    lastConnectedAt: S.lastConnectedAt,
    lastDisconnect: S.lastDisconnect,
    lastMessageAt: S.lastMessageAt,
    authExists: hasAuthFiles(),
  };
}

async function ensureCanCreateNewSession(forceRelink: boolean) {
  await ensureBooted();
  if (S.ready) return { alreadyConnected: true, number: S.currentNumber };
  // Paused because another client used this session: resume with it.
  if (hasAuthFiles() && !forceRelink && S.stateLabel === 'duplicate_session' && !S.reconnectTimer) {
    S.replacedStreak = 0;
    S.problem = null;
    await startSock();
    return { recoveringExistingSession: true, state: S.stateLabel, message: 'Reconnecting with the saved session…' };
  }
  // A saved session that is still healthy-looking (just reconnecting):
  // don't throw it away. Anything stuck is replaced by a fresh link.
  const stuck = S.loggedOut || S.loggedOutStreak > 0 || S.badSessionAttempts > 0 || S.reconnectAttempts >= 3;
  if (hasAuthFiles() && !forceRelink && !stuck) {
    if (!S.sock && !S.starting) await startSock();
    return {
      recoveringExistingSession: true,
      state: S.stateLabel,
      message: 'Existing WhatsApp session found — reconnecting with it. Press Disconnect first to link a different number.',
    };
  }
  await freshAuth(forceRelink ? 'forced_relink' : 'new_link');
  return null;
}

/** Link by pairing code (entered on the phone). */
export async function requestPairingCode(phone: string, forceRelink = false) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('phone required');
  const existing = await ensureCanCreateNewSession(forceRelink);
  if (existing) return existing;
  await sleep(2500);
  const code = await S.sock.requestPairingCode(digits);
  log('pairing_code_issued', { phone: maskedPhone(digits) });
  return { pairingCode: code as string };
}

/** Link by QR code (data URL). */
export async function requestQR(forceRelink = false) {
  const existing = await ensureCanCreateNewSession(forceRelink);
  if (existing) return existing;
  for (let i = 0; i < 40 && !S.lastQR; i++) await sleep(400);
  if (!S.lastQR) throw new Error('No QR yet — try again in a moment.');
  return { qr: await (await import('qrcode')).toDataURL(S.lastQR, { margin: 1, width: 320 }) };
}

/** Unlink the number and wipe the saved session (admin "Disconnect"). */
export async function logoutWhatsApp() {
  await ensureBooted();
  warn('manual_logout_requested');
  S.manualLogout = true;
  try { await S.sock?.logout(); } catch { /* ignore */ }
  destroySocket();
  Object.assign(S, {
    ready: false, currentNumber: null, lastQR: null, loggedOut: true, badSessionAttempts: 0,
    loggedOutStreak: 0, replacedStreak: 0, problem: null,
    lastDisconnect: { code: 'manual', reason: 'manual_logout', message: 'Disconnected by admin', at: new Date().toISOString() },
  });
  try { await rm(AUTH_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  prepareDirs();
  setState('relink_required', { reason: 'manual_logout' });
  S.manualLogout = false;
  return { ok: true };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);
}

async function deliver({ to, body, mediaUrl, mediaBase64, mediaFilename }: SendPayload) {
  if (!S.ready || !S.sock) throw new Error('WhatsApp not connected yet');
  const digits = String(to || '').replace(/\D/g, '');
  if (!digits || !body?.trim()) throw new Error('to and body are required');
  let jid = `${digits.length === 10 ? `91${digits}` : digits}@s.whatsapp.net`;
  const sock = S.sock;

  try {
    const [res] = await sock.onWhatsApp(jid);
    if (!res?.exists) throw new Error('Number is not on WhatsApp');
    if (res.jid) jid = res.jid; // use the exact JID WhatsApp knows this number by
  } catch (e) {
    if (errMsg(e).includes('not on WhatsApp')) throw e;
  }

  // Remember what we sent so WhatsApp resend requests (getMessage) can be served.
  const send = async (content: any) => {
    const msg = await sock.sendMessage(jid, content);
    if (msg?.key?.id && msg.message) {
      S.sent.set(msg.key.id, msg.message);
      if (S.sent.size > SENT_STORE_MAX) S.sent.delete(S.sent.keys().next().value);
    }
    return msg;
  };

  let buf: Buffer | null = null;
  let isPdf = (mediaFilename || '').toLowerCase().endsWith('.pdf');
  if (mediaBase64) {
    buf = Buffer.from(String(mediaBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  } else if (mediaUrl) {
    const resp = await fetch(mediaUrl);
    if (!resp.ok) throw new Error(`media fetch ${resp.status}`);
    buf = Buffer.from(await resp.arrayBuffer());
    if ((resp.headers.get('content-type') || '').includes('pdf')) isPdf = true;
  }

  const text = body.trim();
  if (buf) {
    const content = isPdf
      ? { document: buf, mimetype: 'application/pdf', fileName: mediaFilename || 'document.pdf', caption: text }
      : { image: buf, caption: text };
    // Retry the file once before giving up on it — a single upload hiccup
    // shouldn't cost the customer their ticket.
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await withTimeout(send(content), 60_000, 'media send');
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        errorLog('media_send_failed', { attempt, bytes: buf.length, isPdf, error: errMsg(e), stack: String((e as any)?.stack || '').split('\n').slice(0, 4).join(' | ') });
        if (!S.ready) throw e; // connection dropped — let the caller queue it
        if (attempt === 1) await sleep(3000);
      }
    }
    if (lastErr) {
      warn('media_send_fallback_text', { error: errMsg(lastErr) });
      await send({ text });
    }
  } else {
    await send({ text });
  }
  S.lastMessageAt = new Date().toISOString();
}

/**
 * Send now if connected; if WhatsApp is temporarily down, queue it (persisted,
 * retried on reconnect). Throws only when sending is impossible.
 */
export async function sendWhatsAppMessage(payload: SendPayload): Promise<{ queued: boolean; id?: string }> {
  await ensureBooted();
  log('send_requested', { to: maskedPhone(payload.to), hasMedia: !!(payload.mediaUrl || payload.mediaBase64), ready: S.ready });
  if (!S.ready) {
    // Never linked at all → nothing will ever send it.
    if (!hasAuthFiles() && !S.loggedOut) throw new Error('WhatsApp is not linked — link it from Admin → Settings → WhatsApp.');
    // Reconnecting, or waiting for the admin to relink: keep it and send it
    // (with its PDF) as soon as WhatsApp is back.
    return { queued: true, id: enqueue(payload, S.loggedOut ? 'relink_required' : 'not_ready') };
  }
  try {
    await deliver(payload);
  } catch (e) {
    const msg = errMsg(e);
    errorLog('send_failed', { to: maskedPhone(payload.to), error: msg, ready: S.ready });
    // Permanent problems are reported; anything else (connection dropped
    // mid-send, timeouts) is queued for retry instead of being lost.
    if (/not on WhatsApp|to and body are required/i.test(msg)) throw e;
    return { queued: true, id: enqueue(payload, 'send_failed') };
  }
  log('notification_sent', { to: maskedPhone(payload.to) });
  return { queued: false };
}

/** Recent service log lines (newest last). */
export function getWhatsAppLogs(limit = 200) {
  try {
    if (!existsSync(LOG_FILE)) return [];
    return readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .slice(-Math.max(1, Math.min(limit, 1000)))
      .map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  } catch {
    return [];
  }
}
