import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID = ['verified', 'partially_refunded', 'refunded'];

/**
 * GET /api/admin/settlements
 * Everything the Settlements tab needs, from our DB (no Razorpay call):
 *   settlements — bank payouts, newest first
 *   items       — each settled payment/refund with booking, trip and customer
 *   pending     — captured Razorpay payments not in any payout yet
 *   sync        — when we last pulled from Razorpay
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();

  const [setl, items, paid, sync] = await Promise.all([
    admin.from('razorpay_settlements')
      .select('id, amount, fees, tax, utr, status, settled_at')
      .order('settled_at', { ascending: false })
      .limit(1000),
    admin.from('v_settlement_items_admin')
      .select('*')
      .order('settled_at', { ascending: false })
      .limit(10000),
    admin.from('v_payments_admin')
      .select('id, booking_id, user_id, razorpay_payment_id, transaction_id, amount, amount_refunded, payment_status, payment_method, payment_type, paid_at, created_at, customer_name, customer_email, customer_phone, primary_passenger_name, primary_passenger_email, primary_passenger_phone, trip_id, trip_title')
      .eq('payment_mode', 'razorpay')
      .in('payment_status', PAID)
      .order('created_at', { ascending: false })
      .limit(10000),
    admin.from('razorpay_settlement_sync').select('*').eq('id', 1).maybeSingle(),
  ]);
  const err = setl.error || items.error || paid.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  // Payments already inside a payout.
  const settledIds = new Set(
    (items.data || []).filter((i: any) => i.type === 'payment').map((i: any) => i.razorpay_payment_id)
  );
  const pendingRaw = (paid.data || []).filter((p: any) => {
    const rzpId = p.razorpay_payment_id || p.transaction_id;
    return rzpId?.startsWith('pay_') && !settledIds.has(rzpId);
  });

  // Attach the account holder (booking owner) to each pending payment.
  const bookingIds = [...new Set(pendingRaw.map((p: any) => p.booking_id).filter(Boolean))];
  const owners = new Map<string, string>();
  if (bookingIds.length) {
    const { data } = await admin.from('bookings').select('id, user_id').in('id', bookingIds);
    (data || []).forEach((b: any) => b.user_id && owners.set(b.id, b.user_id));
  }
  const userIds = [...new Set(pendingRaw.map((p: any) => owners.get(p.booking_id) || p.user_id).filter(Boolean))];
  const profiles = new Map<string, any>();
  if (userIds.length) {
    const { data } = await admin.from('profiles')
      .select('id, full_name, first_name, last_name, email, phone, avatar_url').in('id', userIds);
    (data || []).forEach((p: any) => profiles.set(p.id, p));
  }
  const pending = pendingRaw.map((p: any) => {
    const uid = owners.get(p.booking_id) || p.user_id || null;
    const pr = uid ? profiles.get(uid) : null;
    return {
      ...p,
      user_id: uid,
      profile_name: pr?.full_name || [pr?.first_name, pr?.last_name].filter(Boolean).join(' ') || null,
      profile_email: pr?.email || null,
      profile_phone: pr?.phone || null,
      profile_avatar_url: pr?.avatar_url || null,
    };
  });

  return NextResponse.json({
    settlements: setl.data || [],
    items: items.data || [],
    pending,
    sync: sync.data || null,
  });
}
