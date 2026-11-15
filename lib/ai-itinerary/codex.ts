/**
 * Codex.sale Chat Completions client (server only).
 * - Key from env only; never logged, never sent to the browser.
 * - Bounded exponential backoff for 429 / 5xx / timeouts / network errors.
 * - No blind retries on auth or invalid-model errors.
 * - Unsupported optional parameters are dropped and the call is retried once.
 * - Every logical request writes one ai_usage_events row with the token counts
 *   the provider actually returned (NULL when it didn't report them).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { apiKey } from './settings';
import { weightedTokens, type ModelConfig, type StudioSettings } from './types';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiErrorCode =
  | 'no_key' | 'auth' | 'invalid_model' | 'rate_limit' | 'timeout' | 'provider' | 'network'
  | 'empty' | 'bad_request' | 'malformed' | 'insufficient_allowance' | 'busy';

export class AiError extends Error {
  code: AiErrorCode;
  status?: number;
  retryable: boolean;
  constructor(code: AiErrorCode, message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

export const FRIENDLY: Record<AiErrorCode, string> = {
  no_key: 'The Codex.sale API key is not configured on the server (CODEX_API_KEY).',
  auth: 'Codex.sale rejected the API key. Check or replace CODEX_API_KEY.',
  invalid_model: 'This model id was not accepted by the provider. Verify it in Settings → Advanced.',
  rate_limit: 'The provider is rate-limiting requests. Wait a moment and try again.',
  timeout: 'The AI took too long to respond. Try again, or use a shorter request.',
  provider: 'The AI provider had a problem. Try again in a minute.',
  network: 'Could not reach the AI provider. Check the server’s network.',
  empty: 'The AI returned an empty response. Try again.',
  bad_request: 'The provider rejected the request.',
  malformed: 'The AI response could not be understood. Try again.',
  insufficient_allowance: 'Estimated remaining token allowance is too low for this request.',
  busy: 'Another request is already running for this itinerary.',
};

export interface CallOptions {
  settings: StudioSettings;
  model: ModelConfig;
  messages: ChatMessage[];
  maxTokens: number;
  json?: boolean;
  priority?: boolean;
  kind: string;
  projectId?: string | null;
  jobId?: string | null;
}

export interface CallResult {
  content: string;
  usage: { input: number | null; output: number | null; cached: number | null; total: number | null; reported: boolean };
  weighted: number | null;
  latencyMs: number;
  usageEventId: string | null;
  finishReason: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parameters a model has rejected, remembered per model id for this server process. */
const paramFixes = new Map<string, Set<string>>();
function applyKnownFixes(modelId: string, body: Record<string, unknown>) {
  const fixes = paramFixes.get(modelId);
  if (!fixes) return;
  for (const f of Array.from(fixes)) {
    if (f === 'max_tokens' && 'max_tokens' in body) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
    else if (f === 'max_completion_tokens' && 'max_completion_tokens' in body) { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; }
    else delete body[f];
  }
}

function classify(status: number, body: string): AiError {
  const lower = body.toLowerCase();
  const msg = (() => {
    try {
      const j = JSON.parse(body);
      return String(j?.error?.message || j?.message || j?.error || '').slice(0, 300);
    } catch {
      return body.slice(0, 300);
    }
  })();
  if (status === 401 || status === 403) return new AiError('auth', msg || FRIENDLY.auth, { status });
  // Parameter complaints ("Unsupported parameter: 'max_tokens' … with this model") are not model errors.
  const paramError = /(unsupported|unknown|unrecognized|invalid|not supported)[^.]{0,30}(parameter|argument|field)|(parameter|argument)[^.]{0,40}(not supported|unsupported|unknown)/.test(lower);
  const modelError = /model[^.]{0,60}(not found|does not exist|not available|is not supported|unknown|invalid)|(invalid|unknown|unsupported|unavailable) model|no such model/.test(lower);
  if (status === 404 || ((status === 400 || status === 422) && modelError && !paramError))
    return new AiError('invalid_model', msg || FRIENDLY.invalid_model, { status });
  if (status === 429) return new AiError('rate_limit', msg || FRIENDLY.rate_limit, { status, retryable: true });
  if (status === 408 || status === 504) return new AiError('timeout', msg || FRIENDLY.timeout, { status, retryable: true });
  if (status >= 500) return new AiError('provider', msg || FRIENDLY.provider, { status, retryable: true });
  return new AiError('bad_request', msg || FRIENDLY.bad_request, { status });
}

