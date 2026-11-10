import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = "nodejs";

// Pin / unpin a trip so it shows first on the public trips page.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const { is_featured } = await request.json();

    const { error } = await createAdminClient()
      .from('trips')
      .update({ is_featured: is_featured === true })
      .eq('id', id);

    if (error) {
      console.error('Error updating trip featured flag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await revalidateTripById(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in trip featured update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
