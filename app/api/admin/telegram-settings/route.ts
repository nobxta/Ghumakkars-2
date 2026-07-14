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
  let webhookStatus = 'not_configured';
  if (data?.bot_token) {
    const info = await tgCall('getWebhookInfo', {}, data.bot_token).catch(() => null);
    webhookStatus = info?.ok && info.result?.url
      ? (info.result?.last_error_message ? 'webhook_error' : 'connected')
      : 'not_configured';
  }
  return NextResponse.json(data ? {
    enabled: data.enabled,
    bot_username: data.bot_username,
    admin_chat_ids: data.admin_chat_ids || [],
    notify_new_booking: data.notify_new_booking,
    notify_payments: data.notify_payments,
    updated_at: data.updated_at,
    has_bot_token: !!data.bot_token,
    masked_bot_token: data.bot_token ? `${String(data.bot_token).slice(0, 8)}...${String(data.bot_token).slice(-4)}` : null,
    webhook_status: webhookStatus,
  } : {});
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
    if (!s.admin_chat_ids?.length) return NextResponse.json({ error: 'Add at least one admin Chat ID, then Save, before testing.' }, { status: 400 });
    // force=true so the test works even while alerts are still toggled Off.
    const out: any = await sendToAdmins('✅ <b>Test message</b>\nGhumakkars is connected to this chat. You will get booking and payment alerts here.', undefined, true);
    const first = out?.results?.[0];
    if (first && first.ok === false) {
      return NextResponse.json({ error: `Telegram says: ${first.description || 'failed'}. Open your bot and press Start, then check the Chat ID.` }, { status: 400 });
    }
    if (out?.ok === false) {
      return NextResponse.json({ error: out.error === 'Missing bot token or admin chat IDs' ? 'Save the bot token and Chat ID first.' : 'Could not send. Check the token and Chat ID.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'Test message sent — check Telegram.' });
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
    // Register the slash-command menu shown in Telegram's "/" picker.
    await tgCall('setMyCommands', {
      commands: [
        { command: 'menu', description: 'Open the control panel' },
        { command: 'pending', description: 'Payments waiting for approval' },
        { command: 'today', description: "Today's bookings & revenue" },
        { command: 'week', description: "This week's numbers" },
        { command: 'revenue', description: 'Collected vs. still to collect' },
        { command: 'recent', description: 'Last 10 bookings' },
        { command: 'upcoming', description: 'Next departures with seat counts' },
        { command: 'find', description: 'Search bookings by name or phone' },
        { command: 'booking', description: 'Details for a booking ID' },
        { command: 'coupons', description: 'List coupons' },
        { command: 'coupon', description: 'Create a coupon, e.g. /coupon SUMMER10 10%' },
        { command: 'id', description: 'Show your Chat ID' },
      ],
    }, s.bot_token);
    if (!hook?.ok) return NextResponse.json({ error: hook?.description || 'setWebhook failed' }, { status: 400 });
    return NextResponse.json({ success: true, message: 'Webhook connected.', botUsername: me?.result?.username || null });
  }

  // Default: save settings
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) updates.enabled = !!body.enabled;
  if (body.bot_token !== undefined && String(body.bot_token).trim()) updates.bot_token = String(body.bot_token).trim();
  if (body.notify_new_booking !== undefined) updates.notify_new_booking = !!body.notify_new_booking;
  if (body.notify_payments !== undefined) updates.notify_payments = !!body.notify_payments;
  if (body.admin_chat_ids !== undefined) {
    const ids = Array.isArray(body.admin_chat_ids)
      ? body.admin_chat_ids
      : String(body.admin_chat_ids).split(/[\s,]+/);
    const cleanIds = ids.map((x: string) => String(x).trim()).filter(Boolean);
    if (cleanIds.some((x: string) => !/^-?\d+$/.test(x))) {
      return NextResponse.json({ error: 'Telegram chat IDs must be numeric.' }, { status: 400 });
    }
    updates.admin_chat_ids = cleanIds;
  }

  const { data, error } = await admin.from('telegram_settings').update(updates).eq('id', 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    settings: {
      enabled: data.enabled,
      bot_username: data.bot_username,
      admin_chat_ids: data.admin_chat_ids || [],
      notify_new_booking: data.notify_new_booking,
      notify_payments: data.notify_payments,
      updated_at: data.updated_at,
      has_bot_token: !!data.bot_token,
      masked_bot_token: data.bot_token ? `${String(data.bot_token).slice(0, 8)}...${String(data.bot_token).slice(-4)}` : null,
    },
  });
}
