import { igConfig } from './graph';

/**
 * Thin wrapper over the Instagram Graph API for our own account
 * (profile, insights, media, inbox, replies). Never logs the token.
 */

export class IgApiError extends Error {
  kind: 'rate_limited' | 'auth_error' | 'failed';
  code: string;
  constructor(kind: IgApiError['kind'], code: string, message: string) {
    super(message);
    this.kind = kind;
    this.code = code;
  }
}

const RATE_CODES = new Set([4, 17, 32, 613, 80002, 80006]);
const AUTH_CODES = new Set([102, 190]);

function toError(status: number, body: any): IgApiError {
  const err = body?.error || {};
  const code = Number(err.code);
  const sub = Number(err.error_subcode);
  const msg = String(err.error_user_msg || err.message || `HTTP ${status}`).slice(0, 500);
  const codeStr = [Number.isFinite(code) ? code : status, Number.isFinite(sub) ? sub : null].filter((x) => x != null).join('/');
  if (RATE_CODES.has(code) || status === 429) return new IgApiError('rate_limited', codeStr, msg);
  if (AUTH_CODES.has(code)) return new IgApiError('auth_error', codeStr, msg);
  return new IgApiError('failed', codeStr, msg);
}

async function call(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}, json?: unknown, timeoutMs = 20_000) {
  const { token, base, configured } = igConfig();
  if (!configured) throw new IgApiError('auth_error', 'not_configured', 'Instagram token is not configured on the server.');
  const qs = new URLSearchParams({ ...params, access_token: token });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${path.replace(/^\//, '')}?${qs}`, {
      method,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      body: json ? JSON.stringify(json) : undefined,
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok || body?.error) throw toError(res.status, body);
    return body;
  } catch (e: any) {
    if (e instanceof IgApiError) throw e;
    throw new IgApiError('failed', e?.name === 'AbortError' ? 'timeout' : 'network', e?.name === 'AbortError' ? 'Instagram did not answer in time.' : String(e?.message || e));
  } finally {
    clearTimeout(t);
  }
}

export const igGet = (path: string, params?: Record<string, string>) => call('GET', path, params);
export const igPost = (path: string, params?: Record<string, string>, json?: unknown) => call('POST', path, params, json);

/** Graph batch request: many GETs in one HTTP round trip (max 50). Failed items → null. */
export async function igBatch(relativeUrls: string[]): Promise<any[]> {
  if (!relativeUrls.length) return [];
  const { token, base, configured } = igConfig();
  if (!configured) throw new IgApiError('auth_error', 'not_configured', 'Instagram token is not configured on the server.');
  const root = base.replace(/\/v\d+\.\d+$/, '');
  const version = base.match(/\/(v\d+\.\d+)$/)?.[1];
  const out: any[] = [];
  for (let i = 0; i < relativeUrls.length; i += 50) {
    const chunk = relativeUrls.slice(i, i + 50);
    const form = new URLSearchParams({
      access_token: token,
      include_headers: 'false',
      batch: JSON.stringify(chunk.map((u) => ({ method: 'GET', relative_url: version ? `${version}/${u}` : u }))),
    });
    const res = await fetch(root, { method: 'POST', body: form, cache: 'no-store' });
    const body: any = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body)) throw toError(res.status, body);
    body.forEach((r: any) => {
      if (!r || r.code !== 200) { out.push(null); return; }
      try { out.push(JSON.parse(r.body)); } catch { out.push(null); }
    });
  }
  return out;
}

