// Server only — reads the service-role client and the API key from env.
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_MODELS, DEFAULT_SETTINGS, type ModelConfig, type StudioSettings } from './types';

let cache: { at: number; value: StudioSettings } | null = null;
const TTL = 15_000;

function deepMerge<T>(base: T, over: any): T {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as any)?.[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(b, v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Saved models override defaults by key; new default models are appended. */
function mergeModels(saved: unknown): ModelConfig[] {
  if (!Array.isArray(saved)) return DEFAULT_MODELS;
  const byKey = new Map<string, ModelConfig>();
  for (const m of DEFAULT_MODELS) byKey.set(m.key, m);
  for (const s of saved) {
    if (!s || typeof s.key !== 'string') continue;
    const base = byKey.get(s.key);
    byKey.set(s.key, { ...(base || ({} as ModelConfig)), ...s });
  }
  return Array.from(byKey.values()).filter((m) => m.apiId && m.displayName);
}

export async function getSettings(fresh = false): Promise<StudioSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value;
  const db = createAdminClient();
  const { data } = await db.from('ai_itinerary_settings').select('settings').eq('id', 1).maybeSingle();
  const saved = (data?.settings || {}) as any;
  const merged = deepMerge(DEFAULT_SETTINGS, saved);
  merged.pricing.models = mergeModels(saved?.pricing?.models);
  cache = { at: Date.now(), value: merged };
  return merged;
}

export async function saveSettings(next: StudioSettings): Promise<StudioSettings> {
  const db = createAdminClient();
  const { error } = await db
    .from('ai_itinerary_settings')
    .upsert({ id: 1, settings: next, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
  return getSettings(true);
}

export function resolveModel(settings: StudioSettings, key?: string | null): ModelConfig | null {
  const models = settings.pricing.models;
  const wanted = models.find((m) => m.key === key) || models.find((m) => m.key === settings.ai.defaultModel);
  if (wanted && wanted.enabled && wanted.verified) return wanted;
  return models.find((m) => m.enabled && m.verified) || null;
}

/** The API key only ever comes from the server environment. Never returned to the browser. */
export function apiKey(): string | null {
  const k = process.env.CODEX_API_KEY || process.env.CODEX_SALE_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export function maskedKey(): string | null {
  const k = apiKey();
  if (!k) return null;
  return `${k.slice(0, 3)}••••••••${k.slice(-4)}`;
}
