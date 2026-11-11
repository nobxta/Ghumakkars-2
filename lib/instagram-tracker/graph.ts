/**
 * Instagram Graph API — Business Discovery.
 *
 * Reads public follower counts of Business/Creator accounts through the
 * official API using one long-lived token that belongs to our own
 * Business/Creator account (INSTAGRAM_USER_ID). No scraping, no logins.
 */

export interface IgProfile {
  username: string;
  name: string | null;
  followers: number;
  follows: number | null;
  media: number | null;
  picture: string | null;
}

export type IgFailureKind = 'rate_limited' | 'not_found' | 'auth_error' | 'failed';

export type IgResult =
  | { ok: true; profile: IgProfile; usagePct: number }
  | { ok: false; kind: IgFailureKind; code: string; message: string; retryAfterMin: number | null; usagePct: number };

export const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export function normaliseUsername(input: string): string {
  let s = String(input || '').trim().toLowerCase();
  // Accept pasted profile links and @handles.
  const m = s.match(/instagram\.com\/([a-z0-9._]+)/);
  if (m) s = m[1];
  return s.replace(/^@/, '').replace(/\/+$/, '');
}

export function igConfig() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || '';
  const userId = process.env.INSTAGRAM_USER_ID || '';
  // Business Discovery is served from graph.facebook.com (Facebook-login tokens, "EAA…").
  const base = (process.env.INSTAGRAM_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
  return { token, userId, base, configured: Boolean(token && userId) };
}

const RATE_CODES = new Set([4, 17, 32, 613, 80002, 80006]);
const AUTH_CODES = new Set([10, 102, 190, 200, 210]);
const NOT_FOUND_SUBCODES = new Set([2207013]);

/** Highest usage % reported by Meta's rate-limit headers, plus regain-access estimate. */
function readUsage(headers: Headers): { pct: number; regainMin: number | null } {
  let pct = 0;
  let regainMin: number | null = null;
  const bump = (o: any) => {
    if (!o || typeof o !== 'object') return;
    for (const k of ['call_count', 'total_time', 'total_cputime']) {
      const v = Number(o[k]);
      if (Number.isFinite(v)) pct = Math.max(pct, v);
    }
    const r = Number(o.estimated_time_to_regain_access);
    if (Number.isFinite(r) && r > 0) regainMin = Math.max(regainMin ?? 0, r);
  };
  for (const name of ['x-app-usage', 'x-ad-account-usage']) {
    try { bump(JSON.parse(headers.get(name) || 'null')); } catch { /* ignore */ }
  }
  try {
    const buc = JSON.parse(headers.get('x-business-use-case-usage') || 'null');
    if (buc && typeof buc === 'object') Object.values(buc).forEach((arr: any) => Array.isArray(arr) && arr.forEach(bump));
  } catch { /* ignore */ }
  return { pct, regainMin };
}

export async function fetchIgProfile(username: string, timeoutMs = 15_000): Promise<IgResult> {
  const { token, userId, base, configured } = igConfig();
  if (!configured) {
    return { ok: false, kind: 'auth_error', code: 'not_configured', message: 'INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID are not set on the server.', retryAfterMin: null, usagePct: 0 };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, kind: 'not_found', code: 'invalid_username', message: 'Not a valid Instagram username.', retryAfterMin: null, usagePct: 0 };
  }

  const fields = `business_discovery.username(${username}){username,name,followers_count,follows_count,media_count,profile_picture_url}`;
  const url = `${base}/${encodeURIComponent(userId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError';
    return { ok: false, kind: 'failed', code: timedOut ? 'timeout' : 'network', message: timedOut ? 'Instagram did not answer in time.' : `Network error: ${e?.message || e}`, retryAfterMin: null, usagePct: 0 };
  } finally {
    clearTimeout(timer);
  }

  const usage = readUsage(res.headers);
  const body: any = await res.json().catch(() => null);

  if (res.ok && body?.business_discovery) {
    const d = body.business_discovery;
    const followers = Number(d.followers_count);
    if (!Number.isFinite(followers)) {
      return { ok: false, kind: 'failed', code: 'no_count', message: 'Instagram returned the profile without a follower count.', retryAfterMin: null, usagePct: usage.pct };
    }
    return {
      ok: true,
      usagePct: usage.pct,
      profile: {
        username: String(d.username || username).toLowerCase(),
        name: d.name || null,
        followers,
        follows: Number.isFinite(Number(d.follows_count)) ? Number(d.follows_count) : null,
        media: Number.isFinite(Number(d.media_count)) ? Number(d.media_count) : null,
        picture: d.profile_picture_url || null,
      },
    };
  }

  const err = body?.error || {};
  const code = Number(err.code);
  const sub = Number(err.error_subcode);
  const msg = String(err.error_user_msg || err.message || `HTTP ${res.status}`).slice(0, 500);
  const codeStr = [Number.isFinite(code) ? code : res.status, Number.isFinite(sub) ? sub : null].filter((x) => x != null).join('/');

  if (RATE_CODES.has(code) || res.status === 429) {
    return { ok: false, kind: 'rate_limited', code: codeStr, message: msg, retryAfterMin: usage.regainMin, usagePct: usage.pct };
  }
  if (NOT_FOUND_SUBCODES.has(sub) || (code === 110 && /cannot be found|invalid user/i.test(msg))) {
    return {
      ok: false, kind: 'not_found', code: codeStr,
      message: 'Account not found, or it is a personal account (only public Business/Creator accounts can be read).',
      retryAfterMin: null, usagePct: usage.pct,
    };
  }
  if (AUTH_CODES.has(code) || res.status === 401 || res.status === 403) {
    return { ok: false, kind: 'auth_error', code: codeStr, message: msg, retryAfterMin: null, usagePct: usage.pct };
  }
  return { ok: false, kind: 'failed', code: codeStr, message: msg, retryAfterMin: null, usagePct: usage.pct };
}
