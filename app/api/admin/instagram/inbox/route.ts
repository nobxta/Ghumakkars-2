import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { withErrorLog } from '@/lib/error-log';
import { istDay } from '@/lib/instagram-tracker/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

/** GET → today's DM/comment numbers, 14-day trend, recent chats, comments and auto replies. */
export const GET = withErrorLog('admin', 'Instagram inbox', async (request: NextRequest) => {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const db = createAdminClient();

  // ?conversation=<id> → that chat's synced messages, oldest first.
  const conv = request.nextUrl.searchParams.get('conversation');
  if (conv) {
    const { data, error } = await db.from('instagram_dm_messages')
      .select('id, direction, text, has_attachment, is_auto, created_at')
      .eq('conversation_id', conv).order('created_at', { ascending: false }).limit(60);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: (data || []).reverse() });
  }

  const todayKey = istDay(new Date().toISOString());
  const todayStart = new Date(`${todayKey}T00:00:00+05:30`).toISOString();
  const since14 = new Date(new Date(todayStart).getTime() - 13 * DAY).toISOString();

  const [msgRes, cmRes, arRes, cfgRes, recentCm] = await Promise.all([
    db.from('instagram_dm_messages').select('id, conversation_id, direction, user_id, username, text, has_attachment, is_auto, created_at').gte('created_at', since14).order('created_at', { ascending: true }).limit(10000),
    db.from('instagram_comments').select('id, user_id, created_at, replied, reply_source, replied_at').gte('created_at', since14).limit(10000),
    db.from('instagram_auto_replies').select('*').order('created_at', { ascending: false }).limit(60),
    db.from('instagram_automation').select('*').eq('id', 1).maybeSingle(),
    db.from('instagram_comments').select('*').order('created_at', { ascending: false }).limit(40),
  ]);
  if (msgRes.error) return NextResponse.json({ error: msgRes.error.message }, { status: 500 });

  const msgs = msgRes.data || [];
  const comments = cmRes.data || [];

  /* Today */
  const today = msgs.filter((m: any) => m.created_at >= todayStart);
  const inToday = today.filter((m: any) => m.direction === 'in');
  const firstIn = new Map<string, string>();
  inToday.forEach((m: any) => { if (!firstIn.has(m.conversation_id)) firstIn.set(m.conversation_id, m.created_at); });
  let replied = 0;
  firstIn.forEach((at, conv) => {
    if (today.some((m: any) => m.conversation_id === conv && m.direction === 'out' && m.created_at > at)) replied++;
  });
  const autoToday = (arRes.data || []).filter((r: any) => r.created_at >= todayStart);
  const cmToday = comments.filter((c: any) => c.created_at >= todayStart);

  /* 14-day trend */
  const days: { date: string; dmsIn: number; people: number; comments: number; autoReplies: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = istDay(new Date(new Date(todayStart).getTime() - i * DAY + 3_600_000).toISOString());
    days.push({ date: key, dmsIn: 0, people: 0, comments: 0, autoReplies: 0 });
  }
  const idx = new Map(days.map((d, i) => [d.date, i]));
  const people = new Map<string, Set<string>>();
  msgs.forEach((m: any) => {
    if (m.direction !== 'in') return;
    const k = istDay(m.created_at); const i = idx.get(k); if (i == null) return;
    days[i].dmsIn++;
    if (!people.has(k)) people.set(k, new Set());
    people.get(k)!.add(m.conversation_id);
  });
  people.forEach((set, k) => { const i = idx.get(k); if (i != null) days[i].people = set.size; });
  comments.forEach((c: any) => { const i = idx.get(istDay(c.created_at)); if (i != null) days[i].comments++; });
  msgs.forEach((m: any) => { if (m.is_auto) { const i = idx.get(istDay(m.created_at)); if (i != null) days[i].autoReplies++; } });

  /* Conversations: newest message per chat */
  const convMap = new Map<string, any>();
  msgs.forEach((m: any) => {
    const c = convMap.get(m.conversation_id) || { id: m.conversation_id, user_id: m.user_id, username: m.username, unanswered: 0, last: null };
    c.last = m;
    c.unanswered = m.direction === 'in' ? c.unanswered + 1 : 0;
    if (m.username) c.username = m.username;
    convMap.set(m.conversation_id, c);
  });
  const conversations = Array.from(convMap.values()).sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1)).slice(0, 40);

  return NextResponse.json({
    today: {
      dmsIn: inToday.length,
      people: firstIn.size,
      peopleReplied: replied,
      autoDm: autoToday.filter((r: any) => r.kind === 'dm' && r.status === 'sent').length,
      comments: cmToday.length,
      commentsReplied: cmToday.filter((c: any) => c.replied).length,
      autoComment: autoToday.filter((r: any) => r.kind === 'comment' && r.status === 'sent').length,
      privateReplies: autoToday.filter((r: any) => r.kind === 'comment_dm' && r.status === 'sent').length,
      failed: autoToday.filter((r: any) => r.status === 'failed').length,
    },
    days,
    conversations,
    comments: recentCm.data || [],
    autoReplies: arRes.data || [],
    automation: cfgRes.data,
  });
});
