import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Telegram bot integration.
 *
 * Settings (bot token, admin chat IDs, webhook secret) live in the
 * `telegram_settings` table and are managed from the admin Settings page.
 * Everything here runs server-side only (the token must never reach the client).
 */

export interface TelegramSettings {
  enabled: boolean;
  bot_token: string | null;
  bot_username: string | null;
  admin_chat_ids: string[];
  webhook_secret: string | null;
  notify_new_booking: boolean;
  notify_payments: boolean;
}

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('telegram_settings').select('*').eq('id', 1).single();
    return (data as TelegramSettings) || null;
  } catch {
    return null;
  }
}

const API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

export async function tgCall(method: string, body: Record<string, unknown>, tokenOverride?: string) {
  let token = tokenOverride;
  if (!token) {
    const s = await getTelegramSettings();
    token = s?.bot_token || undefined;
  }
  if (!token) return { ok: false, error: 'No bot token configured' };
  try {
    const res = await fetch(API(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Telegram request failed' };
  }
}

export async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: unknown, tokenOverride?: string) {
  return tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }, tokenOverride);
}

export async function editTelegramMessage(chatId: string | number, messageId: number, text: string, tokenOverride?: string) {
  return tgCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }, tokenOverride);
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string, tokenOverride?: string) {
  return tgCall('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) }, tokenOverride);
}

/** Send a message to every configured admin chat. */
export async function sendToAdmins(text: string, replyMarkup?: unknown) {
  const s = await getTelegramSettings();
  if (!s?.enabled || !s.bot_token || !s.admin_chat_ids?.length) return;
  await Promise.all(
    s.admin_chat_ids.map((id) => sendTelegramMessage(String(id).trim(), text, replyMarkup, s.bot_token!))
  );
}

// ─────────────────────────── formatting helpers ───────────────────────────

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Discount-aware money for a booking (matches the rest of the app). */
function bookingMoney(b: any, trip: any) {
  const pax = Number(b.number_of_participants) || 1;
  const coupon = parseFloat(String(b.coupon_discount || 0)) || 0;
  const wallet = parseFloat(String(b.wallet_amount_used || 0)) || 0;
  const isSeatLock = b.payment_method === 'seat_lock' || ['seat_locked', 'remaining_submitted'].includes(b.booking_status);
  const full = isSeatLock
    ? Math.max(0, (Number(trip?.discounted_price) || 0) * pax - coupon - wallet)
    : (parseFloat(String(b.final_amount || 0)) > 0
        ? parseFloat(String(b.final_amount))
        : Math.max(0, (parseFloat(String(b.total_price || 0)) || (Number(trip?.discounted_price) || 0) * pax) - coupon - wallet));
  const paid = (b.is_offline_booking || !b.user_id)
    ? parseFloat(String(b.amount_paid || 0))
    : (b.payment_transactions || []).filter((t: any) => t.payment_status === 'verified').reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
  return { pax, coupon, wallet, full, paid, due: Math.max(0, full - paid) };
}

function passengerLines(b: any): string {
  const list = Array.isArray(b.passengers) ? b.passengers : [];
  const primaryName = String(b.primary_passenger_name || '').trim().toLowerCase();
  const out: string[] = [];
  const lead = b.primary_passenger_name || '—';
  out.push(`• ${esc(lead)}${b.primary_passenger_age ? `, ${esc(b.primary_passenger_age)}` : ''}${b.primary_passenger_gender ? `, ${esc(String(b.primary_passenger_gender)[0].toUpperCase())}` : ''} (lead)`);
  list.forEach((p: any) => {
    if (!p?.name) return;
    if (String(p.name).trim().toLowerCase() === primaryName) return;
    out.push(`• ${esc(p.name)}${p.age ? `, ${esc(p.age)}` : ''}${p.gender ? `, ${esc(String(p.gender)[0].toUpperCase())}` : ''}`);
  });
  return out.join('\n');
}

/** Load a booking with trip + transactions for messaging. */
async function loadBooking(bookingId: string) {
  const admin = createAdminClient();
  const { data: b } = await admin
    .from('bookings')
    .select('*, trips(title, destination, discounted_price, start_date, end_date, is_recurring, duration_days), payment_transactions(id, amount, payment_status, payment_mode, created_at)')
    .eq('id', bookingId)
    .single();
  if (!b) return null;
  let profile: any = null;
  if (b.user_id) {
    const { data: p } = await admin.from('profiles').select('first_name, last_name, email, phone').eq('id', b.user_id).single();
    profile = p;
  }
  return { booking: b, trip: Array.isArray(b.trips) ? b.trips[0] : b.trips, profile };
}

function customerLine(b: any, profile: any) {
  const name = b.primary_passenger_name || (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : profile?.email) || 'Customer';
  const phone = b.primary_passenger_phone || b.contact_phone || profile?.phone || '—';
  const email = b.primary_passenger_email || profile?.email || '—';
  return { name, phone, email };
}

function methodLabel(b: any): string {
  if (b.is_offline_booking) return 'Offline';
  if (b.payment_mode === 'razorpay') return 'Razorpay';
  if (b.payment_mode === 'cash') return 'Cash';
  if (b.payment_method === 'seat_lock') return 'Seat lock (UPI)';
  return 'Manual / UPI';
}

function commonBlock(b: any, trip: any, profile: any): string {
  const m = bookingMoney(b, trip);
  const c = customerLine(b, profile);
  const dep = trip?.is_recurring && b.departure_date ? b.departure_date : trip?.start_date;
  return [
    `🧳 <b>${esc(trip?.title || 'Trip')}</b>${trip?.destination ? ` — ${esc(trip.destination)}` : ''}`,
    dep ? `📅 Departs: ${esc(dep)}` : '',
    b.pickup_point ? `📍 Pickup: ${esc(b.pickup_point)}` : '',
    ``,
    `👤 <b>${esc(c.name)}</b>`,
    `📞 ${esc(c.phone)}   ✉️ ${esc(c.email)}`,
    ``,
    `👥 Passengers (${m.pax}):`,
    passengerLines(b),
    ``,
    `💳 Method: ${esc(methodLabel(b))}`,
    `💰 Trip cost: <b>${inr(m.full)}</b>   Paid: <b>${inr(m.paid)}</b>${m.due > 0 ? `   Due: <b>${inr(m.due)}</b>` : ''}`,
    b.coupon_code ? `🏷️ Coupon: ${esc(b.coupon_code)}` : '',
    `🆔 <code>${esc(String(b.id).slice(0, 8).toUpperCase())}</code>`,
  ].filter(Boolean).join('\n');
}

/**
 * Notify admins that a payment is waiting for approval. If the booking has a
 * pending transaction, the message carries inline Approve / Reject buttons.
 */
export async function notifyPaymentForApproval(bookingId: string) {
  const s = await getTelegramSettings();
  if (!s?.enabled || !s.notify_payments) return;
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { booking, trip, profile } = loaded;

  const pending = (booking.payment_transactions || [])
    .filter((t: any) => t.payment_status === 'pending')
    .sort((a: any, c: any) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const isRemaining = booking.booking_status === 'remaining_submitted';
  const header = pending
    ? (isRemaining ? '💵 <b>REMAINING PAYMENT — needs approval</b>' : '🟡 <b>PAYMENT — needs approval</b>')
    : '🆕 <b>NEW BOOKING</b>';

  const text = `${header}\n\n${commonBlock(booking, trip, profile)}`;

  const replyMarkup = pending
    ? {
        inline_keyboard: [[
          { text: '✅ Approve', callback_data: `approve:${pending.id}` },
          { text: '❌ Reject', callback_data: `reject:${pending.id}` },
        ]],
      }
    : undefined;

  await sendToAdmins(text, replyMarkup);
}

/** Plain info notification (no action needed), e.g. Razorpay auto-confirm. */
export async function notifyBookingInfo(bookingId: string, kind: 'razorpay_confirmed' | 'confirmed' | 'rejected' | 'cancelled') {
  const s = await getTelegramSettings();
  if (!s?.enabled) return;
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { booking, trip, profile } = loaded;
  const head = kind === 'razorpay_confirmed' ? '🟢 <b>RAZORPAY PAYMENT — auto-confirmed</b>'
    : kind === 'confirmed' ? '🟢 <b>BOOKING CONFIRMED</b>'
    : kind === 'rejected' ? '🔴 <b>BOOKING REJECTED</b>'
    : '⚫ <b>BOOKING CANCELLED</b>';
  await sendToAdmins(`${head}\n\n${commonBlock(booking, trip, profile)}`);
}
