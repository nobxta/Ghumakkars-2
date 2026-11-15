import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { cleanThemeOptions, isThemeKey, str } from '@/lib/ai-itinerary/schema';
import { StudioError, loadProject, rerender } from '@/lib/ai-itinerary/service';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Re-render the PDF from the current itinerary — no AI tokens.
 * body.snapshot = true + label → "Save version": labels the current version when
 * nothing changed, otherwise renders a new labelled version.
 */
export const POST = adminRoute(async ({ req, params }) => {
  const body = await readJson(req);
  const project = await loadProject(params.id);
  if (!project.itinerary) throw new StudioError(400, 'no_itinerary', 'Generate an itinerary first');
  const label = str(body.label, 80) || null;
  if (body.snapshot && project.current_version_id && !project.itinerary_dirty) {
    await createAdminClient().from('ai_itinerary_versions').update({ label: label || 'Saved' }).eq('id', project.current_version_id);
    return json({ project: await loadProject(params.id), labelled: true });
  }
  const v = await rerender(params.id, {
    theme: isThemeKey(body.theme) ? body.theme : undefined,
    themeOptions: body.themeOptions ? cleanThemeOptions(body.themeOptions) : undefined,
    source: body.snapshot ? 'snapshot' : project.itinerary_dirty ? 'manual' : 'rerender',
    label: body.snapshot ? label || 'Saved' : label,
  });
  return json({ project: await loadProject(params.id), version: v });
});
