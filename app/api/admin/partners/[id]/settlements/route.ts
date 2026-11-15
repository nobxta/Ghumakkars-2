import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { PARTNER_SETTLEMENT_METHODS } from '@/lib/partner-money';

export const runtime = 'nodejs';

/**
 * POST   — record money between us and the partner. `booking_id` is optional:
 *          without it the payment counts on the partner's whole account (a lump sum
 *          covering several bookings).
 * DELETE — `?sid=` remove a settlement recorded by mistake.
 */
async function handlePOST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const admin = createAdminClient();

  const { data: partner } = await admin.from('partners').select('id').eq('id', params.id).maybeSingle();
  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

  const direction = body.direction === 'from_partner' ? 'from_partner' : body.direction === 'to_partner' ? 'to_partner' : null;
  if (!direction) return NextResponse.json({ error: 'Choose who paid whom' }, { status: 400 });
  const amount = parseFloat(String(body.amount));
  if (Number.isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 });

  let bookingId: string | null = null;
  if (body.booking_id) {
    const { data: bk } = await admin.from('bookings').select('id, partner_id').eq('id', String(body.booking_id)).maybeSingle();
    if (!bk || bk.partner_id !== params.id) {
      return NextResponse.json({ error: 'That booking is not with this partner' }, { status: 400 });
    }
    bookingId = bk.id;
  }

  const method = (PARTNER_SETTLEMENT_METHODS as readonly string[]).includes(body.method) ? body.method : 'upi';
  const settledOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.settled_on || '')) ? String(body.settled_on) : new Date().toISOString().slice(0, 10);

  const { data, error } = await admin.from('partner_settlements').insert([{
    partner_id: params.id,
    booking_id: bookingId,
    direction,
    amount,
    method,
    reference: body.reference ? String(body.reference).slice(0, 120) : null,
    notes: body.notes ? String(body.notes).slice(0, 500) : null,
    settled_on: settledOn,
    created_by: auth.user.id,
  }]).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    success: true,
    id: data.id,
    message: direction === 'to_partner'
      ? `Recorded ₹${amount.toLocaleString('en-IN')} paid to the partner.`
      : `Recorded ₹${amount.toLocaleString('en-IN')} received from the partner.`,
  });
}

async function handleDELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const sid = request.nextUrl.searchParams.get('sid') || '';
  const admin = createAdminClient();
  const { data: row } = await admin.from('partner_settlements').select('id').eq('id', sid).eq('partner_id', params.id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
  const { error } = await admin.from('partner_settlements').delete().eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: 'Settlement removed.' });
}

export const POST = withErrorLog('admin', 'Record partner settlement', handlePOST);
export const DELETE = withErrorLog('admin', 'Delete partner settlement', handleDELETE);
