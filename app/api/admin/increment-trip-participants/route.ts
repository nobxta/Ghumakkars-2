import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { tripId, incrementBy } = await request.json();

    if (!tripId || incrementBy === undefined) {
      return NextResponse.json(
        { error: 'tripId and incrementBy are required' },
        { status: 400 }
      );
    }

    // Use admin client to update trip participants
    const adminClient = createAdminClient();
    
    // Fetch current participants
    const { data: trip, error: fetchError } = await adminClient
      .from('trips')
      .select('current_participants')
      .eq('id', tripId)
      .single();

    if (fetchError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Update participants
    const { error: updateError } = await adminClient
      .from('trips')
      .update({
        current_participants: (trip.current_participants || 0) + incrementBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('Error updating trip participants:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update trip participants' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in increment trip participants API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


