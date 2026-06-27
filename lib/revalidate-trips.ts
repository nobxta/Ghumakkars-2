import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Broad refresh: the trips list + EVERY trip detail page. Use only for bulk
 * operations (e.g. status sync) or deletes where the affected slug is gone.
 *
 * Server-only — must be called from a route handler or server action.
 */
export function revalidatePublicTrips() {
  revalidatePath('/trips'); // the trips list
  revalidatePath('/trips/[id]', 'page'); // every trip detail page
}

/**
 * Targeted refresh: the trips list + ONE trip's detail page. The detail page is
 * cached under whatever path the visitor used, and the list links by
 * `slug || id`, so we revalidate both `/trips/{id}` and `/trips/{slug}`. The
 * slug is looked up here so callers only need the trip id.
 *
 * Best-effort and self-contained — call it AFTER the DB change has committed.
 * If it throws, the 10-minute ISR window is the fallback. Never let it affect
 * the booking/payment flow.
 */
export async function revalidateTripById(tripId?: string | null) {
  try {
    revalidatePath('/trips'); // list shows seat counts / availability
    if (!tripId) return;
    revalidatePath(`/trips/${tripId}`);
    const { data } = await createAdminClient()
      .from('trips')
      .select('slug')
      .eq('id', tripId)
      .single();
    if (data?.slug) revalidatePath(`/trips/${data.slug}`);
  } catch {
    // Best-effort only — the ISR fallback still refreshes within 10 minutes.
  }
}
