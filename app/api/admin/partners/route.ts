import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { cleanPartnerInput, loadPartnerAccounts, PARTNER_FIELDS } from '@/lib/partners-server';

export const runtime = 'nodejs';

/**
 * GET  — every partner with their account summary (bookings, margin, who owes whom).
 *        `?lite=1` returns just the active partner list (for pickers).
 * POST — create a partner.
 */
async function handleGET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();

  if (request.nextUrl.searchParams.get('lite')) {
    const { data, error } = await admin.from('partners').select(PARTNER_FIELDS).eq('is_active', true).order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ partners: data || [] });
  }

  const accounts = await loadPartnerAccounts(admin);
  const partners = accounts.map(({ partner, account }) => ({
    ...partner,
    account: {
      bookings: account.bookings,
      pax: account.pax,
      margin: account.margin,
      balance: account.balance,
      weOwe: account.weOwe,
      theyOwe: account.theyOwe,
      customerDue: account.customerDue,
      untracked: account.untracked,
    },
  }));
  const totals = partners.reduce(
    (t, p) => ({
      margin: t.margin + p.account.margin,
      weOwe: t.weOwe + p.account.weOwe,
      theyOwe: t.theyOwe + p.account.theyOwe,
      bookings: t.bookings + p.account.bookings,
    }),
    { margin: 0, weOwe: 0, theyOwe: 0, bookings: 0 },
  );
  return NextResponse.json({ partners, totals });
}

async function handlePOST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const fields = cleanPartnerInput(body);
  if (!fields.name) return NextResponse.json({ error: 'Enter the partner name' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('partners').select('id').ilike('name', String(fields.name)).maybeSingle();
  if (existing) return NextResponse.json({ error: 'A partner with that name already exists' }, { status: 409 });

  const { data, error } = await admin
    .from('partners')
    .insert([{ ...fields, created_by: auth.user.id }])
    .select(PARTNER_FIELDS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ partner: data, message: 'Partner added.' });
}

export const GET = withErrorLog('admin', 'List partners', handleGET);
export const POST = withErrorLog('admin', 'Create partner', handlePOST);
