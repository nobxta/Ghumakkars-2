import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json } from '@/lib/ai-itinerary/http';
import { getSettings } from '@/lib/ai-itinerary/settings';
import { estimatedRemaining } from '@/lib/ai-itinerary/codex';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IST = 5.5 * 3600_000;
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 10);

/**
 * Usage analytics. Every number here comes from ai_usage_events — i.e. token
 * counts the provider returned. Weighted = locally calculated with the configured
 * multipliers. Requests where the provider reported no usage are counted separately.
 */
export const GET = adminRoute(async ({ req }) => {
  const url = new URL(req.url);
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const fetchDays = Math.max(days, 30);
  const since = new Date(Date.now() - fetchDays * 86400_000).toISOString();
  const db = createAdminClient();
  const settings = await getSettings();

  const [{ data: events }, { data: projects }, balance] = await Promise.all([
    db.from('ai_usage_events')
      .select('id, project_id, kind, model_key, model_id, success, usage_reported, input_tokens, output_tokens, cached_tokens, total_tokens, weighted_tokens, priority, latency_ms, error_code, error_message, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20000),
    db.from('ai_itinerary_projects').select('id, title, destination, weighted_tokens, raw_tokens, current_version_id'),
    estimatedRemaining(settings),
  ]);

  const all = events || [];
  const rangeStart = Date.now() - days * 86400_000;
  const inRange = all.filter((e) => new Date(e.created_at).getTime() >= rangeStart);
  const titles = new Map((projects || []).map((p) => [p.id, p.title as string]));

  const sum = (rows: typeof all, f: (e: any) => number | null | undefined) => rows.reduce((s, e) => s + (Number(f(e)) || 0), 0);
  const reported = inRange.filter((e) => e.usage_reported);
  const cachedReported = reported.filter((e) => e.cached_tokens != null);

  const totals = {
    requests: inRange.length,
    success: inRange.filter((e) => e.success).length,
    failed: inRange.filter((e) => !e.success).length,
    unreported: inRange.filter((e) => e.success && !e.usage_reported).length,
    input: sum(reported, (e) => e.input_tokens),
    output: sum(reported, (e) => e.output_tokens),
    cached: cachedReported.length ? sum(cachedReported, (e) => e.cached_tokens) : null,
    cachedReportedRequests: cachedReported.length,
    raw: sum(reported, (e) => e.total_tokens ?? (e.input_tokens || 0) + (e.output_tokens || 0)),
    weighted: sum(reported, (e) => e.weighted_tokens),
    avgLatencyMs: inRange.length ? Math.round(sum(inRange, (e) => e.latency_ms) / inRange.length) : null,
  };

  const now = Date.now();
  const windowWeighted = (d: number) => sum(all.filter((e) => new Date(e.created_at).getTime() >= now - d * 86400_000), (e) => e.weighted_tokens);
  const periods = { today: windowWeighted(1), week: windowWeighted(7), month: windowWeighted(30) };

  // Daily series (IST days)
  const byDayMap = new Map<string, { weighted: number; raw: number; requests: number; failed: number }>();
  for (let i = days - 1; i >= 0; i--) byDayMap.set(dayKey(new Date(now - i * 86400_000).toISOString()), { weighted: 0, raw: 0, requests: 0, failed: 0 });
  for (const e of inRange) {
    const k = dayKey(e.created_at);
    const row = byDayMap.get(k);
    if (!row) continue;
    row.requests++;
    if (!e.success) row.failed++;
    row.weighted += Number(e.weighted_tokens) || 0;
    row.raw += Number(e.total_tokens) || 0;
  }
  const byDay = Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v }));

  const modelMap = new Map<string, { model: string; modelId: string; weighted: number; raw: number; requests: number; failed: number }>();
  for (const e of inRange) {
    const k = e.model_key || e.model_id;
    const row = modelMap.get(k) || { model: k, modelId: e.model_id, weighted: 0, raw: 0, requests: 0, failed: 0 };
    row.requests++;
    if (!e.success) row.failed++;
    row.weighted += Number(e.weighted_tokens) || 0;
    row.raw += Number(e.total_tokens) || 0;
    modelMap.set(k, row);
  }

  const projMap = new Map<string, { id: string; title: string; weighted: number; raw: number; requests: number }>();
  for (const e of inRange) {
    if (!e.project_id) continue;
    const row = projMap.get(e.project_id) || { id: e.project_id, title: titles.get(e.project_id) || 'Deleted itinerary', weighted: 0, raw: 0, requests: 0 };
    row.requests++;
    row.weighted += Number(e.weighted_tokens) || 0;
    row.raw += Number(e.total_tokens) || 0;
    projMap.set(e.project_id, row);
  }

  const generated = (projects || []).filter((p) => p.current_version_id && Number(p.weighted_tokens) > 0);
  const avgPerItinerary = generated.length ? Math.round(sum(generated as any, (p: any) => p.weighted_tokens) / generated.length) : null;

  return json({
    days,
    totals,
    periods,
    byDay,
    byModel: Array.from(modelMap.values()).sort((a, b) => b.weighted - a.weighted),
    topProjects: Array.from(projMap.values()).sort((a, b) => b.weighted - a.weighted).slice(0, 8),
    avgPerItinerary,
    generatedCount: generated.length,
    recent: all.slice(0, 60).map((e) => ({ ...e, project_title: e.project_id ? titles.get(e.project_id) || null : null })),
    balance: {
      allowance: balance.allowance,
      usedSinceSet: Math.round(balance.used),
      estimatedRemaining: Math.round(balance.remaining),
      allowanceSetAt: settings.pricing.allowanceSetAt,
      providerConfirmed: null as number | null, // Codex.sale exposes no verified balance endpoint
    },
  });
});
