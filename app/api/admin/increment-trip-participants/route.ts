import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Verify user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

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


