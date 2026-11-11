import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { replyToComment, sendDm } from '@/lib/instagram-tracker/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST { type: 'comment', id, text }                  → public reply under a comment
 * POST { type: 'dm', userId, conversationId, text }   → DM (only within Instagram's 24h window)
 */
export const POST = withErrorLog('admin', 'Instagram manual reply', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const b = await request.json().catch(() => ({}));
  const text = String(b.text || '').trim().slice(0, 1000);
  if (!text) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  const db = createAdminClient();
  const now = new Date().toISOString();

  try {
    if (b.type === 'comment' && /^\d+$/.test(String(b.id))) {
      await replyToComment(String(b.id), text);
      await db.from('instagram_comments').update({ replied: true, reply_source: 'manual', reply_text: text, replied_at: now }).eq('id', String(b.id));
      return NextResponse.json({ ok: true });
    }
    if (b.type === 'dm' && /^\d+$/.test(String(b.userId)) && typeof b.conversationId === 'string') {
      const r = await sendDm(String(b.userId), text);
      if (r?.message_id) {
        await db.from('instagram_dm_messages').upsert({ id: r.message_id, conversation_id: b.conversationId, direction: 'out', user_id: String(b.userId), username: b.username || null, text, created_at: now }, { onConflict: 'id' });
      }
      return NextResponse.json({ ok: true });
    }
  } catch (e: any) {
    const msg = /outside of allowed window|2534022/i.test(`${e.message} ${e.code}`)
      ? 'More than 24 hours since their last message — Instagram only allows replies inside that window. Reply from the Instagram app instead.'
      : e.message;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
});
