import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { cleanPartnerInput, loadPartnerAccounts, PARTNER_FIELDS } from '@/lib/partners-server';

export const runtime = 'nodejs';

/**
 * GET    — one partner: details, their bookings (with money), settlements, account.
 * PATCH  — edit details / default price / archive (is_active).
 * DELETE — remove a partner that has no bookings or settlements (else archive it).
 */
async function handleGET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const [acc] = await loadPartnerAccounts(admin, params.id);
  if (!acc) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  const { account, ...rest } = acc;
  return NextResponse.json({
    ...rest,
    account: {
      bookings: account.bookings,
      pax: account.pax,
      margin: account.margin,
      balance: account.balance,
      weOwe: account.weOwe,
      theyOwe: account.theyOwe,
      customerDue: account.customerDue,
      paidToPartner: account.paidToPartner,
      paidToUs: account.paidToUs,
      untracked: account.untracked,
    },
  });
}

async function handlePATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const fields = cleanPartnerInput(body);
  if ('name' in fields && !fields.name) return NextResponse.json({ error: 'Enter the partner name' }, { status: 400 });

  const admin = createAdminClient();
  if (fields.name) {
    const { data: clash } = await admin.from('partners').select('id').ilike('name', String(fields.name)).neq('id', params.id).maybeSingle();
    if (clash) return NextResponse.json({ error: 'Another partner already has that name' }, { status: 409 });
  }
  const { data, error } = await admin
    .from('partners')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select(PARTNER_FIELDS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Keep the legacy text column on their bookings in step with a rename.
  if (fields.name) {
    await admin.from('bookings').update({ referral_partner: fields.name }).eq('partner_id', params.id);
  }
  return NextResponse.json({ partner: data, message: 'Partner saved.' });
}

async function handleDELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const [{ count: bookings }, { count: settlements }] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('partner_id', params.id),
    admin.from('partner_settlements').select('id', { count: 'exact', head: true }).eq('partner_id', params.id),
  ]);
  if ((bookings || 0) > 0 || (settlements || 0) > 0) {
    return NextResponse.json({ error: 'This partner has bookings or settlements. Archive it instead.' }, { status: 400 });
  }
  const { error } = await admin.from('partners').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, message: 'Partner deleted.' });
}

export const GET = withErrorLog('admin', 'Get partner', handleGET);
export const PATCH = withErrorLog('admin', 'Update partner', handlePATCH);
export const DELETE = withErrorLog('admin', 'Delete partner', handleDELETE);
