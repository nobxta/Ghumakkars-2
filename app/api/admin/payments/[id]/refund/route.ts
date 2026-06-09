import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { getRazorpayConfig } from '@/lib/razorpay';
import Razorpay from 'razorpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payments/[id]/refund
 * Body: { amount: number (rupees), reason?: string, speed?: 'normal' | 'optimum' }
 *
 * Validates:
 *  - Admin auth
 *  - Payment exists, is verified/captured, is Razorpay-mode
 *  - Refund amount > 0 and (amount + already refunded) <= paid amount
 * Calls Razorpay refund API server-side and inserts a payment_refunds row.
 * The webhook (refund.processed) eventually updates status to 'processed'.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminUserId = (auth as any).user?.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const amount = Number(body.amount);
  const reason: string = (body.reason || '').toString().slice(0, 500);
  const speed: 'normal' | 'optimum' = body.speed === 'optimum' ? 'optimum' : 'normal';

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Refund amount must be a positive number (in rupees).' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load payment
  const { data: payment, error: pErr } = await admin
    .from('payment_transactions')
    .select('id, booking_id, amount, amount_refunded, payment_status, payment_mode, razorpay_payment_id, transaction_id')
    .eq('id', params.id)
    .single();
  if (pErr || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  if (payment.payment_mode !== 'razorpay') {
    return NextResponse.json({ error: 'Only Razorpay payments can be refunded online.' }, { status: 400 });
  }
  if (!['verified', 'partially_refunded'].includes(String(payment.payment_status))) {
    return NextResponse.json(
      { error: `Cannot refund a payment with status "${payment.payment_status}".` },
      { status: 400 }
    );
  }

  const paid = Number(payment.amount);
  const alreadyRefunded = Number(payment.amount_refunded || 0);
  const remaining = paid - alreadyRefunded;
  if (amount > remaining + 0.001) {
    return NextResponse.json(
      { error: `Cannot refund ₹${amount}. Only ₹${remaining.toFixed(2)} refundable.` },
      { status: 400 }
    );
  }

  // Razorpay client
  let cfg;
  try {
    cfg = getRazorpayConfig();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  const razorpay = new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });

  const rzpPaymentId = payment.razorpay_payment_id || payment.transaction_id;
  if (!rzpPaymentId) {
    return NextResponse.json({ error: 'Payment is missing razorpay_payment_id.' }, { status: 400 });
  }

  // Call Razorpay refund API
  let rzpRefund: any;
  try {
    rzpRefund = await razorpay.payments.refund(rzpPaymentId, {
      amount: Math.round(amount * 100),
      speed,
      notes: { reason: reason || 'Admin refund' },
    } as any);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.error?.description || e?.message || 'Razorpay refund failed' },
      { status: 502 }
    );
  }

  // Insert refund record
  const status = rzpRefund.status === 'processed' ? 'processed' : 'pending';
  const { data: refundRow, error: rErr } = await admin
    .from('payment_refunds')
    .insert([{
      payment_id: payment.id,
      razorpay_refund_id: rzpRefund.id,
      amount,
      currency: rzpRefund.currency || 'INR',
      status,
      reason: reason || null,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
      initiated_by: adminUserId,
      razorpay_raw: rzpRefund,
    }])
    .select()
    .single();

  if (rErr) {
    // Refund was created on Razorpay but we couldn't store it — surface clearly
    return NextResponse.json(
      { error: `Razorpay refund ${rzpRefund.id} succeeded but DB insert failed: ${rErr.message}`, refund: rzpRefund },
      { status: 500 }
    );
  }

  // Update payment_transactions running totals
  const newRefunded = alreadyRefunded + (status === 'processed' ? amount : 0);
  // Even if pending, mark the running total optimistically so duplicate refunds are blocked
  const lockedTotal = alreadyRefunded + amount;
  const newStatus = lockedTotal >= paid - 0.001 ? 'refunded' : 'partially_refunded';
  await admin
    .from('payment_transactions')
    .update({
      amount_refunded: status === 'processed' ? newRefunded : alreadyRefunded,
      payment_status: newStatus,
    })
    .eq('id', payment.id);

  return NextResponse.json({ refund: refundRow, razorpay: rzpRefund });
}
