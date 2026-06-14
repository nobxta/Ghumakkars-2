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
const shortId = (id: string) => String(id || '').slice(0, 8).toUpperCase();

type AdminClient = ReturnType<typeof createAdminClient>;

// ───────────────────────── money + date helpers ─────────────────────────
function effDate(b: any, trip: any): string | null {
  return (trip?.is_recurring && b.departure_date) ? b.departure_date : (trip?.start_date || null);
}
function paidOf(b: any): number {
  if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
  return (b.payment_transactions || []).filter((t: any) => t.payment_status === 'verified').reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
}
function fullOf(b: any, trip: any): number {
  const pax = Number(b.number_of_participants) || 1;
  const coupon = parseFloat(String(b.coupon_discount || 0)) || 0;
  const wallet = parseFloat(String(b.wallet_amount_used || 0)) || 0;
  if (b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked') {
    return Math.max(0, (Number(trip?.discounted_price) || 0) * pax - coupon - wallet);
  }
  const fa = parseFloat(String(b.final_amount || 0));
  if (fa > 0) return fa;
  return Math.max(0, (parseFloat(String(b.total_price || 0)) || (Number(trip?.discounted_price) || 0) * pax) - coupon - wallet);
}
const tripOf = (b: any) => Array.isArray(b.trips) ? b.trips[0] : b.trips;

// ───────────────────────── menu ─────────────────────────
function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🟡 Pending', callback_data: 'menu:pending' }, { text: '📊 Today', callback_data: 'menu:today' }],
      [{ text: '🗓 This week', callback_data: 'menu:week' }, { text: '💰 Revenue', callback_data: 'menu:revenue' }],
      [{ text: '🧾 Recent', callback_data: 'menu:recent' }, { text: '🚌 Upcoming', callback_data: 'menu:upcoming' }],
      [{ text: '🏷 Coupons', callback_data: 'menu:coupons' }, { text: '❓ Help', callback_data: 'menu:help' }],
      [{ text: '🔄 Refresh', callback_data: 'menu:menu' }],
    ],
  };
}
const backKeyboard = { inline_keyboard: [[{ text: '⬅️ Menu', callback_data: 'menu:menu' }]] };

const menuText = '🏔 <b>Ghumakkars control panel</b>\nPick what you want to see:';
const helpText = [
  '<b>Buttons</b> — tap the menu below for quick access.',
  '',
  '<b>Commands</b>',
  '/menu — open the control panel',
  '/pending — payments waiting for approval',
  '/today — today\'s bookings & revenue',
  '/week — this week\'s numbers',
  '/revenue — money collected vs. still to collect',
  '/recent — last 10 bookings',
  '/upcoming — next departures with seat counts',
  '/find &lt;name/phone&gt; — search bookings',
  '/booking &lt;id&gt; — one booking\'s details',
  '/coupons — list coupons',
  '/coupon &lt;CODE&gt; &lt;VALUE&gt; — create a coupon (e.g. /coupon SUMMER10 10%)',
  '/id — show your Chat ID',
].join('\n');

// ───────────────────────── report builders ─────────────────────────
async function reportPending(admin: AdminClient): Promise<string> {
  const { data: txns } = await admin
    .from('payment_transactions')
    .select('id, amount, created_at, bookings(id, primary_passenger_name, booking_status, trips(title))')
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);
  if (!txns || txns.length === 0) return '✅ <b>Nothing pending</b>\nAll payments are reviewed.';
  const lines = txns.map((t: any) => {
    const b = Array.isArray(t.bookings) ? t.bookings[0] : t.bookings;
    const trip = b ? tripOf(b) : null;
    return `• <b>${inr(parseFloat(t.amount || 0))}</b> — ${esc(b?.primary_passenger_name || 'Customer')}\n  ${esc(trip?.title || 'Trip')} · <code>${esc(shortId(b?.id))}</code>`;
  });
  return `🟡 <b>${txns.length} payment(s) pending</b>\n\n${lines.join('\n')}\n\nUse /booking &lt;id&gt; for details, or open the website to approve.`;
}

