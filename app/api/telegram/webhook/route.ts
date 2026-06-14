import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { internalFetchHeaders } from '@/lib/auth-helpers';
import {
  getTelegramSettings,
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
  esc,
} from '@/lib/telegram';

export const runtime = 'nodejs';

const baseUrl = (req: NextRequest) => process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export async function POST(request: NextRequest) {
  const settings = await getTelegramSettings();
  if (!settings?.enabled || !settings.bot_token) {
    return NextResponse.json({ ok: true }); // silently ignore when off
  }

  // Verify the secret token Telegram echoes back (set during setWebhook).
  if (settings.webhook_secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== settings.webhook_secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const token = settings.bot_token;
  const admins = (settings.admin_chat_ids || []).map((x) => String(x).trim());
  const isAdmin = (id: unknown) => admins.includes(String(id));

  try {
    // ───────────── Inline button taps (approve / reject) ─────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const fromId = cq.from?.id;
      const data: string = cq.data || '';
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      const originalText = cq.message?.text || cq.message?.caption || '';

      if (!isAdmin(fromId)) {
        await answerCallbackQuery(cq.id, 'You are not an authorised admin.', token);
        return NextResponse.json({ ok: true });
      }

      const [action, transactionId] = data.split(':');
      if ((action === 'approve' || action === 'reject') && transactionId) {
        const reviewStatus = action === 'approve' ? 'verified' : 'rejected';
        const res = await fetch(`${baseUrl(request)}/api/admin/bookings/review-payment-transaction`, {
          method: 'POST',
          headers: internalFetchHeaders(),
          body: JSON.stringify({
            transactionId,
            status: reviewStatus,
            reviewedBy: null,
            rejectionReason: action === 'reject' ? 'Rejected by admin on Telegram' : undefined,
          }),
        });
        const result = await res.json();

        if (!res.ok) {
          await answerCallbackQuery(cq.id, result.error || 'Failed', token);
          return NextResponse.json({ ok: true });
        }

        // Email the customer (same as the website flow).
        if (result.bookingId && result.bookingStatus) {
          try {
            await fetch(`${baseUrl(request)}/api/bookings/send-notification`, {
              method: 'POST',
              headers: internalFetchHeaders(),
              body: JSON.stringify({
                bookingId: result.bookingId,
                status: result.bookingStatus,
                rejectionReason: action === 'reject' ? 'Rejected by admin on Telegram' : undefined,
              }),
            });
          } catch { /* email is best-effort */ }
        }

        const who = cq.from?.first_name || cq.from?.username || 'admin';
        const stamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const verdict = action === 'approve'
          ? `\n\n✅ <b>Approved by ${esc(who)}</b> · ${esc(stamp)}\nStatus: <b>${esc(result.bookingStatus)}</b>`
          : `\n\n❌ <b>Rejected by ${esc(who)}</b> · ${esc(stamp)}`;

        if (chatId && messageId) {
          await editTelegramMessage(chatId, messageId, `${originalText}${verdict}`, token);
        }
        await answerCallbackQuery(cq.id, action === 'approve' ? 'Approved ✅' : 'Rejected ❌', token);
      }
      return NextResponse.json({ ok: true });
    }

    // ───────────── Text commands ─────────────
    const msg = update.message;
    if (msg?.text) {
      const chatId = msg.chat.id;
      const text: string = msg.text.trim();
      const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
      const arg = text.split(/\s+/).slice(1).join(' ').trim();

      if (cmd === '/start' || cmd === '/id') {
        const authed = isAdmin(chatId) ? '✅ You are an authorised admin.' : '⚠️ You are not yet an admin. Add this Chat ID in the website Settings → Telegram.';
        await sendTelegramMessage(String(chatId), `👋 <b>Ghumakkars bot</b>\n\nYour Chat ID: <code>${esc(chatId)}</code>\n${authed}`, undefined, token);
        return NextResponse.json({ ok: true });
      }

      if (!isAdmin(chatId)) {
        await sendTelegramMessage(String(chatId), 'Not authorised. Send /start to get your Chat ID, then add it in the website Settings.', undefined, token);
        return NextResponse.json({ ok: true });
      }

      const admin = createAdminClient();

      if (cmd === '/help') {
        await sendTelegramMessage(String(chatId), [
          '<b>Commands</b>',
          '/pending — payments waiting for approval',
          '/stats — today\'s bookings & revenue',
          '/booking &lt;id&gt; — details for a booking (first 8 chars of the ID)',
          '/id — show your Chat ID',
        ].join('\n'), undefined, token);
        return NextResponse.json({ ok: true });
      }

      if (cmd === '/pending') {
        const { data: txns } = await admin
          .from('payment_transactions')
          .select('id, amount, created_at, bookings(id, primary_passenger_name, booking_status, trips(title))')
          .eq('payment_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(15);
        if (!txns || txns.length === 0) {
          await sendTelegramMessage(String(chatId), '✅ Nothing pending. All caught up.', undefined, token);
        } else {
          const lines = txns.map((t: any) => {
            const b = Array.isArray(t.bookings) ? t.bookings[0] : t.bookings;
            const trip = b ? (Array.isArray(b.trips) ? b.trips[0] : b.trips) : null;
            return `• ${inr(parseFloat(t.amount || 0))} — ${esc(b?.primary_passenger_name || 'Customer')} (${esc(trip?.title || 'Trip')}) <code>${esc(String(b?.id || '').slice(0, 8).toUpperCase())}</code>`;
          });
          await sendTelegramMessage(String(chatId), `🟡 <b>${txns.length} payment(s) pending</b>\n\n${lines.join('\n')}`, undefined, token);
        }
        return NextResponse.json({ ok: true });
      }

      if (cmd === '/stats') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const { data: today } = await admin
          .from('bookings')
          .select('booking_status, amount_paid, payment_transactions(amount, payment_status)')
          .gte('created_at', start.toISOString());
        const list = today || [];
        const confirmed = list.filter((b: any) => b.booking_status === 'confirmed').length;
        const seat = list.filter((b: any) => b.booking_status === 'seat_locked').length;
        const collected = list.reduce((s: number, b: any) => {
          if (['cancelled', 'rejected'].includes(b.booking_status)) return s;
          const t = (b.payment_transactions || []).filter((p: any) => p.payment_status === 'verified').reduce((x: number, p: any) => x + parseFloat(p.amount || 0), 0);
          return s + (t || parseFloat(b.amount_paid || 0));
        }, 0);
        await sendTelegramMessage(String(chatId), [
          `📊 <b>Today</b>`,
          `Bookings: <b>${list.length}</b> (${confirmed} confirmed · ${seat} seat-locked)`,
          `Collected: <b>${inr(collected)}</b>`,
        ].join('\n'), undefined, token);
        return NextResponse.json({ ok: true });
      }

      if (cmd === '/booking') {
        if (!arg) {
          await sendTelegramMessage(String(chatId), 'Usage: /booking &lt;id&gt; (first 8 characters of the booking ID)', undefined, token);
          return NextResponse.json({ ok: true });
        }
        const { data: matches } = await admin
          .from('bookings')
          .select('id, primary_passenger_name, primary_passenger_phone, number_of_participants, booking_status, amount_paid, final_amount, departure_date, trips(title, destination)')
          .ilike('id', `${arg.toLowerCase()}%`)
          .limit(1);
        const b: any = matches?.[0];
        if (!b) {
          await sendTelegramMessage(String(chatId), 'No booking found for that ID.', undefined, token);
          return NextResponse.json({ ok: true });
        }
        const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
        await sendTelegramMessage(String(chatId), [
          `🧳 <b>${esc(trip?.title || 'Trip')}</b>`,
          `👤 ${esc(b.primary_passenger_name || '—')} · ${esc(b.primary_passenger_phone || '—')}`,
          `👥 ${esc(b.number_of_participants || 1)} pax`,
          b.departure_date ? `📅 ${esc(b.departure_date)}` : '',
          `📦 Status: <b>${esc(b.booking_status)}</b>`,
          `🆔 <code>${esc(String(b.id).slice(0, 8).toUpperCase())}</code>`,
        ].filter(Boolean).join('\n'), undefined, token);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (e) {
    console.error('Telegram webhook error:', e);
  }

  return NextResponse.json({ ok: true });
}
