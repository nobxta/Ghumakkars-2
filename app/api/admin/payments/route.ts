import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments
 * Query: ?q= search; ?status= verified|pending|rejected|refunded|partially_refunded;
 *        ?method= upi|card|netbanking|wallet; ?limit= ?offset=
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const status = sp.get('status') || '';
  const method = sp.get('method') || '';
  const limit = Math.min(parseInt(sp.get('limit') || '50'), 200);
  const offset = parseInt(sp.get('offset') || '0');

  const admin = createAdminClient();
  let query = admin
    .from('v_payments_admin')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('payment_status', status);
  if (method) query = query.eq('payment_method', method);
  if (q) {
    query = query.or(
      `razorpay_payment_id.ilike.%${q}%,razorpay_order_id.ilike.%${q}%,transaction_id.ilike.%${q}%,booking_id.eq.${q.match(/^[0-9a-f-]{36}$/) ? q : '00000000-0000-0000-0000-000000000000'},customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,primary_passenger_name.ilike.%${q}%,trip_title.ilike.%${q}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data || [], total: count || 0 });
}
