import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { sendWhatsApp } from '@/lib/whatsapp';

// Sample messages for the Settings tester — mirror the real booking templates
// (WhatsApp bold uses *single* asterisks). Uses placeholder data.
function sampleMessage(template: string): string {
  const name = 'Vivek';
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
    case 'otp':
      return `Your Ghumakkars verification code is *${otp}*.\nIt's valid for 10 minutes. Please don't share it with anyone.`;
    default:
      return '';
  }
}

export const runtime = 'nodejs';

// Talks to the self-hosted Baileys worker (VPS) so the browser never sees the
// secret. The website only needs WHATSAPP_API_URL + VPS_API_SECRET.
const API_URL = process.env.WHATSAPP_API_URL;
const API_SECRET = process.env.VPS_API_SECRET || process.env.WHATSAPP_API_SECRET;

function workerHeaders() {
  return { 'Content-Type': 'application/json', 'x-api-key': API_SECRET as string };
}

async function callWorker(path: string, init?: RequestInit) {
  const base = (API_URL || '').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...workerHeaders(), ...(init?.headers || {}) }, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data } as { status: number; data: any };
}

// Cache the worker's connection state into the DB so the panel can show the
// linked number even when the VPS is briefly unreachable.
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

// GET → current status (polled by the admin panel).
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!API_URL || !API_SECRET) {
    return NextResponse.json({ configured: false, connected: false, number: null, error: 'Set WHATSAPP_API_URL and VPS_API_SECRET on the website.' });
  }
  try {
    const { data } = await callWorker('/status', { method: 'GET' });
    const connected = !!data?.connected;
    const number = data?.number || null;
    await cacheState(connected, number);
    return NextResponse.json({ configured: true, connected, number, qr: data?.qr || null });
  } catch {
    // VPS unreachable — fall back to the last cached value.
    const admin = createAdminClient();
    const { data } = await admin.from('whatsapp_settings').select('connected, connected_number').eq('id', 1).single();
    return NextResponse.json({ configured: true, online: false, connected: !!data?.connected, number: data?.connected_number || null, error: 'Worker unreachable — showing last known state.' });
  }
}

// POST { action: 'login' | 'logout' }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (!API_URL || !API_SECRET) {
    return NextResponse.json({ error: 'Set WHATSAPP_API_URL and VPS_API_SECRET on the website first.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === 'login') {
      const mode = body.mode === 'qr' ? 'qr' : 'pairing';
      let payload: Record<string, unknown> = { mode };
      if (mode === 'pairing') {
        const phone = String(body.phone || '').replace(/\D/g, '');
        if (!phone) return NextResponse.json({ error: 'Enter the WhatsApp number to link.' }, { status: 400 });
        payload = { phone };
      }
      const { status, data } = await callWorker('/login', { method: 'POST', body: JSON.stringify(payload) });
      if (status !== 200 || !data?.ok) return NextResponse.json({ error: data?.error || 'Could not start linking.' }, { status: 400 });
      if (data.alreadyConnected) {
        await cacheState(true, data.number || null);
        return NextResponse.json({ alreadyConnected: true, number: data.number || null });
      }
      return NextResponse.json({ pairingCode: data.pairingCode || null, qr: data.qr || null });
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
      return NextResponse.json({ ok: true });
    }

    if (action === 'logout') {
      const { status, data } = await callWorker('/logout', { method: 'POST' });
      if (status !== 200 || !data?.ok) return NextResponse.json({ error: data?.error || 'Logout failed.' }, { status: 400 });
      await cacheState(false, null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Could not reach the WhatsApp worker. Is the VPS up?' }, { status: 502 });
  }
}
