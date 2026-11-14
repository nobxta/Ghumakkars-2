/**
 * Pulls Razorpay settlements (bank payouts) and their per-transaction breakdown
 * into razorpay_settlements / razorpay_settlement_items.
 *
 * Razorpay APIs used:
 *   GET /v1/settlements                 → payouts (amount, fees, tax, UTR, status)
 *   GET /v1/settlements/recon/combined  → every payment/refund/adjustment inside each
 *                                         payout, by the month it was settled
 *
 * All amounts from Razorpay are in paise; we store rupees.
 */
import Razorpay from 'razorpay';
import { getRazorpayConfig } from '@/lib/razorpay';

const rupees = (paise: unknown) => Math.round(Number(paise || 0)) / 100;
const iso = (unix: unknown) => (unix ? new Date(Number(unix) * 1000).toISOString() : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

/** Default backfill start when nothing has been synced yet. */
const BACKFILL_FROM = new Date('2026-07-01T00:00:00+05:30');
/** Re-read this much history on each incremental sync, to catch late rows. */
const OVERLAP_DAYS = 10;

export interface SettlementSyncResult {
  from: string;
  to: string;
  settlements: number;
  items: number;
}

function client() {
  const cfg = getRazorpayConfig();
  return new Razorpay({ key_id: cfg.key_id, key_secret: cfg.key_secret });
}

function rzpError(e: any): Error {
  return new Error(e?.error?.description || e?.message || 'Razorpay request failed');
}

function settlementRow(s: any) {
  return {
    id: s.id,
    amount: rupees(s.amount),
    fees: rupees(s.fees),
    tax: rupees(s.tax),
    utr: s.utr || null,
    status: s.status || null,
    settled_at: iso(s.created_at),
    razorpay_raw: s,
    synced_at: new Date().toISOString(),
  };
}

/** The recon report returns order notes as a JSON string; payments return an object. */
function notesOf(r: any): Record<string, any> {
  if (r?.notes && typeof r.notes === 'object') return r.notes;
  if (typeof r?.notes === 'string') {
    try { const n = JSON.parse(r.notes); return n && typeof n === 'object' ? n : {}; } catch { return {}; }
  }
  return {};
}

function itemRow(r: any) {
  const notes = notesOf(r);
  const isPayment = typeof r.entity_id === 'string' && r.entity_id.startsWith('pay_');
  return {
    settlement_id: r.settlement_id,
    entity_id: r.entity_id,
    type: r.type || (isPayment ? 'payment' : 'other'),
    razorpay_payment_id: r.payment_id || (isPayment ? r.entity_id : null),
    order_id: r.order_id || null,
    method: r.method || null,
    amount: rupees(r.amount),
    fee: rupees(r.fee),
    tax: rupees(r.tax),
    credit: rupees(r.credit),
    debit: rupees(r.debit),
    on_hold: !!r.on_hold,
    transaction_at: iso(r.created_at),
    settled_at: iso(r.settled_at),
    settlement_utr: r.settlement_utr || null,
    // Checkout puts {bookingId, userId, tripId} in the order notes and the booking id in the receipt.
    note_booking_id: uuidOrNull(notes.bookingId) || uuidOrNull(r.order_receipt),
    note_user_id: uuidOrNull(notes.userId),
    note_trip_id: uuidOrNull(notes.tripId),
    description: r.description || null,
    razorpay_raw: r,
    synced_at: new Date().toISOString(),
  };
}

/** Months (IST calendar) touched by [from, to]. */
function monthsBetween(from: Date, to: Date) {
  const ist = (d: Date) => new Date(d.getTime() + 330 * 60000);
  const a = ist(from), b = ist(to);
  const out: { year: number; month: number }[] = [];
  let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
  while (y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth() + 1)) {
    out.push({ year: y, month: m });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** Where an incremental sync should start: a little before the latest payout we have. */
export async function defaultSyncFrom(admin: any): Promise<Date> {
  const { data } = await admin
    .from('razorpay_settlements')
    .select('settled_at')
    .order('settled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.settled_at) return BACKFILL_FROM;
  return new Date(new Date(data.settled_at).getTime() - OVERLAP_DAYS * 86400000);
}

export async function syncRazorpaySettlements(
  admin: any,
  opts: { from?: Date; to?: Date; full?: boolean } = {}
): Promise<SettlementSyncResult> {
  const to = opts.to || new Date();
  const from = opts.full ? BACKFILL_FROM : opts.from || (await defaultSyncFrom(admin));
  const rzp: any = client();

  try {
    // 1) Payouts in range.
    const settlements = new Map<string, any>();
    for (let skip = 0; ; skip += 100) {
      let page: any;
      try {
        page = await rzp.settlements.all({
          from: Math.floor(from.getTime() / 1000),
          to: Math.floor(to.getTime() / 1000),
          count: 100,
          skip,
        });
      } catch (e) { throw rzpError(e); }
      const list = page?.items || [];
      list.forEach((s: any) => settlements.set(s.id, s));
      if (list.length < 100) break;
    }

    // 2) Per-transaction breakdown, month by month.
    const items: any[] = [];
    for (const { year, month } of monthsBetween(from, to)) {
      for (let skip = 0; ; skip += 1000) {
        let page: any;
        try {
          page = await rzp.settlements.reports({ year, month, count: 1000, skip });
        } catch (e) { throw rzpError(e); }
        const list = page?.items || [];
        items.push(...list.filter((r: any) => r.settlement_id && r.entity_id));
        if (list.length < 1000) break;
      }
    }

    // 3) Payouts referenced by a row but outside the listed range.
    for (const id of new Set(items.map((r) => r.settlement_id))) {
      if (settlements.has(id)) continue;
      try { settlements.set(id, await rzp.settlements.fetch(id)); }
      catch (e) { throw rzpError(e); }
    }

    // Standard payouts report fees = 0 (fees are per transaction), so sum them from the rows.
    const feeBy = new Map<string, { fee: number; tax: number }>();
    for (const r of items) {
      const f = feeBy.get(r.settlement_id) || { fee: 0, tax: 0 };
      f.fee += Number(r.fee || 0); f.tax += Number(r.tax || 0);
      feeBy.set(r.settlement_id, f);
    }
    if (settlements.size) {
      const rowsToSave = [...settlements.values()].map((s) => {
        const row = settlementRow(s);
        const f = feeBy.get(s.id);
        if (f && !row.fees) { row.fees = rupees(f.fee); row.tax = rupees(f.tax); }
        return row;
      });
      const { error } = await admin
        .from('razorpay_settlements')
        .upsert(rowsToSave, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    // De-duplicate by the unique key before upserting (Postgres rejects dup keys in one statement).
    const rows = new Map<string, any>();
    for (const r of items) {
      const row = itemRow(r);
      rows.set(`${row.settlement_id}|${row.entity_id}|${row.type}`, row);
    }
    const all = [...rows.values()];
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await admin
        .from('razorpay_settlement_items')
        .upsert(all.slice(i, i + 500), { onConflict: 'settlement_id,entity_id,type' });
      if (error) throw new Error(error.message);
    }

    const result = { from: from.toISOString(), to: to.toISOString(), settlements: settlements.size, items: all.length };
    await admin.from('razorpay_settlement_sync').upsert({
      id: 1, last_synced_at: new Date().toISOString(), last_from: result.from, last_to: result.to,
      last_error: null, settlements: result.settlements, items: result.items,
    });
    return result;
  } catch (e: any) {
    await admin.from('razorpay_settlement_sync').upsert({ id: 1, last_error: e?.message || String(e) });
    throw e;
  }
}

/** Webhook: store the payout right away, then pull its breakdown. */
export async function recordSettlementFromWebhook(admin: any, settlement: any) {
  if (!settlement?.id) return;
  await admin.from('razorpay_settlements').upsert(settlementRow(settlement), { onConflict: 'id' });
  const at = settlement.created_at ? new Date(settlement.created_at * 1000) : new Date();
  await syncRazorpaySettlements(admin, { from: new Date(at.getTime() - 3 * 86400000), to: new Date() });
}
