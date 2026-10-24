import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanContactInput } from '@/lib/admin-contacts';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { id: string } };

/** PATCH → update any subset of fields */
async function handlePATCH(request: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const cleaned = cleanContactInput(await request.json().catch(() => null), true);
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from('admin_contacts')
    .update({ ...cleaned.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  return NextResponse.json({ contact: data });
}

/** DELETE → remove a contact */
async function handleDELETE(_request: NextRequest, { params }: Context) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { error } = await createAdminClient().from('admin_contacts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrorLog('admin', 'Update contact', handlePATCH);
export const DELETE = withErrorLog('admin', 'Delete contact', handleDELETE);
