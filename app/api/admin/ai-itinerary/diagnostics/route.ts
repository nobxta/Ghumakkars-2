import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { getSettings, maskedKey, saveSettings } from '@/lib/ai-itinerary/settings';
import { chatCompletion, discoverModels } from '@/lib/ai-itinerary/codex';
import { BUCKET, removeObjects } from '@/lib/ai-itinerary/assets';
import { StudioError } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Recent errors + configuration health. */
export const GET = adminRoute(async () => {
  const db = createAdminClient();
  const settings = await getSettings();
  const [errs, jobs, bucket] = await Promise.all([
    db.from('ai_usage_events').select('id, kind, model_id, http_status, error_code, error_message, latency_ms, attempts, created_at').eq('success', false).order('created_at', { ascending: false }).limit(25),
    db.from('ai_generation_jobs').select('id, project_id, kind, stage, error, started_at, finished_at').eq('status', 'failed').order('started_at', { ascending: false }).limit(15),
    db.storage.getBucket(BUCKET),
  ]);
  return json({
    config: {
      apiKeyConfigured: !!maskedKey(),
      apiKeyMasked: maskedKey(),
      baseUrl: settings.advanced.baseUrl,
      storageReady: !!bucket.data,
      storageError: bucket.error?.message || null,
      verifiedModels: settings.pricing.models.filter((m) => m.verified).map((m) => m.apiId),
    },
    errors: errs.data || [],
    failedJobs: jobs.data || [],
  });
});

/** action: test (tiny paid request) | discover (GET /models) | cleanup */
export const POST = adminRoute(async ({ req }) => {
  const body = await readJson(req);
  const settings = await getSettings(true);
  const db = createAdminClient();

  if (body.action === 'test') {
    const model = settings.pricing.models.find((m) => m.key === body.model) || settings.pricing.models.find((m) => m.key === settings.ai.defaultModel);
    if (!model) throw new StudioError(400, 'invalid', 'Unknown model');
    try {
      const r = await chatCompletion({
        settings: { ...settings, ai: { ...settings.ai, jsonMode: false, retryLimit: 0 } },
        model,
        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        maxTokens: 16,
        kind: 'test',
      });
      // A successful call proves the id is accepted by the provider.
      if (!model.verified) {
        settings.pricing.models = settings.pricing.models.map((m) => (m.key === model.key ? { ...m, verified: true } : m));
        await saveSettings(settings);
      }
      return json({ ok: true, model: model.apiId, latencyMs: r.latencyMs, reply: r.content.slice(0, 60), usage: r.usage, weighted: r.weighted, verified: true });
    } catch (e: any) {
      return json({ ok: false, model: model.apiId, code: e?.code || 'error', error: e?.message || 'Failed' });
    }
  }

  if (body.action === 'discover') {
    const r = await discoverModels(settings);
    if (!r.ok) return json(r);
    const ids = new Set(r.ids);
    let changed = 0;
    settings.pricing.models = settings.pricing.models.map((m) => {
      if (ids.has(m.apiId) && !m.verified) { changed++; return { ...m, verified: true }; }
      return m;
    });
    if (changed) await saveSettings(settings);
    return json({ ok: true, ids: r.ids, newlyVerified: changed });
  }

  if (body.action === 'cleanup') {
    const out = { usageEvents: 0, archivedProjects: 0, references: 0, staleJobs: 0 };
    const stale = new Date(Date.now() - settings.advanced.staleJobMinutes * 60_000).toISOString();
    const { data: sj } = await db.from('ai_generation_jobs').update({ status: 'failed', error: 'Interrupted', finished_at: new Date().toISOString() }).eq('status', 'running').lt('started_at', stale).select('id');
    out.staleJobs = sj?.length || 0;
    if (settings.advanced.dataRetentionDays > 0) {
      const cutoff = new Date(Date.now() - settings.advanced.dataRetentionDays * 86400_000).toISOString();
      const { data: ue } = await db.from('ai_usage_events').delete().lt('created_at', cutoff).select('id');
      out.usageEvents = ue?.length || 0;
      const { data: ap } = await db.from('ai_itinerary_projects').select('id').not('archived_at', 'is', null).lt('archived_at', cutoff);
      for (const p of ap || []) {
        const [{ data: v }, { data: r }] = await Promise.all([
          db.from('ai_itinerary_versions').select('pdf_path').eq('project_id', p.id),
          db.from('ai_itinerary_references').select('storage_path').eq('project_id', p.id),
        ]);
        await removeObjects([...(v || []).map((x: any) => x.pdf_path), ...(r || []).map((x: any) => x.storage_path)].filter(Boolean));
        await db.from('ai_itinerary_projects').delete().eq('id', p.id);
        out.archivedProjects++;
      }
    }
    if (settings.references.retentionDays > 0) {
      const cutoff = new Date(Date.now() - settings.references.retentionDays * 86400_000).toISOString();
      const { data: refs } = await db.from('ai_itinerary_references').select('id, storage_path').lt('created_at', cutoff);
      await removeObjects((refs || []).map((r: any) => r.storage_path));
      if (refs?.length) await db.from('ai_itinerary_references').delete().in('id', refs.map((r: any) => r.id));
      out.references = refs?.length || 0;
    }
    return json({ ok: true, ...out });
  }

  throw new StudioError(400, 'invalid', 'Unknown action');
});
