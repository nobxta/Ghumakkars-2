import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = 'nodejs';

/**
 * Admin-only trigger to immediately refresh the cached public trip pages.
 * Used by the create/edit admin pages, which write trips directly from the
 * browser (and therefore can't call revalidatePath themselves).
 *
 * Pass `{ tripId }` to target a single trip (edit). Omit it for create — only
 * the list needs refreshing since the new trip's detail page isn't cached yet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { tripId } = await request.json().catch(() => ({ tripId: undefined }));
  await revalidateTripById(tripId);
  return NextResponse.json({ success: true, revalidated: true });
}