async function reportStats(admin: AdminClient, range: 'today' | 'week'): Promise<string> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - 6);
  const { data } = await admin
    .from('bookings')
    .select('booking_status, amount_paid, number_of_participants, is_offline_booking, user_id, payment_transactions(amount, payment_status)')
    .gte('created_at', start.toISOString());
  const list = data || [];
  const active = list.filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status));
  const confirmed = list.filter((b: any) => b.booking_status === 'confirmed').length;
  const seat = list.filter((b: any) => b.booking_status === 'seat_locked').length;
  const pending = list.filter((b: any) => b.booking_status === 'pending').length;
  const pax = active.filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status)).reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);
  const collected = active.reduce((s: number, b: any) => s + paidOf(b), 0);
  return [
    `📊 <b>${range === 'today' ? 'Today' : 'This week'}</b>`,
    ``,
    `🧾 Bookings: <b>${list.length}</b>`,
    `   ${confirmed} confirmed · ${seat} seat-locked · ${pending} pending`,
    `👥 Travellers: <b>${pax}</b>`,
    `💰 Collected: <b>${inr(collected)}</b>`,
  ].join('\n');
}

async function reportRevenue(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('bookings')
    .select('booking_status, amount_paid, number_of_participants, is_offline_booking, user_id, total_price, final_amount, coupon_discount, wallet_amount_used, payment_method, created_at, trips(discounted_price), payment_transactions(amount, payment_status)')
    .not('booking_status', 'in', '(cancelled,rejected)')
    .limit(1000);
  const list = data || [];
  let collected = 0, outstanding = 0;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  let todayCollected = 0;
  for (const b of list) {
    const trip = tripOf(b);
    const paid = paidOf(b);
    collected += paid;
    outstanding += Math.max(0, fullOf(b, trip) - paid);
    if (new Date(b.created_at) >= todayStart) todayCollected += paid;
  }
  return [
    `💰 <b>Revenue</b>`,
    ``,
    `✅ Collected: <b>${inr(collected)}</b>`,
    `⏳ Still to collect: <b>${inr(outstanding)}</b>`,
    `📅 Collected today: <b>${inr(todayCollected)}</b>`,
    ``,
    `<i>Across ${list.length} active bookings.</i>`,
  ].join('\n');
}

async function reportRecent(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('bookings')
    .select('id, primary_passenger_name, booking_status, number_of_participants, created_at, trips(title)')
    .order('created_at', { ascending: false })
    .limit(10);
  const list = data || [];
  if (list.length === 0) return 'No bookings yet.';
  const lines = list.map((b: any) => {
    const trip = tripOf(b);
    const when = new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return `• ${esc(b.primary_passenger_name || 'Customer')} · ${esc(b.number_of_participants || 1)}p · ${esc(b.booking_status)}\n  ${esc(trip?.title || 'Trip')} · ${esc(when)} · <code>${esc(shortId(b.id))}</code>`;
  });
  return `🧾 <b>Recent bookings</b>\n\n${lines.join('\n')}`;
}

async function reportUpcoming(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('bookings')
    .select('number_of_participants, booking_status, departure_date, trips(title, start_date, is_recurring)')
    .in('booking_status', ['confirmed', 'seat_locked'])
    .limit(1000);
  const list = data || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const groups = new Map<string, { title: string; date: string; pax: number }>();
  for (const b of list) {
    const trip = tripOf(b);
    const d = effDate(b, trip);
    if (!d || new Date(d) < today) continue;
    const key = `${trip?.title || 'Trip'}__${d}`;
    const g = groups.get(key) || { title: trip?.title || 'Trip', date: d, pax: 0 };
    g.pax += Number(b.number_of_participants) || 1;
    groups.set(key, g);
  }
  const arr = Array.from(groups.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);
  if (arr.length === 0) return '🚌 <b>Upcoming</b>\nNo upcoming departures with bookings.';
  const lines = arr.map((g) => `• ${esc(new Date(g.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }))} — <b>${g.pax}</b> pax\n  ${esc(g.title)}`);
  return `🚌 <b>Upcoming departures</b>\n\n${lines.join('\n')}`;
}

