import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { sendWhatsApp, welcomeMessage } from '@/lib/whatsapp';

// Sample messages for the Settings tester — mirror the real booking templates
// (WhatsApp bold uses *single* asterisks). Uses placeholder data.
function sampleMessage(template: string): string {
  const name = 'Traveller';
  const t = 'Manali Kasol Escape';
  const id = 'TEST1234';
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  switch (template) {
    case 'pending':
      return `Hi ${name}! 👋\n\nWe've received your booking for *${t}*.\n🆔 Booking ${id}\n📅 12 Jul 2026 – 15 Jul 2026\n\nOur team is reviewing your payment and will confirm shortly — we'll message you right here. 🙌`;
    case 'seat_locked':
      return `Hi ${name}! 🔒\n\nYour seat for *${t}* is *locked*!\n🆔 Booking ${id}\n📅 12 Jul 2026 – 15 Jul 2026\n💰 Balance due: *₹6,500*\n⏰ Pay before: *7 Jul 2026*\n\nClear the balance to fully confirm your spot.`;
    case 'confirmed':
      return `Hi ${name}! 🎉\n\nYour booking for *${t}* is *CONFIRMED* ✅\n🆔 Booking ${id}\n📅 12 Jul 2026 – 15 Jul 2026\n📍 Pickup: Delhi ISBT\n\nGet ready for an amazing trip! See you soon 🏔️`;
    case 'rejected':
      return `Hi ${name},\n\nUnfortunately we couldn't confirm your booking for *${t}* (${id}).\nReason: Payment could not be verified\n\nReply here and our team will help you sort it out. 🙏`;
    case 'cancelled':
      return `Hi ${name},\n\nYour booking for *${t}* (${id}) has been *cancelled*.\n\nReply here if you have any questions — we're happy to help.`;
    case 'welcome':
      return welcomeMessage(name);
    case 'otp':
      return `Your Ghumakkars verification code is *${otp}*.\nIt's valid for 10 minutes. Please don't share it with anyone.`;
    default:
      return '';
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// WhatsApp runs inside this server process (lib/whatsapp/service.ts).

// Cache the connection state into the DB (shown on other admin screens).
async function cacheState(connected: boolean, number: string | null) {
  try {
    const admin = createAdminClient();
    await admin.from('whatsapp_settings').update({
      connected,
      connected_number: number,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
  } catch { /* best-effort */ }
}

// GET → current status (polled by the admin panel). `?logs=200` adds recent log lines.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { getWhatsAppStatus, getWhatsAppLogs } = await import('@/lib/whatsapp/service');
  const status = await getWhatsAppStatus();
  await cacheState(status.connected, status.number);
  const logsParam = request.nextUrl.searchParams.get('logs');
  return NextResponse.json({
    configured: true,
    online: !status.error,
    ...status,
    ...(logsParam ? { logs: getWhatsAppLogs(Number(logsParam) || 200) } : {}),
  });
}

// POST { action: 'login' | 'test' | 'logout' }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const wa = await import('@/lib/whatsapp/service');

  try {
    if (action === 'login') {
      const forceRelink = body.forceRelink === true;
      let result: any;
      if (body.mode === 'qr') {
        result = await wa.requestQR(forceRelink);
      } else {
        const phone = String(body.phone || '').replace(/\D/g, '');
        if (!phone) return NextResponse.json({ error: 'Enter the WhatsApp number to link.' }, { status: 400 });
        result = await wa.requestPairingCode(phone, forceRelink);
      }
      if (result.alreadyConnected) {
        await cacheState(true, result.number || null);
        return NextResponse.json({ alreadyConnected: true, number: result.number || null });
      }
      return NextResponse.json({ pairingCode: result.pairingCode || null, qr: result.qr || null, message: result.message });
    }

    if (action === 'test') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return NextResponse.json({ error: 'Enter a phone number to send to.' }, { status: 400 });
      const message = body.template === 'custom'
        ? String(body.message || '').trim()
        : sampleMessage(String(body.template || ''));
      if (!message) return NextResponse.json({ error: 'Nothing to send — pick a template or type a message.' }, { status: 400 });
      const res = await sendWhatsApp({ to: phone, body: message });
      if (!res.ok) return NextResponse.json({ error: res.error || 'Send failed.' }, { status: 400 });
      return NextResponse.json({ ok: true, queued: !!res.queued });
    }

    if (action === 'logout') {
      await wa.logoutWhatsApp();
      await cacheState(false, null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'WhatsApp action failed.' }, { status: 400 });
  }
}
