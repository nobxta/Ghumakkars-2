import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json, readJson } from '@/lib/ai-itinerary/http';
import { str } from '@/lib/ai-itinerary/schema';
import { StudioError, loadProject, restoreVersion } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** One version including its itinerary JSON (for compare). */
export const GET = adminRoute(async ({ params }) => {
  const { data } = await createAdminClient()
    .from('ai_itinerary_versions')
    .select('*')
    .eq('id', params.versionId)
    .eq('project_id', params.id)
    .maybeSingle();
  if (!data) throw new StudioError(404, 'not_found', 'Version not found');
  return json({ version: data });
});

/** action: restore | label */
export const POST = adminRoute(async ({ req, params }) => {
  const body = await readJson(req);
  if (body.action === 'restore') {
    await restoreVersion(params.id, params.versionId);
  } else if (body.action === 'label') {
    await createAdminClient().from('ai_itinerary_versions').update({ label: str(body.label, 80) || null }).eq('id', params.versionId).eq('project_id', params.id);
  } else {
    throw new StudioError(400, 'invalid', 'Unknown action');
  }
  return json({ project: await loadProject(params.id) });
});
