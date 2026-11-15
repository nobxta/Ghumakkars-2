import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { getSettings, maskedKey, saveSettings } from '@/lib/ai-itinerary/settings';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';
import { StudioError } from '@/lib/ai-itinerary/service';
import { DEFAULT_SETTINGS, type ModelConfig, type StudioSettings } from '@/lib/ai-itinerary/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const settings = await getSettings(true);
  return json({ settings, apiKey: { configured: !!maskedKey(), masked: maskedKey() }, defaults: DEFAULT_SETTINGS });
});

const clamp = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

function cleanModels(raw: unknown, current: ModelConfig[]): ModelConfig[] {
  if (!Array.isArray(raw)) return current;
  return raw.slice(0, 30).map((m: any) => {
    const apiId = str(m?.apiId, 80);
    const key = str(m?.key, 80) || apiId;
    if (!apiId || !key) throw new StudioError(400, 'invalid', 'Each model needs an API model id');
    const prev = current.find((c) => c.key === key);
    // Changing the API id invalidates verification.
    const verified = prev && prev.apiId !== apiId ? false : m?.verified === true;
    return {
      key,
      displayName: str(m?.displayName, 60) || apiId,
      apiId,
      multiplier: clamp(m?.multiplier, 0, 1000, 1),
      verified,
      enabled: m?.enabled === true && verified,
      supportsPriority: m?.supportsPriority === true,
      recommended: str(m?.recommended, 160) || '',
    };
  });
}

