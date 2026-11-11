import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { paidOf, owedOf } from '@/lib/booking-money';
import { sendWhatsApp } from '@/lib/whatsapp';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';

const rupee = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * POST { bookingIds: string[] } → WhatsApp balance reminder to each booking's
 * primary passenger. Balance = owed − paid (same math as the dashboard), so a
 * seat-lock reminder shows the real remaining amount, not just the deposit.
 */
async function handlePOST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.bookingIds) ? body.bookingIds.filter((x: unknown) => typeof x === 'string').slice(0, 100) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'bookingIds is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: bookings, error } = await admin
    .from('bookings')
    .select('id, user_id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, addons_total, amount_paid, is_offline_booking, primary_passenger_name, primary_passenger_phone, trips(title, start_date, discounted_price), payment_transactions(amount, payment_status, amount_refunded)')
    .in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (bookings || []).map(async (b: any) => {
      const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
      const due = Math.max(0, owedOf(b) - paidOf(b));
      if (due <= 1) return { bookingId: b.id, ok: false, reason: 'No balance due' };
      if (!b.primary_passenger_phone) return { bookingId: b.id, ok: false, reason: 'No phone number' };
      const name = String(b.primary_passenger_name || 'traveller').trim().split(' ')[0];
      const title = String(trip?.title || 'your trip').trim();
      const dep = b.departure_date || trip?.start_date;
      const msg =
        `Hi ${name}! 👋\n\n` +
        `A quick reminder about your trip *${title}*${dep ? ` on *${fmtDate(dep)}*` : ''}.\n` +
        `🆔 Booking ${String(b.id).slice(0, 8).toUpperCase()}\n` +
        `💰 Balance due: *${rupee(due)}*\n\n` +
        `Please clear it from your booking page before departure to keep your seat confirmed. Reply here if you need any help. 🙏`;
      const res = await sendWhatsApp({ to: b.primary_passenger_phone, body: msg });
      if (res.ok && b.user_id) {
        await admin.from('admin_activity_log').insert({
          user_id: b.user_id,
          admin_id: auth.user.id,
          action_type: 'reminder_sent',
          action_description: `WhatsApp balance reminder for "${title}" - Remaining: ${rupee(due)}`,
          metadata: { booking_id: b.id, trip_title: title, remaining_amount: due, channel: 'whatsapp' },
        }).then(() => undefined, () => undefined);
      }
      return { bookingId: b.id, ok: res.ok, reason: res.ok ? undefined : res.error || 'Send failed' };
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, failed: results.length - sent, results });
}

export const POST = withErrorLog('admin', 'Dashboard reminder', handlePOST);
