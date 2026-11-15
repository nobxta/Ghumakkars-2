import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { getSettings } from '@/lib/ai-itinerary/settings';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIST_COLS =
  'id, title, destination, duration_label, status, theme, theme_options, model, current_version_id, is_final, itinerary_dirty, last_error, weighted_tokens, raw_tokens, archived_at, created_at, updated_at';

/** List itinerary projects. Filters: q, status, theme, archived=1, docs=1 (only with a PDF). */
export const GET = adminRoute(async ({ req }) => {
  const url = new URL(req.url);
  const db = createAdminClient();
  let q = db.from('ai_itinerary_projects').select(LIST_COLS).order('updated_at', { ascending: false }).limit(Math.min(500, Number(url.searchParams.get('limit')) || 200));
  if (url.searchParams.get('archived') === '1') q = q.not('archived_at', 'is', null);
  else if (url.searchParams.get('archived') !== 'all') q = q.is('archived_at', null);
  const status = url.searchParams.get('status');
  if (status) q = q.eq('status', status);
  const theme = url.searchParams.get('theme');
  if (theme) q = q.eq('theme', theme);
  if (url.searchParams.get('docs') === '1') q = q.not('current_version_id', 'is', null);
  const search = url.searchParams.get('q')?.trim();
  if (search) {
    const s = search.replace(/[%_,()]/g, ' ').slice(0, 80);
    q = q.or(`title.ilike.%${s}%,destination.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  // Version counts + current PDF size for the library.
  const ids = (data || []).map((p) => p.id);
  const counts: Record<string, number> = {};
  const sizes: Record<string, { size: number | null; pages: number | null }> = {};
  if (ids.length) {
    const { data: vers } = await db.from('ai_itinerary_versions').select('id, project_id, pdf_size, page_count').in('project_id', ids);
    for (const v of vers || []) {
      counts[v.project_id] = (counts[v.project_id] || 0) + 1;
      sizes[v.id] = { size: v.pdf_size, pages: v.page_count };
    }
  }
  return json({
    projects: (data || []).map((p) => ({
      ...p,
      version_count: counts[p.id] || 0,
      pdf_size: p.current_version_id ? sizes[p.current_version_id]?.size ?? null : null,
      page_count: p.current_version_id ? sizes[p.current_version_id]?.pages ?? null : null,
    })),
  });
});

/** Create a new itinerary project (optionally from a saved template). */
export const POST = adminRoute(async ({ req, userId }) => {
  const body = await readJson(req);
  const settings = await getSettings();
  const db = createAdminClient();
  let theme = isThemeKey(body.theme) ? body.theme : 'signature';
  let themeOptions = cleanThemeOptions(body.themeOptions);
  if (typeof body.templateId === 'string') {
    const { data: tpl } = await db.from('ai_itinerary_templates').select('theme, theme_options').eq('id', body.templateId).maybeSingle();
    if (tpl) { theme = tpl.theme; themeOptions = tpl.theme_options || {}; }
  }
  const { data, error } = await db
    .from('ai_itinerary_projects')
    .insert({
      title: str(body.title, 140) || 'Untitled itinerary',
      theme,
      theme_options: themeOptions,
      model: typeof body.model === 'string' ? body.model.slice(0, 60) : settings.ai.defaultModel,
      created_by: userId,
    })
    .select(LIST_COLS)
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ project: { ...data, version_count: 0 } }, 201);
});
