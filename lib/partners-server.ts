import type { SupabaseClient } from '@supabase/supabase-js';
import { partnerAccountOf } from '@/lib/partner-money';

/** Booking columns needed to work out partner money (+ what the partner page shows). */
export const PARTNER_BOOKING_SELECT = `
  id, trip_id, user_id, booking_status, payment_method, payment_status, is_offline_booking,
  number_of_participants, total_price, final_amount, coupon_discount, wallet_amount_used,
  waived_amount, amount_paid, addons_total, departure_date, created_at,
  partner_id, partner_price, partner_price_basis, partner_price_rate, referral_commission,
  referral_notes, referred_at, pickup_point,
  primary_passenger_name, primary_passenger_phone, primary_passenger_email, passengers,
  trips ( id, title, destination, start_date, end_date, is_recurring, discounted_price ),
  payment_transactions ( id, amount, amount_refunded, payment_status, payment_mode, collected_by, created_at )
`;

export const PARTNER_FIELDS = 'id, name, contact_name, phone, email, upi_id, bank_details, default_price_basis, default_price_rate, notes, is_active, created_at, updated_at';

export function cleanPartnerInput(body: any) {
  const str = (v: unknown, max: number) => {
    const t = v == null ? '' : String(v).trim();
    return t ? t.slice(0, max) : null;
  };
  const out: Record<string, unknown> = {};
  if ('name' in body) out.name = str(body.name, 120);
  if ('contact_name' in body) out.contact_name = str(body.contact_name, 120);
  if ('phone' in body) out.phone = str(body.phone, 30);
  if ('email' in body) out.email = str(body.email, 160);
  if ('upi_id' in body) out.upi_id = str(body.upi_id, 120);
  if ('bank_details' in body) out.bank_details = str(body.bank_details, 500);
  if ('notes' in body) out.notes = str(body.notes, 2000);
  if ('default_price_basis' in body) out.default_price_basis = body.default_price_basis === 'total' ? 'total' : 'per_person';
  if ('default_price_rate' in body) {
    const n = parseFloat(String(body.default_price_rate));
    out.default_price_rate = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if ('is_active' in body) out.is_active = !!body.is_active;
  return out;
}

/** Load partners with their bookings + settlements and the account math. */
export async function loadPartnerAccounts(admin: SupabaseClient, partnerId?: string) {
  let pq = admin.from('partners').select(PARTNER_FIELDS).order('name');
  if (partnerId) pq = pq.eq('id', partnerId);
  const { data: partners, error } = await pq;
  if (error) throw error;
  const ids = (partners || []).map((p: any) => p.id);
  if (ids.length === 0) return [];

  const [{ data: bookings, error: bErr }, { data: settlements, error: sErr }] = await Promise.all([
    admin.from('bookings').select(PARTNER_BOOKING_SELECT).in('partner_id', ids).order('created_at', { ascending: false }),
    admin.from('partner_settlements')
      .select('id, partner_id, booking_id, direction, amount, method, reference, notes, settled_on, created_at')
      .in('partner_id', ids)
      .order('settled_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  if (bErr) throw bErr;
  if (sErr) throw sErr;

  return (partners || []).map((p: any) => {
    const pb = (bookings || []).filter((b: any) => b.partner_id === p.id);
    const ps = (settlements || []).filter((s: any) => s.partner_id === p.id);
    const account = partnerAccountOf(pb as any, ps as any);
    return { partner: p, bookings: pb, settlements: ps, account };
  });
}
