import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, internalFetchHeaders } from '@/lib/auth-helpers';
import { fullOwed, derivePaymentStatus } from '@/lib/booking-money';

export const runtime = 'nodejs';

// Booking statuses that occupy a seat on the trip.
const COUNTED = ['confirmed', 'seat_locked', 'on_trip', 'completed', 'referred'];
// Statuses an admin may set from the Change-Status modal (+ hidden `pending`).
const ALLOWED_STATUS = ['pending', 'seat_locked', 'confirmed', 'on_trip', 'completed', 'cancelled', 'referred'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank', 'online', 'razorpay'];

/**
 * Admin booking controls. Booking Status and Payment Status are INDEPENDENT here:
 *
 *   record_payment      — adds money to the ledger, recomputes Payment Status.
 *                         NEVER changes Booking Status.
 *   record_refund       — records a manual (cash) refund and recomputes Payment Status.
 *                         (Razorpay refunds go through /api/admin/payments/[id]/refund.)
 *   set_status          — changes Booking Status only. NEVER changes payment.
 *                         `notify` gates the customer email/WhatsApp.
 *   set_referral        — saves partner/commission/notes and marks status referred.
 *   save_internal_notes — admin-only operational notes.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const body = await request.json();
    const action = body.action;
    const adminClient = createAdminClient();

    const { data: b, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, trip_id, user_id, booking_status, payment_method, is_offline_booking, number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used, amount_paid, departure_date')
      .eq('id', id)
      .single();
    if (fetchErr || !b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const pax = Number(b.number_of_participants) || 1;

    const { data: tripRow } = await adminClient
      .from('trips')
      .select('discounted_price, current_participants')
      .eq('id', b.trip_id)
      .single();

    const owed = fullOwed(b as any, tripRow as any);

    // Pull the full ledger once; reused for money math + recompute.
    const loadLedger = async () =>
      (await adminClient.from('payment_transactions').select('amount, payment_status, amount_refunded').eq('booking_id', id)).data || [];

    const moneyFromLedger = (txns: any[]) => {
      const paid = txns
        .filter((t) => ['verified', 'partially_refunded', 'refunded'].includes(String(t.payment_status)))
        .reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
      const refunded = txns.reduce((s, t) => s + parseFloat(String(t.amount_refunded || 0)), 0);
      const net = Math.max(0, paid - refunded);
      // Legacy offline rows with no ledger track money on amount_paid.
      const effective = txns.length === 0 && (b.is_offline_booking || !b.user_id) ? parseFloat(String(b.amount_paid || 0)) : net;
      return { effective, refunded };
    };

    /** Recompute + persist the denormalized payment mirrors after any money change. */
    const syncPaymentMirrors = async () => {
      const txns = await loadLedger();
      const { effective, refunded } = moneyFromLedger(txns);
      const status = derivePaymentStatus(effective, owed, refunded > 0);
      await adminClient.from('bookings').update({ payment_status: status, amount_paid: effective }).eq('id', id);
      return { paid: effective, remaining: Math.max(0, owed - effective), status };
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
      const mode = PAYMENT_MODES.includes(body.method) ? body.method : 'cash';
      const reference = body.reference ? String(body.reference).slice(0, 120) : '';
      const notes = body.notes ? String(body.notes).slice(0, 500) : '';

      await adminClient.from('payment_transactions').insert([{
        booking_id: id,
        user_id: b.user_id,
        transaction_id: reference || `MANUAL_${mode.toUpperCase()}_${Date.now()}`,
        amount,
        payment_type: 'offline',
        payment_status: 'verified',
        payment_mode: mode,
        payment_reviewed_at: new Date().toISOString(),
        payment_reviewed_by: auth.user.id,
        payment_review_notes: notes || 'Recorded in person by admin',
      }]);

      const money = await syncPaymentMirrors();
      return NextResponse.json({
        success: true,
        ...money,
        message: `Payment of ₹${amount.toLocaleString('en-IN')} recorded. Payment status: ${money.status}.`,
      });
    }

    // ───────────────────────── record_refund ─────────────────────────
    // Manual / cash refund. Records the refunded money against the most recent
    // verified non-Razorpay payment (Razorpay refunds use the dedicated endpoint).
    if (action === 'record_refund') {
      if (!body.confirm) return NextResponse.json({ error: 'Refund requires confirmation' }, { status: 400 });
      const amount = parseFloat(String(body.amount));
      if (Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Enter a valid refund amount' }, { status: 400 });
      }
      const notes = body.notes ? String(body.notes).slice(0, 500) : '';

      const txns = await loadLedger();
      const { effective } = moneyFromLedger(txns);
      if (amount > effective + 0.5) {
        return NextResponse.json({ error: `Cannot refund ₹${amount.toLocaleString('en-IN')} — only ₹${effective.toLocaleString('en-IN')} was collected.` }, { status: 400 });
      }

      // Find a verified manual/cash payment row to attach the refund to; else create
      // a standalone refund ledger entry so the math still balances.
      const { data: target } = await adminClient
        .from('payment_transactions')
        .select('id, amount, amount_refunded, payment_mode')
        .eq('booking_id', id)
        .eq('payment_status', 'verified')
        .neq('payment_mode', 'razorpay')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (target) {
        const already = parseFloat(String(target.amount_refunded || 0));
        const newRefunded = already + amount;
        const fully = newRefunded >= parseFloat(String(target.amount)) - 0.5;
        await adminClient.from('payment_transactions').update({
          amount_refunded: newRefunded,
          payment_status: fully ? 'refunded' : 'partially_refunded',
          payment_review_notes: notes || 'Manual refund by admin',
        }).eq('id', target.id);
      } else {
        await adminClient.from('payment_transactions').insert([{
          booking_id: id,
          user_id: b.user_id,
          transaction_id: `REFUND_${Date.now()}`,
          amount: 0,
          amount_refunded: amount,
          payment_type: 'refund',
          payment_status: 'refunded',
          payment_mode: body.method && PAYMENT_MODES.includes(body.method) ? body.method : 'cash',
          payment_reviewed_at: new Date().toISOString(),
          payment_reviewed_by: auth.user.id,
          payment_review_notes: notes || 'Manual refund by admin',
        }]);
      }

      const money = await syncPaymentMirrors();
      return NextResponse.json({ success: true, ...money, message: `Refund of ₹${amount.toLocaleString('en-IN')} recorded.` });
    }

    // ───────────────────────── set_status ─────────────────────────
    if (action === 'set_status') {
      const status = String(body.status || '');
      if (!ALLOWED_STATUS.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (status === b.booking_status) {
        return NextResponse.json({ error: 'Booking is already in that status' }, { status: 400 });
      }
      // Cancelling is destructive — require explicit confirmation.
      if (status === 'cancelled' && !body.confirm) {
        return NextResponse.json({ error: 'Cancellation requires confirmation' }, { status: 400 });
      }

      const wasCounted = COUNTED.includes(b.booking_status);
      const willCount = COUNTED.includes(status);
      if (willCount && !wasCounted) await adjustSeats(pax);
      if (!willCount && wasCounted) await adjustSeats(-pax);

      // Booking status ONLY — payment is never touched here.
      const updates: Record<string, unknown> = { booking_status: status };
      if (status === 'cancelled') {
        updates.rejection_reason = body.reason ? String(body.reason).slice(0, 500) : 'Cancelled by admin';
      }
      await adminClient.from('bookings').update(updates).eq('id', id);

      // Notify only if requested (checkbox) and the status has customer copy.
      const notifiable = ['seat_locked', 'confirmed', 'on_trip', 'completed', 'cancelled'];
      const shouldNotify = body.notify !== false && notifiable.includes(status);
      if (shouldNotify) await notify(status, body.reason);

      return NextResponse.json({
        success: true,
        bookingStatus: status,
        notified: shouldNotify,
        message: `Booking set to ${status.replace('_', ' ')}${shouldNotify ? ' and customer notified.' : '.'}`,
      });
    }

    // ───────────────────────── set_referral ─────────────────────────
    if (action === 'set_referral') {
      const partner = body.partner ? String(body.partner).slice(0, 200) : null;
      const commission = body.commission != null && body.commission !== '' ? parseFloat(String(body.commission)) : 0;
      if (Number.isNaN(commission) || commission < 0) {
        return NextResponse.json({ error: 'Enter a valid commission amount' }, { status: 400 });
      }
      const refNotes = body.notes ? String(body.notes).slice(0, 1000) : null;

      const wasCounted = COUNTED.includes(b.booking_status);
      if (!wasCounted) await adjustSeats(pax);

      await adminClient.from('bookings').update({
        booking_status: 'referred',
        referral_partner: partner,
        referral_commission: commission,
        referral_notes: refNotes,
      }).eq('id', id);

      return NextResponse.json({ success: true, bookingStatus: 'referred', message: 'Booking marked as referred.' });
    }

    // ───────────────────────── save_internal_notes ─────────────────────────
    if (action === 'save_internal_notes') {
      const notes = body.notes != null ? String(body.notes).slice(0, 4000) : '';
      await adminClient.from('bookings').update({ internal_notes: notes }).eq('id', id);
      return NextResponse.json({ success: true, message: 'Internal notes saved.' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in manage booking:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
