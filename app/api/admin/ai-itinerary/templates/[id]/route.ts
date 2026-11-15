import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';
import { StudioError } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async ({ req, params }) => {
  const body = await readJson(req);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in body) { const n = str(body.name, 80); if (!n) throw new StudioError(400, 'invalid', 'Name is required'); patch.name = n; }
  if ('description' in body) patch.description = str(body.description, 200) || null;
  if ('theme' in body) { if (!isThemeKey(body.theme)) throw new StudioError(400, 'invalid', 'Unknown theme'); patch.theme = body.theme; }
  if ('themeOptions' in body) patch.theme_options = cleanThemeOptions(body.themeOptions);
  const { data, error } = await createAdminClient().from('ai_itinerary_templates').update(patch).eq('id', params.id).select('*').maybeSingle();
  if (error) throw new StudioError(500, 'db', error.message);
  if (!data) throw new StudioError(404, 'not_found', 'Template not found');
  return json({ template: data });
});

export const DELETE = adminRoute(async ({ params }) => {
  await createAdminClient().from('ai_itinerary_templates').delete().eq('id', params.id);
  return json({ ok: true });
});
