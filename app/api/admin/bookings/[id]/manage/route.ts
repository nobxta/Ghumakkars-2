import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, internalFetchHeaders } from '@/lib/auth-helpers';
import { fullOwed, owedOf, derivePaymentStatus } from '@/lib/booking-money';
import { revalidateTripById } from '@/lib/revalidate-trips';
import { markBookingAddonsPaid } from '@/lib/addons-server';
import { SEAT_STATUSES } from '@/lib/booking-admin-sync';
import { withErrorLog } from '@/lib/error-log';
import { partnerPriceFrom, PARTNER_SETTLEMENT_METHODS } from '@/lib/partner-money';

export const runtime = 'nodejs';

// Booking statuses that occupy a seat on the trip.
const COUNTED = SEAT_STATUSES;
// Statuses an admin may set from the Change-Status modal (+ hidden `pending`).
// `referred` is set only through set_referral (or reopening a cancelled partner booking).
const ALLOWED_STATUS = ['pending', 'seat_locked', 'confirmed', 'on_trip', 'completed', 'cancelled', 'referred'];
// Statuses a booking can go back to when its referral is removed.
const RESTORABLE = ['pending', 'seat_locked', 'confirmed', 'remaining_submitted'];
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
 *   set_referral        — hands the booking to a partner (or edits that): partner +
 *                         partner price. Status becomes `referred`, seats are freed.
 *   clear_referral      — undoes a referral and restores the previous status.
 *   record_payment      — `collected_by: 'partner'` records money the customer paid
 *                         the partner directly (e.g. cash at boarding).
 *   delete_partner_collection — removes such a row (typo / wrong amount).
 *   record_partner_settlement / delete_partner_settlement — money between us and
 *                         the partner for this booking.
 *   save_internal_notes — admin-only operational notes.
 */
