import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, internalFetchHeaders } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

const COUNTED = ['confirmed', 'seat_locked'];

/**
 * Admin booking controls used from the booking detail page.
 *
 *   { action: 'record_payment', amount, mode?, notes? }
 *     Records cash/UPI money taken in person. Adds a verified payment, then
 *     auto-sets the booking to confirmed (fully paid) or seat_locked (partial).
 *
 *   { action: 'set_status', status, reason? }
 *     Manually move a booking between pending / seat_locked / confirmed /
 *     cancelled / rejected. Keeps the trip seat count in sync and emails the
 *     traveller for confirmed / seat_locked / cancelled / rejected.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const body = await request.json();
    const action = body.action;
    const adminClient = createAdminClient();

    // Load the booking with everything we need to do the money math.
    const { data: b, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, trip_id, user_id, booking_status, payment_method, is_offline_booking, number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used, amount_paid, departure_date')
      .eq('id', id)
      .single();

    if (fetchErr || !b) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const pax = Number(b.number_of_participants) || 1;

    // Full amount actually owed, after the customer's coupon + wallet discounts.
    const { data: tripRow } = await adminClient
      .from('trips')
      .select('discounted_price, current_participants')
      .eq('id', b.trip_id)
      .single();
    const coupon = Number(b.coupon_discount || 0);
    const wallet = Number(b.wallet_amount_used || 0);
    // Seat-lock bookings store only the DEPOSIT in total_price/final_amount, so
    // the full trip cost must come from list price × pax. Full-payment bookings
    // already have the net total in final_amount.
    const isSeatLock = b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked';
    const gross = isSeatLock
      ? Number(tripRow?.discounted_price || 0) * pax
      : (Number(b.total_price || 0) || Number(tripRow?.discounted_price || 0) * pax);
    const fullOwed = isSeatLock
      ? Math.max(0, gross - coupon - wallet)
      : (Number(b.final_amount || 0) > 0 ? Number(b.final_amount) : Math.max(0, gross - coupon - wallet));

    // Current money actually received.
    const currentPaid = async (): Promise<number> => {
      if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
      const { data: txns } = await adminClient
        .from('payment_transactions')
        .select('amount, payment_status')
        .eq('booking_id', id);
      return (txns || [])
        .filter((t: any) => t.payment_status === 'verified')
        .reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
    };

    const adjustSeats = async (delta: number) => {
      if (!b.trip_id || delta === 0) return;
      const next = Math.max(0, (Number(tripRow?.current_participants) || 0) + delta);
      await adminClient.from('trips').update({ current_participants: next, updated_at: new Date().toISOString() }).eq('id', b.trip_id);
    };

    const notify = async (status: string, reason?: string) => {
      try {
        await fetch(`${request.nextUrl.origin}/api/bookings/send-notification`, {
          method: 'POST',
          headers: internalFetchHeaders(),
          body: JSON.stringify({ bookingId: id, status, rejectionReason: reason }),
        });
      } catch (e) {
        console.error('manage: notification failed', e);
      }
    };

    // ───────────────────────── record_payment ─────────────────────────
    if (action === 'record_payment') {
      const amount = parseFloat(String(body.amount));
      if (Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
      }
      const mode = body.mode === 'upi' ? 'upi' : 'cash';

      const paidBefore = await currentPaid();
      const paidAfter = paidBefore + amount;

      // Record the money. Online bookings track money as verified transactions;
      // offline bookings track it on amount_paid.
      if (b.is_offline_booking || !b.user_id) {
        await adminClient.from('bookings').update({ amount_paid: paidAfter }).eq('id', id);
      } else {
        await adminClient.from('payment_transactions').insert([{
          booking_id: id,
          transaction_id: `MANUAL_${mode.toUpperCase()}_${Date.now()}`,
          amount,
          payment_type: paidAfter >= fullOwed - 1 ? 'full' : 'partial',
          payment_status: 'verified',
          payment_mode: mode,
          payment_reviewed_at: new Date().toISOString(),
          payment_reviewed_by: auth.user.id,
          payment_review_notes: body.notes || 'Recorded in person by admin',
        }]);
      }

      const newStatus = paidAfter >= fullOwed - 1 ? 'confirmed' : 'seat_locked';
      const wasCounted = COUNTED.includes(b.booking_status);
      if (!wasCounted) await adjustSeats(pax);

      await adminClient.from('bookings').update({
        booking_status: newStatus,
        payment_status: paidAfter >= fullOwed - 1 ? 'paid' : 'partial',
      }).eq('id', id);

      await notify(newStatus);

      return NextResponse.json({
        success: true,
        bookingStatus: newStatus,
        paid: paidAfter,
        remaining: Math.max(0, fullOwed - paidAfter),
        message: newStatus === 'confirmed' ? 'Payment recorded. Booking confirmed and email sent.' : 'Payment recorded. Seat still locked (balance pending).',
      });
    }

    // ───────────────────────── set_status ─────────────────────────
    if (action === 'set_status') {
      const status = String(body.status || '');
      const allowed = ['pending', 'seat_locked', 'confirmed', 'cancelled', 'rejected'];
      if (!allowed.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (status === b.booking_status) {
        return NextResponse.json({ error: 'Booking is already in that status' }, { status: 400 });
      }

      const wasCounted = COUNTED.includes(b.booking_status);
      const willCount = COUNTED.includes(status);
      if (willCount && !wasCounted) await adjustSeats(pax);
      if (!willCount && wasCounted) await adjustSeats(-pax);

      const updates: Record<string, unknown> = { booking_status: status };
      if (status === 'cancelled' || status === 'rejected') {
        updates.payment_status = 'refunded';
        updates.rejection_reason = body.reason ? String(body.reason).slice(0, 500) : 'Cancelled by admin';
      }
      if (status === 'confirmed') updates.payment_status = 'paid';
      await adminClient.from('bookings').update(updates).eq('id', id);

      // Email the traveller for the meaningful transitions (skip plain "pending").
      if (['confirmed', 'seat_locked', 'cancelled', 'rejected'].includes(status)) {
        await notify(status, body.reason);
      }

      return NextResponse.json({
        success: true,
        bookingStatus: status,
        message: `Booking set to ${status.replace('_', ' ')}${['confirmed', 'seat_locked', 'cancelled', 'rejected'].includes(status) ? ' and email sent.' : '.'}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in manage booking:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
