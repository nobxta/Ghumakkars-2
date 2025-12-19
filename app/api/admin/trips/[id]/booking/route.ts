import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in booking status update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

