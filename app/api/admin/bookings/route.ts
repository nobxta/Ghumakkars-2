import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { moneyOf } from '@/lib/booking-money';

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
          is_recurring,
          discounted_price,
          cover_image_url,
          image_url,
          payment_due_days_before,
          whatsapp_group_link
        ),
        payment_transactions (
          id,
          transaction_id,
          amount,
          amount_refunded,
          payment_type,
          payment_status,
          payment_mode,
          payment_method,
          payment_reviewed_at,
          payment_reviewed_by,
          payment_review_notes,
          rejection_reason,
          paid_at,
          manual_payment_snapshot,
          created_at
        ),
        booking_addons (
          id, trip_addon_id, name, description, icon_key, category, pricing_method, unit_price,
          selected_passenger_ids, selected_passenger_names, quantity, room_occupancy, room_count,
          chargeable_units, addon_total, is_refundable, status, payment_status,
          cancellation_reason, cancelled_at, created_at
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

    const rows = bookings || [];
    const activeRows = rows.filter((booking: any) => !['cancelled', 'rejected', 'referred'].includes(String(booking.booking_status)));
    const summary = rows.reduce((acc: any, booking: any) => {
      const money = moneyOf(booking as any, (booking as any).trips);
      const active = !['cancelled', 'rejected', 'referred'].includes(String(booking.booking_status));
      if (active) {
        acc.collected += money.paid;
        acc.outstanding += money.remaining;
      }
      const status = String(booking.booking_status || 'pending');
      acc.byBookingStatus[status] = (acc.byBookingStatus[status] || 0) + 1;
      const needsReview =
        (booking.payment_transactions || []).some((p: any) => p.payment_status === 'pending') ||
        (booking.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(booking.payment_status)));
      if (needsReview) acc.needsReview += 1;
      return acc;
    }, {
      collected: 0,
      outstanding: 0,
      needsReview: 0,
      totalBookings: rows.length,
      activeBookings: activeRows.length,
      byBookingStatus: {},
    });

    return NextResponse.json({ bookings: rows, summary });
  } catch (error: any) {
    console.error('Error in admin bookings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
