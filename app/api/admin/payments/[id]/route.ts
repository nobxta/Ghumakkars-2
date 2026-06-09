import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/payments/[id] — full payment + refund history */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from('v_payments_admin')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  const { data: refunds } = await admin
    .from('payment_refunds')
    .select('*')
    .eq('payment_id', params.id)
    .order('created_at', { ascending: false });

  // Also get raw razorpay payload (held only on payment_transactions, not in view)
  const { data: raw } = await admin
    .from('payment_transactions')
    .select('razorpay_raw')
    .eq('id', params.id)
    .single();

  return NextResponse.json({ payment, refunds: refunds || [], razorpay_raw: raw?.razorpay_raw || null });
}
