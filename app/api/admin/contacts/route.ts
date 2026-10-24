import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanContactInput } from '@/lib/admin-contacts';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → { contacts, trips } (trips for the "linked trips" picker) */
async function handleGET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminClient = createAdminClient();

  const [contactsRes, tripsRes] = await Promise.all([
    adminClient.from('admin_contacts').select('*').order('is_favorite', { ascending: false }).order('name'),
    adminClient.from('trips').select('id, title, destination').order('title'),
  ]);
  if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 });

  return NextResponse.json({ contacts: contactsRes.data || [], trips: tripsRes.data || [] });
}

/** POST → create a contact */
async function handlePOST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const cleaned = cleanContactInput(await request.json().catch(() => null));
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from('admin_contacts')
    .insert({ ...cleaned.data, created_by: auth.user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export const GET = withErrorLog('admin', 'Load contacts', handleGET);
export const POST = withErrorLog('admin', 'Save contact', handlePOST);