/** Save settings. The API key is never accepted here — it lives in the server environment. */
export const PUT = adminRoute(async ({ req }) => {
  const body = await readJson(req);
  const cur = await getSettings(true);
  const b = body.settings || {};
  const ai = b.ai || {};
  const pr = b.pricing || {};
  const pdf = b.pdf || {};
  const refs = b.references || {};
  const adv = b.advanced || {};

  const baseUrl = str(adv.baseUrl, 200) || cur.advanced.baseUrl;
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w\-./]*)?$/i.test(baseUrl)) throw new StudioError(400, 'invalid', 'Base URL must be an https URL');

  const models = cleanModels(pr.models, cur.pricing.models);
  const next: StudioSettings = {
    ai: {
      defaultModel: typeof ai.defaultModel === 'string' && models.some((m) => m.key === ai.defaultModel) ? ai.defaultModel : cur.ai.defaultModel,
      temperature: ai.temperature === null || ai.temperature === '' ? null : ai.temperature !== undefined ? clamp(ai.temperature, 0, 2, 0.4) : cur.ai.temperature,
      maxOutputTokens: Math.round(clamp(ai.maxOutputTokens ?? cur.ai.maxOutputTokens, 1000, 64000, 8000)),
      chatMaxOutputTokens: Math.round(clamp(ai.chatMaxOutputTokens ?? cur.ai.chatMaxOutputTokens, 200, 8000, 1500)),
      askQuestions: ['essential', 'helpful', 'never'].includes(ai.askQuestions) ? ai.askQuestions : cur.ai.askQuestions,
      autoGenerateWhenReady: typeof ai.autoGenerateWhenReady === 'boolean' ? ai.autoGenerateWhenReady : cur.ai.autoGenerateWhenReady,
      retryLimit: Math.round(clamp(ai.retryLimit ?? cur.ai.retryLimit, 0, 5, 2)),
      jsonMode: typeof ai.jsonMode === 'boolean' ? ai.jsonMode : cur.ai.jsonMode,
      historyMessages: Math.round(clamp(ai.historyMessages ?? cur.ai.historyMessages, 0, 40, 10)),
      blockWhenInsufficient: typeof ai.blockWhenInsufficient === 'boolean' ? ai.blockWhenInsufficient : cur.ai.blockWhenInsufficient,
      warnAboveWeighted: Math.round(clamp(ai.warnAboveWeighted ?? cur.ai.warnAboveWeighted, 0, 10_000_000, 20000)),
    },
    pricing: {
      models,
      cachedInputMultiplier: clamp(pr.cachedInputMultiplier ?? cur.pricing.cachedInputMultiplier, 0, 1, 0.4),
      priorityMultiplier: clamp(pr.priorityMultiplier ?? cur.pricing.priorityMultiplier, 1, 10, 2),
      allowanceTokens: Math.round(clamp(pr.allowanceTokens ?? cur.pricing.allowanceTokens, 0, 1e12, 5_000_000)),
      allowanceSetAt:
        pr.resetAllowance === true ? new Date().toISOString()
        : pr.allowanceSetAt === null ? null
        : typeof pr.allowanceSetAt === 'string' && !Number.isNaN(Date.parse(pr.allowanceSetAt)) ? new Date(pr.allowanceSetAt).toISOString()
        : cur.pricing.allowanceSetAt,
    },
    pdf: {
      defaultTheme: cur.pdf.defaultTheme,
      defaultOptions: pdf.defaultOptions ? cleanThemeOptions(pdf.defaultOptions) : cur.pdf.defaultOptions,
      companyName: str(pdf.companyName, 80) ?? cur.pdf.companyName,
      tagline: 'tagline' in pdf ? str(pdf.tagline, 120) ?? '' : cur.pdf.tagline,
      contactPerson: 'contactPerson' in pdf ? str(pdf.contactPerson, 80) ?? '' : cur.pdf.contactPerson,
      phone: 'phone' in pdf ? str(pdf.phone, 60) ?? '' : cur.pdf.phone,
      whatsapp: 'whatsapp' in pdf ? str(pdf.whatsapp, 60) ?? '' : cur.pdf.whatsapp,
      email: 'email' in pdf ? str(pdf.email, 120) ?? '' : cur.pdf.email,
      website: 'website' in pdf ? str(pdf.website, 120) ?? '' : cur.pdf.website,
      instagram: 'instagram' in pdf ? str(pdf.instagram, 120) ?? '' : cur.pdf.instagram,
      address: 'address' in pdf ? str(pdf.address, 300) ?? '' : cur.pdf.address,
      logoVersion: cur.pdf.logoVersion, // changed only by the logo upload route
    },
    references: {
      maxFileMB: clamp(refs.maxFileMB ?? cur.references.maxFileMB, 1, 25, 10),
      maxFilesPerProject: Math.round(clamp(refs.maxFilesPerProject ?? cur.references.maxFilesPerProject, 1, 30, 8)),
      allowedTypes: Array.isArray(refs.allowedTypes)
        ? refs.allowedTypes.filter((t: string) => ['application/pdf', 'text/plain', 'text/markdown'].includes(t))
        : cur.references.allowedTypes,
      maxCharsPerReference: Math.round(clamp(refs.maxCharsPerReference ?? cur.references.maxCharsPerReference, 1000, 100000, 12000)),
      retentionDays: Math.round(clamp(refs.retentionDays ?? cur.references.retentionDays, 0, 3650, 0)),
    },
    advanced: {
      timeoutMs: Math.round(clamp(adv.timeoutMs ?? cur.advanced.timeoutMs, 10000, 600000, 120000)),
      baseUrl,
      dataRetentionDays: Math.round(clamp(adv.dataRetentionDays ?? cur.advanced.dataRetentionDays, 0, 3650, 0)),
      staleJobMinutes: Math.round(clamp(adv.staleJobMinutes ?? cur.advanced.staleJobMinutes, 2, 120, 10)),
    },
  };
  if (!next.pdf.companyName) next.pdf.companyName = 'Ghumakkars';
  if (!next.references.allowedTypes.length) next.references.allowedTypes = ['application/pdf'];
  const saved = await saveSettings(next);
  return json({ settings: saved, apiKey: { configured: !!maskedKey(), masked: maskedKey() } });
});
