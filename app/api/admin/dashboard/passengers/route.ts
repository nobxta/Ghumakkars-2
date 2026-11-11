import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { paidOf, owedOf } from '@/lib/booking-money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IST_OFFSET_MS = 330 * 60000;
const depDay = (v: unknown) => {
  const s = String(v || '');
  if (!s) return '';
  return s.length <= 10 ? s : new Date(new Date(s).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};
const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything; neutralise spreadsheet formula injection.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/**
 * GET /api/admin/dashboard/passengers?tripId=&date=YYYY-MM-DD
 * → CSV passenger manifest for one departure (one row per traveller).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const tripId = sp.get('tripId') || '';
  const date = sp.get('date') || '';
  if (!/^[0-9a-f-]{36}$/i.test(tripId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'tripId and date (YYYY-MM-DD) are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: trip }, { data: bookings, error }] = await Promise.all([
    admin.from('trips').select('title, start_date, discounted_price').eq('id', tripId).single(),
    admin.from('bookings')
      .select('id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, is_offline_booking, user_id, primary_passenger_name, primary_passenger_phone, primary_passenger_email, pickup_point, passengers, trips(discounted_price), payment_transactions(amount, payment_status, amount_refunded)')
      .eq('trip_id', tripId)
      .not('booking_status', 'in', '(cancelled,rejected)')
      .order('created_at', { ascending: true }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (bookings || []).filter((b: any) => depDay(b.departure_date || trip?.start_date) === date);

  const header = ['Booking ID', 'Status', 'Traveller', 'Age', 'Gender', 'Phone', 'Primary contact', 'Contact phone', 'Contact email', 'Pickup point', 'Travellers in booking', 'Paid', 'Due'];
  const lines = [header.map(cell).join(',')];
  rows.forEach((b: any) => {
    const list: any[] = Array.isArray(b.passengers) && b.passengers.length > 0 ? b.passengers : [{ name: b.primary_passenger_name, phone: b.primary_passenger_phone }];
    const paid = paidOf(b);
    const due = Math.max(0, owedOf(b) - paid);
    list.forEach((p, i) => {
      lines.push([
        String(b.id).slice(0, 8).toUpperCase(),
        String(b.booking_status || '').replace(/_/g, ' '),
        p?.name || (i === 0 ? b.primary_passenger_name : ''),
        p?.age ?? '',
        p?.gender ?? '',
        p?.phone || (i === 0 ? b.primary_passenger_phone : ''),
        b.primary_passenger_name || '',
        b.primary_passenger_phone || '',
        b.primary_passenger_email || '',
        b.pickup_point || '',
        Number(b.number_of_participants) || list.length,
        i === 0 ? Math.round(paid) : '',
        i === 0 ? Math.round(due) : '',
      ].map(cell).join(','));
    });
  });

  const safeTitle = String(trip?.title || 'trip').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle}-${date}-passengers.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
