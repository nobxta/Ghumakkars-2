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
  // Strip characters that break PostgREST's or() filter syntax (e.g. "Sharma, Rahul").
  const q = (sp.get('q') || '').replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  const status = sp.get('status') || '';
  const method = sp.get('method') || '';
  const limit = Math.min(parseInt(sp.get('limit') || '50') || 50, 200);
  const offset = Math.max(0, parseInt(sp.get('offset') || '0') || 0);

  const admin = createAdminClient();
  const applyFilters = (query: any) => {
    if (status) query = query.eq('payment_status', status);
    if (method) query = query.eq('payment_method', method);
    if (q) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(q);
      const digits = q.replace(/\D/g, '');
      const parts = [
        `razorpay_payment_id.ilike.%${q}%`,
        `razorpay_order_id.ilike.%${q}%`,
        `transaction_id.ilike.%${q}%`,
        `booking_id.eq.${isUuid ? q : '00000000-0000-0000-0000-000000000000'}`,
        `customer_name.ilike.%${q}%`,
        `customer_email.ilike.%${q}%`,
        `primary_passenger_name.ilike.%${q}%`,
        `primary_passenger_email.ilike.%${q}%`,
        `trip_title.ilike.%${q}%`,
      ];
      // Phone search: match on the digits (ignores spaces, +91, dashes).
      if (digits.length >= 4) {
        const tail = digits.slice(-10);
        parts.push(`customer_phone.ilike.%${tail}%`, `primary_passenger_phone.ilike.%${tail}%`);
      }
      query = query.or(parts.join(','));
    }
    return query;
  };

  const { data, count, error } = await applyFilters(
    admin
      .from('v_payments_admin')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Headline totals must cover EVERY matching payment, not just this page.
  let summaryRows: any[] | undefined;
  if (offset === 0) {
    const { data: rows, error: sErr } = await applyFilters(
      admin
        .from('v_payments_admin')
        .select('amount, amount_refunded, payment_status, payment_method, payment_mode, paid_at, created_at, trip_title')
        .order('created_at', { ascending: false })
        .limit(10000)
    );
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    summaryRows = rows || [];
  }

  return NextResponse.json({ payments: data || [], total: count || 0, summaryRows });
}