/** Which optional parameter (if any) the provider complained about. */
function unsupportedParam(err: AiError, body: Record<string, unknown>): string | null {
  if (err.code !== 'bad_request') return null;
  const m = err.message.toLowerCase();
  const candidates = ['response_format', 'temperature', 'service_tier', 'max_tokens', 'max_completion_tokens'];
  for (const p of candidates) if (p in body && m.includes(p)) return p;
  if ('response_format' in body && /json/.test(m)) return 'response_format';
  return null;
}

export async function chatCompletion(opts: CallOptions): Promise<CallResult> {
  const { settings, model } = opts;
  const key = apiKey();
  const started = Date.now();
  const priority = !!opts.priority && model.supportsPriority;
  let attempts = 0;
  let lastErr: AiError | null = null;

  const body: Record<string, unknown> = {
    model: model.apiId,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
  };
  if (opts.json && settings.ai.jsonMode) body.response_format = { type: 'json_object' };
  if (settings.ai.temperature != null) body.temperature = settings.ai.temperature;
  if (priority) body.service_tier = 'priority';
  applyKnownFixes(model.apiId, body);

  const finish = async (res: Partial<CallResult> & { ok: boolean; status?: number; err?: AiError }) => {
    const u = res.usage;
    const weighted = u?.reported && u.input != null && u.output != null
      ? weightedTokens({ input: u.input, output: u.output, cached: u.cached }, model.multiplier, settings.pricing.cachedInputMultiplier, priority ? settings.pricing.priorityMultiplier : 1)
      : null;
    let id: string | null = null;
    try {
      const db = createAdminClient();
      const { data } = await db.from('ai_usage_events').insert({
        project_id: opts.projectId || null,
        job_id: opts.jobId || null,
        kind: opts.kind,
        model_key: model.key,
        model_id: model.apiId,
        success: res.ok,
        usage_reported: !!u?.reported,
        input_tokens: u?.input ?? null,
        output_tokens: u?.output ?? null,
        cached_tokens: u?.cached ?? null,
        total_tokens: u?.total ?? null,
        multiplier: model.multiplier,
        priority,
        weighted_tokens: weighted,
        latency_ms: Date.now() - started,
        http_status: res.status ?? null,
        error_code: res.err?.code ?? null,
        error_message: res.err ? res.err.message.slice(0, 500) : null,
        attempts: Math.max(1, attempts),
      }).select('id').single();
      id = data?.id ?? null;
      if (opts.projectId && u?.reported) {
        const { data: p } = await db.from('ai_itinerary_projects').select('weighted_tokens, raw_tokens').eq('id', opts.projectId).maybeSingle();
        if (p) {
          await db.from('ai_itinerary_projects').update({
            weighted_tokens: Number(p.weighted_tokens || 0) + (weighted || 0),
            raw_tokens: Number(p.raw_tokens || 0) + (u.total ?? (u.input || 0) + (u.output || 0)),
          }).eq('id', opts.projectId);
        }
      }
    } catch (e) {
      console.error('[ai-itinerary] usage log failed', (e as Error).message);
    }
    return { weighted, id };
  };

  if (!key) {
    const err = new AiError('no_key', FRIENDLY.no_key);
    await finish({ ok: false, err });
    throw err;
  }

  const maxRetries = Math.max(0, Math.min(5, settings.ai.retryLimit));
  let fixesThisCall = 0;
  const base = settings.advanced.baseUrl.replace(/\/+$/, '');

  for (let retry = 0; retry <= maxRetries; ) {
    attempts++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(10_000, settings.advanced.timeoutMs));
    let status = 0;
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: 'no-store',
      });
      status = res.status;
      const text = await res.text();
      clearTimeout(timer);
      if (!res.ok) {
        const err = classify(res.status, text);
        const param = unsupportedParam(err, body);
        if (param && fixesThisCall < 3) {
          fixesThisCall++;
          if (!paramFixes.has(model.apiId)) paramFixes.set(model.apiId, new Set());
          paramFixes.get(model.apiId)!.add(param);
          if (param === 'max_tokens') { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
          else if (param === 'max_completion_tokens') { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; }
          else delete body[param];
          continue; // does not consume a retry
        }
        lastErr = err;
        if (!err.retryable || retry >= maxRetries) break;
        const ra = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 20_000) : Math.min(1000 * 2 ** retry, 8000) + Math.random() * 400;
        retry++;
        await sleep(wait);
        continue;
      }
      let json: any;
      try { json = JSON.parse(text); } catch { lastErr = new AiError('malformed', 'Provider returned non-JSON', { status }); break; }
      const content = String(json?.choices?.[0]?.message?.content ?? '').trim();
      const usage = json?.usage;
      const reported = !!usage && Number.isFinite(Number(usage.prompt_tokens)) && Number.isFinite(Number(usage.completion_tokens));
      const cachedRaw = usage?.prompt_tokens_details?.cached_tokens ?? usage?.cached_tokens;
      const u = {
        input: reported ? Number(usage.prompt_tokens) : null,
        output: reported ? Number(usage.completion_tokens) : null,
        cached: reported && cachedRaw != null && Number.isFinite(Number(cachedRaw)) ? Number(cachedRaw) : null,
        total: reported ? Number(usage.total_tokens ?? Number(usage.prompt_tokens) + Number(usage.completion_tokens)) : null,
        reported,
      };
      if (!content) {
        const err = new AiError('empty', FRIENDLY.empty, { status, retryable: true });
        await finish({ ok: false, status, err, usage: u });
        throw err;
      }
      const { weighted, id } = await finish({ ok: true, status, usage: u });
      return { content, usage: u, weighted, latencyMs: Date.now() - started, usageEventId: id, finishReason: json?.choices?.[0]?.finish_reason ?? null };
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof AiError) throw e;
      const aborted = (e as Error)?.name === 'AbortError';
      lastErr = aborted ? new AiError('timeout', FRIENDLY.timeout, { retryable: true }) : new AiError('network', FRIENDLY.network, { retryable: true });
      if (retry >= maxRetries) break;
      retry++;
      await sleep(Math.min(1000 * 2 ** retry, 8000));
    }
  }
  const err = lastErr || new AiError('provider', FRIENDLY.provider);
  await finish({ ok: false, status: err.status, err });
  throw err;
}

