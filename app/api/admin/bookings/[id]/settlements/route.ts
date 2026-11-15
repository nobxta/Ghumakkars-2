import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Razorpay's standard cycle: T+2 working days (weekends skipped; bank holidays not known). */
const expectedPayout = (from: string | null) => {
  if (!from) return null;
  const d = new Date(from);
  let added = 0;
  while (added < 2) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString();
};
const n = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * GET /api/admin/bookings/[id]/settlements
 * For each Razorpay payment on the booking: which Razorpay payout (settlement) it
 * went into, the fee + GST taken, what reached the bank, and any refunds deducted.
 * Keyed by payment_transactions.id.
 */
async function handleGET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();

  const { data: txns, error } = await admin
    .from('payment_transactions')
    .select('id, razorpay_payment_id, transaction_id, payment_mode, amount, paid_at, created_at, payment_status')
    .eq('booking_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rzp = (txns || [])
    .map((t: any) => ({ ...t, payId: t.razorpay_payment_id || (String(t.transaction_id || '').startsWith('pay_') ? t.transaction_id : null) }))
    .filter((t: any) => !!t.payId);

  const { data: sync } = await admin.from('razorpay_settlement_sync').select('last_synced_at, last_error').eq('id', 1).maybeSingle();
  if (rzp.length === 0) return NextResponse.json({ byPayment: {}, lastSyncedAt: sync?.last_synced_at || null });

  const { data: items, error: iErr } = await admin
    .from('razorpay_settlement_items')
    .select('settlement_id, entity_id, type, razorpay_payment_id, amount, fee, tax, credit, debit, on_hold, settled_at, settlement_utr, razorpay_settlements ( id, amount, utr, status, settled_at )')
    .in('razorpay_payment_id', rzp.map((t: any) => t.payId));
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  const byPayment: Record<string, any> = {};
  for (const t of rzp) {
    const rows = (items || []).filter((i: any) => i.razorpay_payment_id === t.payId);
    const pay = rows.find((i: any) => i.type === 'payment');
    const refunds = rows
      .filter((i: any) => i.type === 'refund')
      .map((i: any) => {
        const s = Array.isArray(i.razorpay_settlements) ? i.razorpay_settlements[0] : i.razorpay_settlements;
        return { refundId: i.entity_id, amount: r2(n(i.debit) || n(i.amount)), settlementId: i.settlement_id, settledAt: s?.settled_at || i.settled_at || null };
      });
    const paidAt = t.paid_at || t.created_at;
    if (!pay) {
      const expected = expectedPayout(paidAt);
      byPayment[t.id] = {
        state: ['verified', 'partially_refunded', 'refunded'].includes(String(t.payment_status))
          ? (expected && new Date(expected).getTime() + 86400000 < Date.now() ? 'late' : 'awaiting')
          : 'not_captured',
        paymentId: t.payId,
        expected,
        refunds,
      };
      continue;
    }
    const s = Array.isArray(pay.razorpay_settlements) ? pay.razorpay_settlements[0] : pay.razorpay_settlements;
    byPayment[t.id] = {
      state: pay.on_hold ? 'on_hold' : 'settled',
      paymentId: t.payId,
      settlementId: pay.settlement_id,
      settlementStatus: s?.status || null,
      settledAt: s?.settled_at || pay.settled_at || null,
      utr: pay.settlement_utr || s?.utr || null,
      payoutAmount: s ? r2(n(s.amount)) : null,
      gross: r2(n(pay.amount)),
      fee: r2(n(pay.fee)),
      tax: r2(n(pay.tax)),
      net: r2(n(pay.credit) || n(pay.amount) - n(pay.fee)),
      refunds,
    };
  }

  return NextResponse.json({ byPayment, lastSyncedAt: sync?.last_synced_at || null, syncError: sync?.last_error || null });
}

export const GET = withErrorLog('payment', 'Booking Razorpay settlements', handleGET);
