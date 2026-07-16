import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('trips')
      .select(`
        id,
        title,
        destination,
        discounted_price,
        seat_lock_price,
        max_participants,
        current_participants,
        start_date,
        end_date,
        duration_days,
        duration_text,
        is_active,
        status,
        booking_disabled,
        is_recurring,
        recurrence_day,
        recurrence_weeks_ahead,
        pickup_points,
        addons_enabled
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch trips' }, { status: 500 });
    }

    return NextResponse.json({ trips: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