/** GET /models — used by Settings → Advanced to verify model ids. */
export async function discoverModels(settings: StudioSettings): Promise<{ ok: true; ids: string[] } | { ok: false; error: string; status?: number }> {
  const key = apiKey();
  if (!key) return { ok: false, error: FRIENDLY.no_key };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${settings.advanced.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: classify(res.status, text).message, status: res.status };
    const j = JSON.parse(text);
    const list = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
    return { ok: true, ids: list.map((m: any) => String(m?.id || m)).filter(Boolean) };
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'AbortError' ? 'Timed out' : 'Network error' };
  } finally {
    clearTimeout(t);
  }
}

/** Rough token estimate (≈4 chars/token) for pre-flight cost estimates. Labelled as an estimate in the UI. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Weighted tokens consumed since the allowance was set, for the local remaining-balance estimate. */
export async function estimatedRemaining(settings: StudioSettings): Promise<{ allowance: number; used: number; remaining: number }> {
  const db = createAdminClient();
  let q = db.from('ai_usage_events').select('weighted_tokens').not('weighted_tokens', 'is', null);
  if (settings.pricing.allowanceSetAt) q = q.gte('created_at', settings.pricing.allowanceSetAt);
  const { data } = await q.limit(100000);
  const used = (data || []).reduce((s, r: any) => s + Number(r.weighted_tokens || 0), 0);
  const allowance = Number(settings.pricing.allowanceTokens || 0);
  return { allowance, used, remaining: allowance - used };
}