async function reportFind(admin: AdminClient, q: string): Promise<string> {
  const term = q.trim();
  if (!term) return 'Usage: /find &lt;name or phone&gt;';
  const { data } = await admin
    .from('bookings')
    .select('id, primary_passenger_name, primary_passenger_phone, booking_status, number_of_participants, trips(title)')
    .or(`primary_passenger_name.ilike.%${term}%,primary_passenger_phone.ilike.%${term}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  const list = data || [];
  if (list.length === 0) return `No bookings match “${esc(term)}”.`;
  const lines = list.map((b: any) => {
    const trip = tripOf(b);
    return `• ${esc(b.primary_passenger_name || '—')} · ${esc(b.primary_passenger_phone || '—')}\n  ${esc(trip?.title || 'Trip')} · ${esc(b.booking_status)} · <code>${esc(shortId(b.id))}</code>`;
  });
  return `🔎 <b>${list.length} match(es) for “${esc(term)}”</b>\n\n${lines.join('\n')}`;
}

async function reportBooking(admin: AdminClient, arg: string): Promise<string> {
  if (!arg) return 'Usage: /booking &lt;id&gt; (first 8 characters of the booking ID)';
  const { data: matches } = await admin
    .from('bookings')
    .select('id, primary_passenger_name, primary_passenger_phone, number_of_participants, booking_status, amount_paid, final_amount, total_price, coupon_discount, wallet_amount_used, payment_method, departure_date, pickup_point, is_offline_booking, user_id, trips(title, destination, start_date, discounted_price, is_recurring), payment_transactions(amount, payment_status)')
    .ilike('id', `${arg.toLowerCase()}%`)
    .limit(1);
  const b: any = matches?.[0];
  if (!b) return 'No booking found for that ID.';
  const trip = tripOf(b);
  const paid = paidOf(b);
  const full = fullOf(b, trip);
  const dep = effDate(b, trip);
  return [
    `🧳 <b>${esc(trip?.title || 'Trip')}</b>${trip?.destination ? ` — ${esc(trip.destination)}` : ''}`,
    `👤 ${esc(b.primary_passenger_name || '—')} · ${esc(b.primary_passenger_phone || '—')}`,
    `👥 ${esc(b.number_of_participants || 1)} pax`,
    dep ? `📅 ${esc(dep)}` : '',
    b.pickup_point ? `📍 ${esc(b.pickup_point)}` : '',
    `💰 Cost ${inr(full)} · Paid ${inr(paid)}${full - paid > 0 ? ` · Due ${inr(full - paid)}` : ''}`,
    `📦 Status: <b>${esc(b.booking_status)}</b>`,
    `🆔 <code>${esc(shortId(b.id))}</code>`,
  ].filter(Boolean).join('\n');
}

async function listCoupons(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('coupon_codes')
    .select('code, discount_type, discount_value, max_discount, usage_limit, is_active, expiry_date')
    .order('created_at', { ascending: false })
    .limit(20);
  const list = data || [];
  const hint = '\n\n<b>Create one:</b>\n<code>/coupon SUMMER10 10%</code>\n<code>/coupon FLAT500 500</code>\nOptions: <code>max=1000 limit=50 days=30</code>';
  if (list.length === 0) return `🏷 <b>No coupons yet</b>${hint}`;
  const lines = list.map((c: any) => {
    const off = c.discount_type === 'percentage' ? `${c.discount_value}% off${c.max_discount ? ` (max ₹${c.max_discount})` : ''}` : `₹${c.discount_value} off`;
    return `${c.is_active ? '🟢' : '⚪️'} <b>${esc(c.code)}</b> — ${esc(off)}${c.usage_limit ? ` · limit ${c.usage_limit}` : ''}${c.expiry_date ? ` · till ${esc(c.expiry_date)}` : ''}`;
  });
  return `🏷 <b>Coupons</b>\n\n${lines.join('\n')}${hint}`;
}

async function createCoupon(admin: AdminClient, argStr: string): Promise<string> {
  const usage = '🏷 <b>Create a coupon</b>\n\n<code>/coupon CODE VALUE [options]</code>\n\nExamples:\n<code>/coupon SUMMER10 10%</code> — 10% off\n<code>/coupon FLAT500 500</code> — ₹500 off\n<code>/coupon BIG20 20% max=1500 limit=100 days=30</code>\n\nOptions: <code>max=</code> cap (₹), <code>limit=</code> total uses, <code>days=</code> expires in N days.';
  const parts = argStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return usage;

  const code = parts[0].toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const rawVal = parts[1];
  const isPct = rawVal.endsWith('%');
  const value = parseFloat(rawVal.replace('%', ''));
  if (!code || Number.isNaN(value) || value <= 0) return `❌ Invalid value.\n\n${usage}`;
  if (isPct && value > 100) return '❌ A percentage coupon can\'t be more than 100%.';

  const opts: Record<string, string> = {};
  parts.slice(2).forEach((p) => { const [k, v] = p.split('='); if (k && v) opts[k.toLowerCase()] = v; });
  const max = opts.max ? parseFloat(opts.max) : null;
  const limit = opts.limit ? parseInt(opts.limit, 10) : null;
  const days = opts.days ? parseInt(opts.days, 10) : null;
  const expiry = days && days > 0 ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : null;

  const { data: existing } = await admin.from('coupon_codes').select('id').ilike('code', code).limit(1);
  if (existing && existing.length) return `⚠️ Coupon <b>${esc(code)}</b> already exists. Pick a different code.`;

  const { error } = await admin.from('coupon_codes').insert([{
    code,
    discount_type: isPct ? 'percentage' : 'fixed',
    discount_value: value,
    max_discount: max,
    usage_limit: limit,
    expiry_date: expiry,
    min_amount: 0,
    is_active: true,
  }]);
  if (error) return `❌ Could not create: ${esc(error.message)}`;

  return [
    `✅ <b>Coupon created</b>`,
    ``,
    `🏷 Code: <b>${esc(code)}</b>`,
    `💸 ${isPct ? `${value}% off` : `₹${value} off`}${max ? ` (max ₹${max})` : ''}`,
    limit ? `🔢 Usage limit: ${limit}` : '',
    expiry ? `📅 Expires: ${expiry}` : '',
    `\n<i>It's active now and ready to use.</i>`,
  ].filter(Boolean).join('\n');
}

