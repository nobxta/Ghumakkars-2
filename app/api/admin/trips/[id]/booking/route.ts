import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { revalidateTripById } from '@/lib/revalidate-trips';

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const { booking_disabled } = await request.json();

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('trips')
      .update({ booking_disabled: booking_disabled === true })
      .eq('id', id);

    if (error) {
      console.error('Error updating booking status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Enabling/disabling bookings changes the "Book Now" state shown publicly.
    await revalidateTripById(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in booking status update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

