import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (s: unknown) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, 1000);
const isUuid = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);

/** POST { kind: 'dm'|'comment', text } → save a reply. */
export const POST = withErrorLog('admin', 'Instagram template add', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  const text = clean(b.text);
  if (b.kind !== 'dm' && b.kind !== 'comment') return NextResponse.json({ error: 'Bad kind' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Reply text is empty.' }, { status: 400 });
  if (b.kind === 'comment' && text.length > 300) return NextResponse.json({ error: 'Comment replies must be 300 characters or fewer.' }, { status: 400 });
  const db = createAdminClient();
  const { count } = await db.from('instagram_reply_templates').select('id', { count: 'exact', head: true }).eq('kind', b.kind);
  const { data, error } = await db.from('instagram_reply_templates').insert({ kind: b.kind, text, pinned: !count }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
});

/** PATCH { id, text?, is_active?, pinned? } */
export const PATCH = withErrorLog('admin', 'Instagram template update', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  if (!isUuid(b.id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const db = createAdminClient();
  const { data: t } = await db.from('instagram_reply_templates').select('id, kind').eq('id', b.id).maybeSingle();
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const p: Record<string, unknown> = {};
  if (b.text != null) {
    const text = clean(b.text);
    if (!text) return NextResponse.json({ error: 'Reply text is empty.' }, { status: 400 });
    if (t.kind === 'comment' && text.length > 300) return NextResponse.json({ error: 'Comment replies must be 300 characters or fewer.' }, { status: 400 });
    p.text = text;
  }
  if (typeof b.is_active === 'boolean') p.is_active = b.is_active;
  if (b.pinned === true) {
    await db.from('instagram_reply_templates').update({ pinned: false }).eq('kind', t.kind);
    p.pinned = true;
    p.is_active = true;
  }
  const { error } = await db.from('instagram_reply_templates').update(p).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** DELETE ?id= */
export const DELETE = withErrorLog('admin', 'Instagram template delete', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = request.nextUrl.searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const { error } = await createAdminClient().from('instagram_reply_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
