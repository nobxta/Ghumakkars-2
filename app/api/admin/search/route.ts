import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PER_GROUP = 5;
const one = (v: any) => (Array.isArray(v) ? v[0] : v) || null;

/**
 * Build the [low, high] UUID bounds for a hex prefix ("A1B2C3D4" → every booking
 * whose id starts with a1b2c3d4). Lets admins paste the short booking ID shown in
 * WhatsApp/emails. Returns null when the query isn't a 6–32 char hex prefix.
 */
function uuidPrefixRange(q: string): [string, string] | null {
  const hex = q.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{6,32}$/.test(hex)) return null;
  const fmt = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  return [fmt(hex.padEnd(32, '0')), fmt(hex.padEnd(32, 'f'))];
}

/** GET /api/admin/search?q= → { bookings, users, trips, payments } (max 5 each). */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  // Strip characters that break PostgREST's or() filter syntax.
  const q = (request.nextUrl.searchParams.get('q') || '').replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ bookings: [], users: [], trips: [], payments: [] });

  const admin = createAdminClient();
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, '');
  const phoneTail = digits.length >= 4 ? digits.slice(-10) : null;
  const idRange = uuidPrefixRange(q);

  // Bookings: by passenger name/email/phone, or by (short) booking ID.
  const bookingSelect = 'id, booking_status, number_of_participants, departure_date, primary_passenger_name, primary_passenger_phone, created_at, trips(title, start_date)';
  const bookingParts = [`primary_passenger_name.ilike.${like}`, `primary_passenger_email.ilike.${like}`];
  if (phoneTail) bookingParts.push(`primary_passenger_phone.ilike.%${phoneTail}%`);

  const userParts = [`full_name.ilike.${like}`, `first_name.ilike.${like}`, `last_name.ilike.${like}`, `email.ilike.${like}`];
  if (phoneTail) userParts.push(`phone.ilike.%${phoneTail}%`);

  const [byText, byId, usersRes, tripsRes, paymentsRes] = await Promise.all([
    admin.from('bookings').select(bookingSelect).or(bookingParts.join(',')).order('created_at', { ascending: false }).limit(PER_GROUP),
    idRange
      ? admin.from('bookings').select(bookingSelect).gte('id', idRange[0]).lte('id', idRange[1]).limit(PER_GROUP)
      : Promise.resolve({ data: [] as any[] }),
    admin.from('profiles').select('id, full_name, first_name, last_name, email, phone').or(userParts.join(',')).order('created_at', { ascending: false }).limit(PER_GROUP),
    admin.from('trips').select('id, title, destination, start_date, is_recurring, is_active, status').or(`title.ilike.${like},destination.ilike.${like}`).order('start_date', { ascending: false }).limit(PER_GROUP),
    admin.from('payment_transactions').select('id, amount, payment_status, transaction_id, razorpay_payment_id, booking_id, created_at, bookings(primary_passenger_name)')
      .or(`transaction_id.ilike.${like},razorpay_payment_id.ilike.${like}`).order('created_at', { ascending: false }).limit(PER_GROUP),
  ]);

  const seen = new Set<string>();
  const bookings = [...(byId.data || []), ...(byText.data || [])]
    .filter((b: any) => (seen.has(b.id) ? false : (seen.add(b.id), true)))
    .slice(0, PER_GROUP)
    .map((b: any) => ({
      id: b.id,
      title: `${b.primary_passenger_name || 'Booking'} · ${String(b.id).slice(0, 8).toUpperCase()}`,
      meta: [one(b.trips)?.title, String(b.departure_date || one(b.trips)?.start_date || '').slice(0, 10), `${b.number_of_participants || 1} pax`, String(b.booking_status || '').replace(/_/g, ' ')].filter(Boolean).join(' · '),
      href: `/admin/bookings/${b.id}`,
    }));

  const users = (usersRes.data || []).map((u: any) => ({
    id: u.id,
    title: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User',
    meta: [u.email, u.phone].filter(Boolean).join(' · '),
    href: `/admin/users/${u.id}`,
  }));

  const trips = (tripsRes.data || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    meta: [t.destination, t.is_recurring ? 'recurring' : String(t.start_date || '').slice(0, 10), t.is_active === false || t.status === 'cancelled' ? 'inactive' : null].filter(Boolean).join(' · '),
    href: `/admin/trips/${t.id}`,
  }));

  const payments = ((paymentsRes as any).data || []).map((p: any) => ({
    id: p.id,
    title: `₹${Math.round(Number(p.amount) || 0).toLocaleString('en-IN')} · ${p.transaction_id || p.razorpay_payment_id}`,
    meta: [one(p.bookings)?.primary_passenger_name, p.payment_status].filter(Boolean).join(' · '),
    href: `/admin/bookings/${p.booking_id}`,
  }));

  return NextResponse.json({ bookings, users, trips, payments });
}
