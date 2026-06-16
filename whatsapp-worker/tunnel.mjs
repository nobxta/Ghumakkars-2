/**
 * Cloudflare Tunnel bootstrap — fully self-contained, no shell access needed.
 *
 * Pterodactyl wipes everything outside the mounted volume on restart, so we keep
 * ALL of cloudflared's state inside this folder (which is the persisted volume):
 *
 *   whatsapp-worker/
 *     cloudflared            ← the binary (downloaded once)
 *     .cloudflared/
 *       cert.pem             ← account cert (from `tunnel login`)
 *       creds.json           ← tunnel credentials (from `tunnel create`)
 *       config.yml           ← ingress: hostname → http://localhost:$PORT
 *
 * First boot: prints an authorize URL to the console. You open it, pick the
 * zone (ghumakkars.in), and that's the only manual step ever. After that it
 * creates the tunnel, points the DNS at it, and runs it on every startup.
 *
 * Optional backup: after first setup it logs CF_CERT / CF_CREDS (base64). If you
 * paste those into .env, the tunnel can rebuild itself even after a full
 * reinstall that wipes the volume.
 *
 * Env:
 *   CF_HOSTNAME      e.g. api.ghumakkars.in   (REQUIRED to enable the tunnel)
 *   CF_TUNNEL_NAME   optional, defaults to the hostname with dots → dashes
 *   CF_CERT          optional, cert.pem contents (raw PEM or base64) to restore
 *   CF_CREDS         optional, creds.json contents (raw JSON or base64) to restore
 */
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync, chmodSync, statSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';

const HERE = process.cwd();                          // /home/container/whatsapp-worker
const CF_DIR = path.join(HERE, '.cloudflared');
const BIN = path.join(HERE, 'cloudflared');
const CERT = path.join(CF_DIR, 'cert.pem');
const CREDS = path.join(CF_DIR, 'creds.json');
const CONFIG = path.join(CF_DIR, 'config.yml');

const HOSTNAME = (process.env.CF_HOSTNAME || '').trim();
const NAME = (process.env.CF_TUNNEL_NAME || HOSTNAME.replace(/[^a-z0-9]+/gi, '-')).trim();

const log = (...a) => console.log('[tunnel]', ...a);

// ── helpers ───────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = [];
    https.get(url, { headers: { 'User-Agent': 'ghumakkars-worker' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(download(res.headers.location, dest));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`download ${res.statusCode}`)); }
      res.on('data', (c) => file.push(c));
      res.on('end', () => { writeFileSync(dest, Buffer.concat(file)); resolve(); });
    }).on('error', reject);
  });
}

// Run a cloudflared subcommand to completion, streaming its output.
function run(args, { quiet } = {}) {
  return new Promise((resolve) => {
    const p = spawn(BIN, args, { env: { ...process.env, TUNNEL_ORIGIN_CERT: CERT } });
    let out = '';
    const cap = (d) => { const s = d.toString(); out += s; if (!quiet) process.stdout.write('[tunnel] ' + s); };
    p.stdout.on('data', cap);
    p.stderr.on('data', cap);
    p.on('error', (e) => resolve({ code: -1, out: String(e?.message || e) }));
    p.on('close', (code) => resolve({ code, out }));
  });
}

function decodeMaybeB64(val, looksRaw) {
  const v = String(val).trim();
  return looksRaw(v) ? v : Buffer.from(v, 'base64').toString('utf8');
}

// ── steps ─────────────────────────────────────────────────────────────────
async function ensureBinary() {
  if (existsSync(BIN) && statSync(BIN).size > 1_000_000) return;
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  log(`downloading cloudflared (${arch})…`);
  await download(url, BIN);
  chmodSync(BIN, 0o755);
  log('cloudflared ready.');
}

