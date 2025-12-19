import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { action, reason, date, price } = await request.json();

    const adminClient = createAdminClient();

    let updateData: any = {};

    switch (action) {
      case 'complete':
        updateData = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          is_active: false,
        };
        // Set actual participants to current participants
        const { data: trip } = await adminClient
          .from('trips')
          .select('current_participants')
          .eq('id', id)
          .single();
        if (trip) {
          updateData.actual_participants = trip.current_participants;
        }
        break;

      case 'cancel':
        updateData = {
          status: 'cancelled',
          cancellation_reason: reason || null,
          is_active: false,
        };
        break;

      case 'postpone':
        if (!date) {
          return NextResponse.json(
            { error: 'Postpone date is required' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'postponed',
          postponed_to_date: date,
          is_active: false,
        };
        break;

      case 'change_price':
        if (!price || price <= 0) {
          return NextResponse.json(
            { error: 'Valid price is required' },
            { status: 400 }
          );
        }
        updateData = {
          discounted_price: price,
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const { error } = await adminClient
      .from('trips')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating trip status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in trip status update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

