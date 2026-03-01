import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

/** PATCH: update offline booking (amount, name, mobile, etc.) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const body = await request.json();

    const adminClient = createAdminClient();
    const { data: existing, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, is_offline_booking')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.amount_paid != null) {
      const amt = parseFloat(String(body.amount_paid));
      if (!Number.isNaN(amt) && amt >= 0) {
        updates.amount_paid = amt;
        updates.final_amount = amt;
        updates.total_price = amt;
      }
    }
    if (body.primary_passenger_name != null) updates.primary_passenger_name = String(body.primary_passenger_name).trim().slice(0, 255);
    if (body.primary_passenger_phone != null) updates.primary_passenger_phone = String(body.primary_passenger_phone).replace(/\D/g, '').slice(0, 20);
    if (body.contact_phone != null) updates.contact_phone = String(body.contact_phone).replace(/\D/g, '').slice(0, 20);
    if (body.number_of_participants != null) {
      const n = Math.max(1, parseInt(String(body.number_of_participants), 10));
      if (!Number.isNaN(n)) updates.number_of_participants = n;
    }
    if (body.passengers != null) updates.passengers = body.passengers;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await adminClient
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Booking update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in PATCH booking:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
