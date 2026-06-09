import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { getRazorpayConfig } from '@/lib/razorpay';
import Razorpay from 'razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payments/[id]/sync
 * Re-fetch the payment from Razorpay and backfill all rich fields.
 * Useful for old payments created before the rich capture was added.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: pt, error } = await admin
    .from('payment_transactions')
    .select('id, transaction_id, razorpay_payment_id')
    .eq('id', params.id)
    .single();
  if (error || !pt) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  const rzpPaymentId = pt.razorpay_payment_id || pt.transaction_id;
  if (!rzpPaymentId || !rzpPaymentId.startsWith('pay_')) {
    return NextResponse.json({ error: 'Not a Razorpay payment (no pay_… id).' }, { status: 400 });
  }

  let cfg;
  try {
    cfg = getRazorpayConfig();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const razorpay = new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });

  let p: any;
  try {
    p = await razorpay.payments.fetch(rzpPaymentId);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.error?.description || e?.message || 'Razorpay fetch failed' },
      { status: 502 }
    );
  }

  const acquirer = p.acquirer_data || {};
  const update: Record<string, any> = {
    razorpay_payment_id: rzpPaymentId,
    razorpay_order_id: p.order_id || null,
    currency: p.currency || 'INR',
    payment_method: p.method || null,
    captured: !!p.captured,
    vpa: p.vpa || null,
    upi_provider: acquirer.upi_provider || null,
    card_network: p.card?.network || null,
    card_type: p.card?.type || null,
    card_last4: p.card?.last4 || null,
    card_issuer: p.card?.issuer || null,
    bank: p.bank || null,
    wallet: p.wallet || null,
    customer_email: p.email || null,
    customer_phone: p.contact || null,
    paid_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : null,
    razorpay_raw: p,
  };

  // Also sync refunds list if any
  let refundCount = 0;
  try {
    const refunds = await razorpay.payments.fetchMultipleRefund(rzpPaymentId);
    const items = (refunds as any)?.items || [];
    refundCount = items.length;
    let amountRefunded = 0;
    for (const r of items) {
      const amount = (r.amount || 0) / 100;
      if (r.status === 'processed') amountRefunded += amount;
      await admin.from('payment_refunds').upsert(
        {
          payment_id: pt.id,
          razorpay_refund_id: r.id,
          amount,
          currency: r.currency || 'INR',
          status: r.status,
          reason: r.notes?.reason || null,
          notes: r.notes || null,
          processed_at: r.status === 'processed' && r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
          razorpay_raw: r,
        },
        { onConflict: 'razorpay_refund_id' }
      );
    }
    update.amount_refunded = amountRefunded;
  } catch (e) {
    // Refund fetch failure shouldn't break the sync — log but continue
    console.error('Refund sync failed:', e);
  }

  await admin.from('payment_transactions').update(update).eq('id', pt.id);

  return NextResponse.json({ synced: true, razorpay: p, refunds_synced: refundCount });
}
