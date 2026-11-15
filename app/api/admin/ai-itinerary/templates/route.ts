import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';
import { StudioError } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const { data, error } = await createAdminClient().from('ai_itinerary_templates').select('*').order('updated_at', { ascending: false });
  if (error) throw new StudioError(500, 'db', error.message);
  return json({ templates: data || [] });
});

export const POST = adminRoute(async ({ req }) => {
  const body = await readJson(req);
  const name = str(body.name, 80);
  if (!name) throw new StudioError(400, 'invalid', 'Name is required');
  if (!isThemeKey(body.theme)) throw new StudioError(400, 'invalid', 'Unknown base theme');
  const { data, error } = await createAdminClient()
    .from('ai_itinerary_templates')
    .insert({ name, description: str(body.description, 200) || null, theme: body.theme, theme_options: cleanThemeOptions(body.themeOptions) })
    .select('*')
    .single();
  if (error) throw new StudioError(500, 'db', error.message);
  return json({ template: data }, 201);
});