// ───────────────────────── webhook ─────────────────────────
export async function POST(request: NextRequest) {
  const settings = await getTelegramSettings();
  if (!settings?.enabled || !settings.bot_token) return NextResponse.json({ ok: true });

  if (settings.webhook_secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== settings.webhook_secret) return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: any;
  try { update = await request.json(); } catch { return NextResponse.json({ ok: true }); }

  const token = settings.bot_token;
  const admins = (settings.admin_chat_ids || []).map((x) => String(x).trim());
  const isAdmin = (id: unknown) => admins.includes(String(id));
  const admin = createAdminClient();

  // Route a "report key" to its text + keyboard.
  const runReport = async (key: string): Promise<{ text: string; kb: unknown }> => {
    switch (key) {
      case 'pending': return { text: await reportPending(admin), kb: backKeyboard };
      case 'today': return { text: await reportStats(admin, 'today'), kb: backKeyboard };
      case 'week': return { text: await reportStats(admin, 'week'), kb: backKeyboard };
      case 'revenue': return { text: await reportRevenue(admin), kb: backKeyboard };
      case 'recent': return { text: await reportRecent(admin), kb: backKeyboard };
      case 'upcoming': return { text: await reportUpcoming(admin), kb: backKeyboard };
      case 'coupons': return { text: await listCoupons(admin), kb: backKeyboard };
      case 'help': return { text: helpText, kb: backKeyboard };
      default: return { text: menuText, kb: mainMenuKeyboard() };
    }
  };

  try {
    // ── Inline buttons ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const fromId = cq.from?.id;
      const data: string = cq.data || '';
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;

      if (!isAdmin(fromId)) {
        await answerCallbackQuery(cq.id, 'You are not an authorised admin.', token);
        return NextResponse.json({ ok: true });
      }

      // Menu navigation: edit the message in place.
      if (data.startsWith('menu:')) {
        const { text, kb } = await runReport(data.slice('menu:'.length));
        if (chatId && messageId) await editTelegramMessage(chatId, messageId, text, token, kb);
        await answerCallbackQuery(cq.id, undefined, token);
        return NextResponse.json({ ok: true });
      }

      // Approve / reject a payment.
      const [action, transactionId] = data.split(':');
      if ((action === 'approve' || action === 'reject') && transactionId) {
        const originalText = cq.message?.text || cq.message?.caption || '';
        const reviewStatus = action === 'approve' ? 'verified' : 'rejected';
        const res = await fetch(`${baseUrl(request)}/api/admin/bookings/review-payment-transaction`, {
          method: 'POST',
          headers: internalFetchHeaders(),
          body: JSON.stringify({ transactionId, status: reviewStatus, reviewedBy: null, rejectionReason: action === 'reject' ? 'Rejected by admin on Telegram' : undefined }),
        });
        const result = await res.json();
        if (!res.ok) { await answerCallbackQuery(cq.id, result.error || 'Failed', token); return NextResponse.json({ ok: true }); }

        if (result.bookingId && result.bookingStatus) {
          try {
            await fetch(`${baseUrl(request)}/api/bookings/send-notification`, {
              method: 'POST',
              headers: internalFetchHeaders(),
              body: JSON.stringify({ bookingId: result.bookingId, status: result.bookingStatus, rejectionReason: action === 'reject' ? 'Rejected by admin on Telegram' : undefined }),
            });
          } catch { /* best effort */ }
        }

        const who = cq.from?.first_name || cq.from?.username || 'admin';
        const stamp = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const verdict = action === 'approve'
          ? `\n\n✅ <b>Approved by ${esc(who)}</b> · ${esc(stamp)}\nStatus: <b>${esc(result.bookingStatus)}</b>`
          : `\n\n❌ <b>Rejected by ${esc(who)}</b> · ${esc(stamp)}`;
        if (chatId && messageId) await editTelegramMessage(chatId, messageId, `${originalText}${verdict}`, token);
        await answerCallbackQuery(cq.id, action === 'approve' ? 'Approved ✅' : 'Rejected ❌', token);
      }
      return NextResponse.json({ ok: true });
    }

    // ── Text commands ──
    const msg = update.message;
    if (msg?.text) {
      const chatId = msg.chat.id;
      const text: string = msg.text.trim();
      const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
      const arg = text.split(/\s+/).slice(1).join(' ').trim();

      if (cmd === '/start' || cmd === '/id') {
        const authed = isAdmin(chatId) ? '✅ You are an authorised admin.' : '⚠️ Not an admin yet. Add this Chat ID in the website Settings → Telegram.';
        await sendTelegramMessage(String(chatId), `👋 <b>Ghumakkars bot</b>\n\nYour Chat ID: <code>${esc(chatId)}</code>\n${authed}`, isAdmin(chatId) ? mainMenuKeyboard() : undefined, token);
        return NextResponse.json({ ok: true });
      }

      if (!isAdmin(chatId)) {
        await sendTelegramMessage(String(chatId), 'Not authorised. Send /start to get your Chat ID, then add it in the website Settings.', undefined, token);
        return NextResponse.json({ ok: true });
      }

      if (cmd === '/menu') { await sendTelegramMessage(String(chatId), menuText, mainMenuKeyboard(), token); return NextResponse.json({ ok: true }); }
      if (cmd === '/help') { await sendTelegramMessage(String(chatId), helpText, backKeyboard, token); return NextResponse.json({ ok: true }); }

      const map: Record<string, string> = { '/pending': 'pending', '/today': 'today', '/stats': 'today', '/week': 'week', '/revenue': 'revenue', '/recent': 'recent', '/upcoming': 'upcoming' };
      if (map[cmd]) {
        const { text: out, kb } = await runReport(map[cmd]);
        await sendTelegramMessage(String(chatId), out, kb, token);
        return NextResponse.json({ ok: true });
      }
      if (cmd === '/find' || cmd === '/search') { await sendTelegramMessage(String(chatId), await reportFind(admin, arg), backKeyboard, token); return NextResponse.json({ ok: true }); }
      if (cmd === '/booking') { await sendTelegramMessage(String(chatId), await reportBooking(admin, arg), backKeyboard, token); return NextResponse.json({ ok: true }); }
      if (cmd === '/coupons') { await sendTelegramMessage(String(chatId), await listCoupons(admin), backKeyboard, token); return NextResponse.json({ ok: true }); }
      if (cmd === '/coupon' || cmd === '/newcoupon') { await sendTelegramMessage(String(chatId), await createCoupon(admin, arg), backKeyboard, token); return NextResponse.json({ ok: true }); }

      // Unknown command → show the menu.
      await sendTelegramMessage(String(chatId), menuText, mainMenuKeyboard(), token);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error('Telegram webhook error:', e);
  }

  return NextResponse.json({ ok: true });
}