// `cloudflared tunnel login` always writes cert.pem to its DEFAULT home
// (~/.cloudflared), ignoring TUNNEL_ORIGIN_CERT. Pull it into our folder.
function relocateCert() {
  if (existsSync(CERT)) return true;
  const candidates = [
    path.join(os.homedir(), '.cloudflared', 'cert.pem'),
    '/home/container/.cloudflared/cert.pem',
    path.join(HERE, '..', '.cloudflared', 'cert.pem'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (found) { mkdirSync(CF_DIR, { recursive: true }); copyFileSync(found, CERT); log(`cert.pem imported from ${found}.`); return true; }
  return false;
}

async function ensureCert() {
  if (existsSync(CERT)) return;
  if (process.env.CF_CERT) {
    writeFileSync(CERT, decodeMaybeB64(process.env.CF_CERT, (v) => v.includes('BEGIN')));
    log('cert.pem restored from CF_CERT.');
    return;
  }
  // A previous login may have already saved a cert to cloudflared's default home.
  if (relocateCert()) return;
  log('No cert yet — starting one-time login. AUTHORIZE THE TUNNEL HERE:');
  log('(open the URL below, log in, and pick the zone for ' + HOSTNAME + ')');
  await run(['tunnel', 'login']);
  if (relocateCert()) { log('Logged in — cert.pem saved.'); return; }
  throw new Error('login did not produce cert.pem — open the URL above and authorize, then restart.');
}

async function ensureTunnel() {
  if (process.env.CF_CREDS && !existsSync(CREDS)) {
    writeFileSync(CREDS, decodeMaybeB64(process.env.CF_CREDS, (v) => v.startsWith('{')));
    log('creds.json restored from CF_CREDS.');
  }
  if (!existsSync(CREDS)) {
    log(`creating tunnel "${NAME}"…`);
    const r = await run(['tunnel', 'create', '--credentials-file', CREDS, NAME]);
    if (!existsSync(CREDS)) {
      if (r.out.includes('already exists')) throw new Error(`a tunnel named "${NAME}" already exists but creds.json is missing. Set CF_TUNNEL_NAME to a new name (or restore CF_CREDS) and restart.`);
      throw new Error('tunnel create failed — see output above.');
    }
  }
  const uuid = JSON.parse(readFileSync(CREDS, 'utf8')).TunnelID;
  // Point the hostname at this tunnel (idempotent; ignore "already exists").
  if (existsSync(CERT)) {
    const r = await run(['tunnel', 'route', 'dns', uuid, HOSTNAME], { quiet: true });
    if (r.code === 0) log(`DNS routed: ${HOSTNAME} → ${uuid}`);
    else log(`DNS route note: ${r.out.trim().split('\n').pop()}`);
  }
  return uuid;
}

function writeConfig(uuid, port) {
  const yml = `tunnel: ${uuid}
credentials-file: ${CREDS}
ingress:
  - hostname: ${HOSTNAME}
    service: http://localhost:${port}
  - service: http_status:404
`;
  writeFileSync(CONFIG, yml);
}

// Print base64 backups once so the user can paste them into .env.
function printBackupHint() {
  if (process.env.CF_CERT && process.env.CF_CREDS) return;
  try {
    const cert64 = Buffer.from(readFileSync(CERT)).toString('base64');
    const creds64 = Buffer.from(readFileSync(CREDS)).toString('base64');
    log('───────────────────────────────────────────────────────────────');
    log('Backup (optional): paste into .env so the tunnel survives a full reinstall:');
    log('CF_CERT=' + cert64);
    log('CF_CREDS=' + creds64);
    log('───────────────────────────────────────────────────────────────');
  } catch { /* ignore */ }
}

let child = null;
function runTunnel() {
  log(`starting tunnel → https://${HOSTNAME}`);
  child = spawn(BIN, ['tunnel', '--no-autoupdate', '--config', CONFIG, 'run'], { env: { ...process.env } });
  child.stdout.on('data', (d) => process.stdout.write('[cf] ' + d));
  child.stderr.on('data', (d) => process.stdout.write('[cf] ' + d));
  child.on('close', (code) => {
    log(`tunnel exited (code ${code}). restarting in 5s…`);
    setTimeout(runTunnel, 5000);
  });
}

export async function startTunnel(port) {
  if (!HOSTNAME) { log('CF_HOSTNAME not set — skipping Cloudflare tunnel.'); return; }
  mkdirSync(CF_DIR, { recursive: true });
  await ensureBinary();
  await ensureCert();
  const uuid = await ensureTunnel();
  writeConfig(uuid, port);
  printBackupHint();
  runTunnel();
}
