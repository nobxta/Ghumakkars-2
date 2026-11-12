import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { countOpenProblems } from '@/lib/log-explain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 2000;

/**
 * GET              → runs auto-cleanup, then returns every log (table keeps at most 2000)
 * GET ?summary=1   → { unresolved } open "needs attention" problems, for the sidebar badge
 * PATCH { id? | ids? | all?, resolved } → mark logs fixed / not fixed
 * DELETE ?scope=resolved|routine|all    → clear logs
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const adminClient = createAdminClient();

  if (request.nextUrl.searchParams.get('summary')) {
    const { data, error } = await adminClient
      .from('error_logs')
      .select('level, category, process, message, code, status, resolved')
      .eq('resolved', false)
      .limit(MAX_ROWS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ unresolved: countOpenProblems((data || []) as any) });
  }

  // Cleanup also runs on insert, but a quiet week means no inserts, so run it here too.
  const { error: cleanupError } = await adminClient.rpc('cleanup_error_logs');
  if (cleanupError) console.error('[ErrorLogs] cleanup failed:', cleanupError.message);

  const { data, error } = await adminClient
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id, ids, all, resolved } = await request.json().catch(() => ({}));
  const idList: string[] = Array.isArray(ids) ? ids.filter((v: unknown) => typeof v === 'string').slice(0, MAX_ROWS) : [];
  if (typeof resolved !== 'boolean' || (!id && !all && idList.length === 0)) {
    return NextResponse.json({ error: 'id, ids or all, and resolved are required' }, { status: 400 });
  }

  let query = createAdminClient().from('error_logs').update({ resolved });
  query = all ? query.eq('resolved', !resolved) : idList.length ? query.in('id', idList) : query.eq('id', id);
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
  else if (scope === 'routine') query = query.eq('level', 'warning');
  else if (scope === 'all') query = query.not('id', 'is', null);
  else return NextResponse.json({ error: 'scope must be resolved, routine or all' }, { status: 400 });

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