async function handlePOST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const body = await request.json();
    const action = body.action;
    const adminClient = createAdminClient();

    const { data: b, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, trip_id, user_id, booking_status, payment_method, is_offline_booking, number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used, waived_amount, amount_paid, addons_total, departure_date, partner_id, partner_price, referral_commission, referral_status_before')
      .eq('id', id)
      .single();
    if (fetchErr || !b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const pax = Number(b.number_of_participants) || 1;

    const { data: tripRow } = await adminClient
      .from('trips')
      .select('discounted_price, current_participants')
      .eq('id', b.trip_id)
      .single();

    // What the customer actually owes = full price minus any waived (written-off) balance.
    const owed = owedOf(b as any, tripRow as any);

    // Pull the full ledger once; reused for money math + recompute.
    const loadLedger = async () =>
      (await adminClient.from('payment_transactions').select('amount, payment_status, amount_refunded, collected_by').eq('booking_id', id)).data || [];
    const isPartner = !!b.partner_id || b.booking_status === 'referred';

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
      // Seats changed (status change / cancellation / referral) — refresh the
      // affected trip's public pages immediately.
      await revalidateTripById(b.trip_id);
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
      const collectedBy = body.collected_by === 'partner' ? 'partner' : 'us';
      if (collectedBy === 'partner' && !b.partner_id) {
        return NextResponse.json({ error: 'Only a booking handed to a partner can have money collected by the partner.' }, { status: 400 });
      }

      await adminClient.from('payment_transactions').insert([{
        booking_id: id,
        user_id: b.user_id,
        collected_by: collectedBy,
        transaction_id: reference || `${collectedBy === 'partner' ? 'BOARDING' : 'MANUAL'}_${mode.toUpperCase()}_${Date.now()}`,
        amount,
        payment_type: 'offline',
        payment_status: 'verified',
        payment_mode: mode,
        payment_reviewed_at: new Date().toISOString(),
        payment_reviewed_by: auth.user.id,
        payment_review_notes: notes || (collectedBy === 'partner' ? 'Paid to the trip operator' : 'Recorded in person by admin'),
      }]);

      const money = await syncPaymentMirrors();
      // A fully-settled booking settles its add-ons too (for the status display).
      if (money.status === 'paid' && b.payment_method !== 'seat_lock') {
        await markBookingAddonsPaid(adminClient, id).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        ...money,
        message: collectedBy === 'partner'
          ? `₹${amount.toLocaleString('en-IN')} paid to the partner recorded.`
          : `Payment of ₹${amount.toLocaleString('en-IN')} recorded. Payment status: ${money.status}.`,
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

      const txns = (await loadLedger()).filter((t: any) => t.collected_by !== 'partner');
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
        .eq('collected_by', 'us')
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
      // Partner bookings: only cancel, or reopen a cancelled one back to the partner.
      if (status === 'referred' && !(b.partner_id && b.booking_status === 'cancelled')) {
        return NextResponse.json({ error: 'Use “Refer to partner” to hand a booking to a partner.' }, { status: 400 });
      }
      if (b.partner_id && !['cancelled', 'referred'].includes(status)) {
        return NextResponse.json({ error: 'This booking is with a partner. Remove the referral first to change its status.' }, { status: 400 });
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
    // Hand the booking to a partner, or edit an existing referral.
    if (action === 'set_referral') {
      if (['cancelled', 'rejected'].includes(String(b.booking_status))) {
        return NextResponse.json({ error: 'Reopen the booking before handing it to a partner.' }, { status: 400 });
      }

      // Partner: an existing one, or create one on the spot.
      let partner: { id: string; name: string } | null = null;
      if (body.partner_id) {
        const { data } = await adminClient.from('partners').select('id, name').eq('id', String(body.partner_id)).maybeSingle();
        partner = data;
      } else if (body.new_partner?.name && String(body.new_partner.name).trim()) {
        const name = String(body.new_partner.name).trim().slice(0, 120);
        const { data: existing } = await adminClient.from('partners').select('id, name').ilike('name', name).maybeSingle();
        if (existing) {
          partner = existing;
        } else {
          const { data: created, error: createErr } = await adminClient.from('partners').insert([{
            name,
            phone: body.new_partner.phone ? String(body.new_partner.phone).slice(0, 30) : null,
            default_price_basis: body.price_basis === 'total' ? 'total' : 'per_person',
            default_price_rate: body.price_basis === 'total' ? null : (parseFloat(String(body.price_rate)) || null),
            created_by: auth.user.id,
          }]).select('id, name').single();
          if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });
          partner = created;
        }
      }
      if (!partner) return NextResponse.json({ error: 'Choose a partner' }, { status: 400 });

      const basis = body.price_basis === 'total' ? 'total' : 'per_person';
      const rate = parseFloat(String(body.price_rate));
      if (Number.isNaN(rate) || rate < 0) {
        return NextResponse.json({ error: 'Enter the partner price' }, { status: 400 });
      }
      const partnerPrice = partnerPriceFrom(basis, rate, pax);
      const margin = Math.round((owed - partnerPrice) * 100) / 100;
      const refNotes = body.notes != null ? String(body.notes).slice(0, 1000) : null;

      const already = !!b.partner_id || b.booking_status === 'referred';
      const updates: Record<string, unknown> = {
        partner_id: partner.id,
        partner_price: partnerPrice,
        partner_price_basis: basis,
        partner_price_rate: rate,
        referral_partner: partner.name, // kept for older readers
        referral_commission: margin, // snapshot of our margin
        referral_notes: refNotes,
      };
      if (!already) {
        updates.booking_status = 'referred';
        updates.referral_status_before = b.booking_status || 'pending';
        updates.referred_at = new Date().toISOString();
        updates.referred_by = auth.user.id;
      }
      await adminClient.from('bookings').update(updates).eq('id', id);

      // The partner runs the trip, so the traveller frees their seat on ours.
      if (!already && COUNTED.includes(b.booking_status)) await adjustSeats(-pax);

      return NextResponse.json({
        success: true,
        bookingStatus: 'referred',
        margin,
        partnerPrice,
        message: already
          ? `Referral updated: partner price ₹${partnerPrice.toLocaleString('en-IN')}, your margin ₹${margin.toLocaleString('en-IN')}.`
          : `Handed to ${partner.name}. Your margin: ₹${margin.toLocaleString('en-IN')}.`,
      });
    }

    // ───────────────────────── clear_referral ─────────────────────────
    if (action === 'clear_referral') {
      if (!isPartner) return NextResponse.json({ error: 'This booking is not with a partner.' }, { status: 400 });

      const [{ count: partnerRows }, { count: settlementRows }] = await Promise.all([
        adminClient.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('booking_id', id).eq('collected_by', 'partner'),
        adminClient.from('partner_settlements').select('id', { count: 'exact', head: true }).eq('booking_id', id),
      ]);
      if ((partnerRows || 0) > 0 || (settlementRows || 0) > 0) {
        return NextResponse.json({
          error: 'This booking has payments to the partner or settlements recorded. Delete those first, then remove the referral.',
        }, { status: 400 });
      }

      let restoreTo = String(b.booking_status);
      if (b.booking_status === 'referred') {
        const before = String(b.referral_status_before || '');
        if (RESTORABLE.includes(before)) {
          restoreTo = before;
        } else {
          const { effective } = moneyFromLedger(await loadLedger());
          restoreTo = effective >= owed - 1 && effective > 0 ? 'confirmed' : effective > 0 ? 'seat_locked' : 'pending';
        }
      }

      await adminClient.from('bookings').update({
        booking_status: restoreTo,
        partner_id: null,
        partner_price: null,
        partner_price_basis: null,
        partner_price_rate: null,
        referral_partner: null,
        referral_commission: 0,
        referral_notes: null,
        referral_status_before: null,
        referred_at: null,
        referred_by: null,
      }).eq('id', id);

      if (b.booking_status === 'referred' && COUNTED.includes(restoreTo)) await adjustSeats(pax);

      return NextResponse.json({ success: true, bookingStatus: restoreTo, message: `Referral removed. Booking is back to ${restoreTo.replace('_', ' ')}.` });
    }

    // ───────────────────────── delete_partner_collection ─────────────────────────
    if (action === 'delete_partner_collection') {
      const txnId = String(body.transaction_row_id || '');
      const { data: row } = await adminClient
        .from('payment_transactions')
        .select('id, collected_by, amount')
        .eq('id', txnId)
        .eq('booking_id', id)
        .maybeSingle();
      if (!row || row.collected_by !== 'partner') {
        return NextResponse.json({ error: 'Payment to partner not found' }, { status: 404 });
      }
      await adminClient.from('payment_transactions').delete().eq('id', row.id);
      const money = await syncPaymentMirrors();
      return NextResponse.json({ success: true, ...money, message: `Removed ₹${Number(row.amount).toLocaleString('en-IN')} paid to partner.` });
    }

    // ───────────────────────── record_partner_settlement ─────────────────────────
    if (action === 'record_partner_settlement') {
      if (!b.partner_id) return NextResponse.json({ error: 'This booking is not with a partner.' }, { status: 400 });
      const direction = body.direction === 'from_partner' ? 'from_partner' : body.direction === 'to_partner' ? 'to_partner' : null;
      if (!direction) return NextResponse.json({ error: 'Choose who paid whom' }, { status: 400 });
      const amount = parseFloat(String(body.amount));
      if (Number.isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });
      const method = (PARTNER_SETTLEMENT_METHODS as readonly string[]).includes(body.method) ? body.method : 'upi';
      const settledOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.settled_on || '')) ? String(body.settled_on) : new Date().toISOString().slice(0, 10);

      const { error: insErr } = await adminClient.from('partner_settlements').insert([{
        partner_id: b.partner_id,
        booking_id: id,
        direction,
        amount,
        method,
        reference: body.reference ? String(body.reference).slice(0, 120) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        settled_on: settledOn,
        created_by: auth.user.id,
      }]);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      return NextResponse.json({
        success: true,
        message: direction === 'to_partner'
          ? `Recorded ₹${amount.toLocaleString('en-IN')} paid to the partner.`
          : `Recorded ₹${amount.toLocaleString('en-IN')} received from the partner.`,
      });
    }

    // ───────────────────────── delete_partner_settlement ─────────────────────────
    if (action === 'delete_partner_settlement') {
      const sid = String(body.settlement_id || '');
      const { data: row } = await adminClient.from('partner_settlements').select('id').eq('id', sid).eq('booking_id', id).maybeSingle();
      if (!row) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
      await adminClient.from('partner_settlements').delete().eq('id', row.id);
      return NextResponse.json({ success: true, message: 'Settlement removed.' });
    }

    // ───────────────────────── settle_balance ─────────────────────────
    // "They paid X and nothing more is due" — write off the rest. Sets waived so the
    // amount owed equals what's been paid: remaining -> 0 and payment status -> Paid.
    if (action === 'settle_balance') {
      const txns = await loadLedger();
      const { effective, refunded } = moneyFromLedger(txns);
      const fullPrice = fullOwed(b as any, tripRow as any);

      if (body.clear) {
        // Undo the write-off — the full balance is owed again.
        const status = derivePaymentStatus(effective, fullPrice, refunded > 0);
        await adminClient.from('bookings').update({ waived_amount: 0, payment_status: status, amount_paid: effective }).eq('id', id);
        return NextResponse.json({ success: true, paid: effective, remaining: Math.max(0, fullPrice - effective), waived: 0, message: 'Write-off removed — full balance is due again.' });
      }

      const newWaived = Math.max(0, fullPrice - effective);
      const status = derivePaymentStatus(effective, effective, refunded > 0); // owed == paid -> Paid
      await adminClient.from('bookings').update({ waived_amount: newWaived, payment_status: status, amount_paid: effective }).eq('id', id);
      return NextResponse.json({
        success: true,
        paid: effective,
        remaining: 0,
        waived: newWaived,
        message: newWaived > 0
          ? `Balance settled — ₹${effective.toLocaleString('en-IN')} marked paid in full, ₹${newWaived.toLocaleString('en-IN')} written off.`
          : 'Already paid in full — nothing to write off.',
      });
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

export const POST = withErrorLog('admin', 'Manage booking', handlePOST);
