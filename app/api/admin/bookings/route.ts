import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminClient = createAdminClient();
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(`
        *,
        trips (
          title,
          destination,
          duration_days,
          start_date,
          end_date,
          whatsapp_group_link
        ),
        payment_transactions (
          id,
          transaction_id,
          amount,
          payment_type,
          payment_status,
          payment_reviewed_at,
          payment_reviewed_by,
          payment_review_notes,
          rejection_reason,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    // Fetch profiles separately for each booking
    if (bookings && bookings.length > 0) {
      const userIds = Array.from(new Set(bookings.map(b => b.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', userIds);

        // Map profiles to bookings
        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          bookings.forEach((booking: any) => {
            booking.profiles = profileMap.get(booking.user_id) || null;
          });
        }
      }
    }

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: bookingsError.message || 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: any) {
    console.error('Error in admin bookings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

