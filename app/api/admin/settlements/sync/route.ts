import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { syncRazorpaySettlements } from '@/lib/razorpay-settlements';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/settlements/sync  body: { full?: boolean }
 * Pulls payouts + their per-transaction breakdown from Razorpay.
 * Incremental by default (from a little before the latest payout we have);
 * full=true re-reads everything since launch.
 */
async function handlePOST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await syncRazorpaySettlements(createAdminClient(), { full: !!body?.full });
    return NextResponse.json({ synced: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Settlement sync failed' }, { status: 502 });
  }
}

export const POST = withErrorLog('payment', 'Sync Razorpay settlements', handlePOST);
