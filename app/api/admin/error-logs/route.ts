import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET              → all logs (table keeps at most 500, last 7 days)
 * GET ?summary=1   → { unresolved } errors in the last 24h, for the sidebar badge
 * PATCH { id?, resolved, all? } → mark one (or every) log resolved / unresolved
 * DELETE ?scope=resolved|all    → clear logs
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminClient = createAdminClient();

  if (request.nextUrl.searchParams.get('summary')) {
    const { count, error } = await adminClient
      .from('error_logs')
      .select('id', { count: 'exact', head: true })
      .eq('level', 'error')
      .eq('resolved', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ unresolved: count || 0 });
  }

  const { data, error } = await adminClient
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id, all, resolved } = await request.json().catch(() => ({}));
  if (typeof resolved !== 'boolean' || (!id && !all)) {
    return NextResponse.json({ error: 'id (or all) and resolved are required' }, { status: 400 });
  }

  let query = createAdminClient().from('error_logs').update({ resolved });
  query = all ? query.eq('resolved', !resolved) : query.eq('id', id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const scope = request.nextUrl.searchParams.get('scope');
  let query = createAdminClient().from('error_logs').delete();
  if (scope === 'resolved') query = query.eq('resolved', true);
  else if (scope === 'all') query = query.not('id', 'is', null);
  else return NextResponse.json({ error: 'scope must be resolved or all' }, { status: 400 });

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
