import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { tgCall, sendToAdmins, getTelegramSettings } from '@/lib/telegram';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { data } = await admin.from('telegram_settings').select('*').eq('id', 1).single();
  return NextResponse.json(data || {});
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const action = body.action || 'save';
  const admin = createAdminClient();

  if (action === 'test') {
    const s = await getTelegramSettings();
    if (!s?.bot_token) return NextResponse.json({ error: 'Add and save the bot token first.' }, { status: 400 });
    if (!s.admin_chat_ids?.length) return NextResponse.json({ error: 'Add at least one admin Chat ID first.' }, { status: 400 });
    await sendToAdmins('✅ <b>Test message</b>\nGhumakkars is connected to this chat. You will get booking and payment alerts here.');
    return NextResponse.json({ success: true, message: 'Test message sent.' });
  }

  if (action === 'set_webhook') {
    const s = await getTelegramSettings();
    if (!s?.bot_token) return NextResponse.json({ error: 'Add and save the bot token first.' }, { status: 400 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const secret = s.webhook_secret || crypto.randomBytes(16).toString('hex');
    if (!s.webhook_secret) {
      await admin.from('telegram_settings').update({ webhook_secret: secret }).eq('id', 1);
    }
    const hook = await tgCall('setWebhook', {
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }, s.bot_token);
    // Cache the bot username for display.
    const me = await tgCall('getMe', {}, s.bot_token);
    if (me?.ok && me.result?.username) {
      await admin.from('telegram_settings').update({ bot_username: me.result.username }).eq('id', 1);
    }
    if (!hook?.ok) return NextResponse.json({ error: hook?.description || 'setWebhook failed' }, { status: 400 });
    return NextResponse.json({ success: true, message: 'Webhook connected.', botUsername: me?.result?.username || null });
  }

  // Default: save settings
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) updates.enabled = !!body.enabled;
  if (body.bot_token !== undefined) updates.bot_token = body.bot_token ? String(body.bot_token).trim() : null;
  if (body.notify_new_booking !== undefined) updates.notify_new_booking = !!body.notify_new_booking;
  if (body.notify_payments !== undefined) updates.notify_payments = !!body.notify_payments;
  if (body.admin_chat_ids !== undefined) {
    const ids = Array.isArray(body.admin_chat_ids)
      ? body.admin_chat_ids
      : String(body.admin_chat_ids).split(/[\s,]+/);
    updates.admin_chat_ids = ids.map((x: string) => String(x).trim()).filter(Boolean);
  }

  const { data, error } = await admin.from('telegram_settings').update(updates).eq('id', 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, settings: data });
}