/* ── tiny in-memory cache for read-only dashboards ── */
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, force = false): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  // Concurrent callers share one upstream request.
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((value) => { cache.set(key, { at: Date.now(), value }); return value; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* ── our own account ── */
export const ownId = () => igConfig().userId;

export async function getProfile() {
  return igGet(ownId(), { fields: 'id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url' });
}

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

export async function getMedia(limit = 24) {
  const r = await igGet(`${ownId()}/media`, { fields: MEDIA_FIELDS, limit: String(Math.min(50, limit)) });
  return (r?.data || []) as any[];
}

/** Per-post insights. Reels/videos have views; images have reach etc. */
export async function getMediaInsights(media: { id: string; media_type: string; media_product_type?: string }[]) {
  const urls = media.map((m) => {
    const metrics = m.media_type === 'CAROUSEL_ALBUM' || m.media_type === 'IMAGE'
      ? 'reach,saved,shares,total_interactions,views'
      : 'reach,views,saved,shares,total_interactions';
    return `${m.id}/insights?metric=${metrics}`;
  });
  const res = await igBatch(urls);
  const out: Record<string, Record<string, number>> = {};
  res.forEach((r, i) => {
    if (!r?.data) return;
    const row: Record<string, number> = {};
    r.data.forEach((m: any) => { row[m.name] = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0); });
    out[media[i].id] = row;
  });
  return out;
}

const ACCOUNT_METRICS = ['reach', 'profile_views', 'accounts_engaged', 'total_interactions', 'website_clicks', 'likes', 'comments', 'shares', 'saves', 'replies', 'views'];

/** Totals for a window (Meta allows up to 30 days per request). */
export async function getAccountTotals(days: number, offsetDays = 0) {
  const until = Math.floor(Date.now() / 1000) - offsetDays * 86400;
  const since = until - Math.min(30, days) * 86400 + 60;
  const out: Record<string, number> = {};
  // Ask metric by metric through a batch so one unsupported metric can't sink the rest.
  const res = await igBatch(ACCOUNT_METRICS.map((m) => `${ownId()}/insights?metric=${m}&period=day&metric_type=total_value&since=${since}&until=${until}`));
  res.forEach((r, i) => {
    const v = r?.data?.[0]?.total_value?.value;
    if (v != null) out[ACCOUNT_METRICS[i]] = Number(v);
  });
  return out;
}

/** New followers per day (Meta's own count, last ≤30 days). */
export async function getFollowerSeries(days = 30) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - Math.min(30, days) * 86400 + 60;
  const r = await igGet(`${ownId()}/insights`, { metric: 'follower_count', period: 'day', since: String(since), until: String(until) }).catch(() => null);
  return ((r?.data?.[0]?.values || []) as any[]).map((v) => ({ date: String(v.end_time).slice(0, 10), value: Number(v.value) || 0 }));
}

export async function getDemographics() {
  const dims = ['city', 'country', 'age', 'gender'];
  const res = await igBatch(dims.map((d) => `${ownId()}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${d}`));
  const out: Record<string, { label: string; value: number }[]> = {};
  res.forEach((r, i) => {
    const results = r?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    out[dims[i]] = results
      .map((x: any) => ({ label: String(x.dimension_values?.[0] ?? ''), value: Number(x.value) || 0 }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 8);
  });
  return out;
}

/* ── inbox ── */
export async function getConversations(limit = 25, perConversation = 10) {
  const r = await igGet(`${ownId()}/conversations`, {
    platform: 'instagram',
    limit: String(limit),
    fields: `id,updated_time,participants,messages.limit(${perConversation}){id,created_time,from,to,message,attachments{id}}`,
  });
  return (r?.data || []) as any[];
}

export async function getRecentComments(posts = 10) {
  const r = await igGet(`${ownId()}/media`, {
    limit: String(posts),
    fields: 'id,permalink,timestamp,comments.limit(50){id,text,username,timestamp,from,replies.limit(20){id,from,username}}',
  });
  return (r?.data || []) as any[];
}

/** Send any message object (text, quick replies, button/generic template). */
export async function sendMessage(recipient: { id: string } | { comment_id: string }, message: Record<string, unknown>) {
  return igPost(`${ownId()}/messages`, {}, { recipient, message });
}

export async function sendDm(recipientId: string, text: string) {
  return igPost(`${ownId()}/messages`, {}, { recipient: { id: recipientId }, message: { text } });
}

/** Instagram "private reply": DM the author of a comment (once per comment, within 7 days). */
export async function sendPrivateReply(commentId: string, text: string) {
  return igPost(`${ownId()}/messages`, {}, { recipient: { comment_id: commentId }, message: { text } });
}

export async function replyToComment(commentId: string, text: string) {
  return igPost(`${commentId}/replies`, { message: text });
}
