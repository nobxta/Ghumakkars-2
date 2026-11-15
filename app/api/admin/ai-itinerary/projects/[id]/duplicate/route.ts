import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, json } from '@/lib/ai-itinerary/http';
import { StudioError, loadProject } from '@/lib/ai-itinerary/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Copy trip details, itinerary and theme into a new draft (no messages, no PDFs). */
export const POST = adminRoute(async ({ params, userId }) => {
  const p = await loadProject(params.id);
  const { data, error } = await createAdminClient()
    .from('ai_itinerary_projects')
    .insert({
      title: `${p.title} (copy)`.slice(0, 140),
      destination: p.destination,
      duration_label: p.duration_label,
      status: p.itinerary ? 'editing' : p.status === 'generating' ? 'ready' : p.status,
      trip_details: p.trip_details,
      locked_fields: p.locked_fields,
      missing_fields: p.missing_fields,
      context_summary: (p as any).context_summary,
      itinerary: p.itinerary,
      itinerary_dirty: !!p.itinerary,
      theme: p.theme,
      theme_options: p.theme_options,
      model: p.model,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new StudioError(500, 'db', error.message);
  return json({ id: data.id }, 201);
});
