/**
 * Trip ticket PDF — ONE generator used by both the website "Download ticket"
 * button and the WhatsApp attachment, so the two are always identical.
 *
 * jsPDF runs in the browser and in Node, so the same `buildTicketDoc` produces
 * the same bytes everywhere. `loadTicketData` fetches + normalises a booking the
 * same way the booking page does.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPendingCashBooking, moneyOf, pendingCashOf } from '@/lib/booking-money';

export interface TicketPassenger {
  name?: string;
  age?: string | number;
  gender?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface TicketAddon {
  name: string;
  travellers: string;
  calc: string;
  total: number;
}

export interface TicketData {
  ref: string;
  status: string;
  tripTitle: string;
  destination: string;
  departure: string;
  ret: string;
  duration: string;
  travellers: number;
  pickupPoint?: string;
  passengers: TicketPassenger[];
  emergencyName?: string;
  emergencyPhone?: string;
  tripPrice: number;
  addons: TicketAddon[];
  addonsTotal: number;
  couponCode?: string;
  couponDiscount: number;
  walletUsed: number;
  grandTotal: number;
  amountPaid: number;
  remaining: number;
  pendingCash?: boolean;
  dueNow?: number;
  remainingAfterDueNow?: number;
  txnId?: string;
  bookedOn: string;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const rupee = (n: number) => 'Rs ' + Number(n || 0).toLocaleString('en-IN');

/** Add-on calculation string for the PDF (uses "Rs " — jsPDF fonts lack ₹). */
function ticketAddonCalc(a: any): string {
  const n = Array.isArray(a.selected_passenger_ids)
    ? a.selected_passenger_ids.length
    : (Array.isArray(a.selected_passenger_names) ? a.selected_passenger_names.length : 0);
  const price = rupee(Number(a.unit_price) || 0);
  switch (a.pricing_method) {
    case 'per_booking': return `${price} / booking`;
    case 'per_traveller': return `${price} x ${n}`;
    case 'per_room': return `${price} x ${a.room_count ?? 0} room(s)`;
    case 'per_unit': return `${price} x ${a.quantity ?? 0}`;
    case 'per_traveller_night': return `${price} x ${n} x ${a.chargeable_units ?? 0} nights`;
    default: return price;
  }
}

/** Fetch a booking and compute the exact same values the booking page shows. */
export async function loadTicketData(bookingId: string): Promise<TicketData | null> {
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select(`
      *,
      trips ( title, destination, start_date, end_date, is_recurring, duration_days, duration_text, discounted_price ),
      payment_transactions ( payment_status, amount ),
      booking_addons ( name, pricing_method, unit_price, selected_passenger_ids, selected_passenger_names, quantity, room_count, chargeable_units, addon_total, status )
    `)
    .eq('id', bookingId)
    .single();
  if (!booking) return null;

  const trip: any = (booking as any).trips || {};
  const status = (booking as any).booking_status || 'pending';
  const ref = String(booking.id).slice(0, 8).toUpperCase();

  // Effective travel dates (recurring trips use the chosen departure + duration).
  const computeEnd = (start: string, days?: number) => {
    const [y, m, d] = start.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Math.max(0, (days || 1) - 1));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const dep = (booking as any).departure_date;
  const effectiveStart: string | undefined = (trip.is_recurring && dep) ? dep : trip.start_date;
  const effectiveEnd: string | undefined = (trip.is_recurring && dep) ? computeEnd(dep, trip.duration_days) : trip.end_date;

  // Passengers: primary + de-duplicated additional passengers.
  const primaryName = String((booking as any).primary_passenger_name || '').trim().toLowerCase();
  const additional: TicketPassenger[] = Array.isArray((booking as any).passengers)
    ? (booking as any).passengers.filter((p: any) => {
        if (!p || p.is_primary === true) return false;
        const pName = String(p.name || '').trim().toLowerCase();
        return !(pName && primaryName && pName === primaryName);
      }).map((p: any) => ({ name: p.name, age: p.age, gender: p.gender, phone: p.phone, isPrimary: false }))
    : [];
  const passengers: TicketPassenger[] = [
    {
      name: (booking as any).primary_passenger_name,
      age: (booking as any).primary_passenger_age,
      gender: (booking as any).primary_passenger_gender,
      phone: (booking as any).primary_passenger_phone,
      isPrimary: true,
    },
    ...additional,
  ];

  // Money — mirrors the booking page exactly.
  const pax = Number((booking as any).number_of_participants) || 1;
  const couponDiscount = parseFloat(String((booking as any).coupon_discount || 0)) || 0;
  const walletUsed = parseFloat(String((booking as any).wallet_amount_used || 0)) || 0;
  const isSeatLockBooking = (booking as any).payment_method === 'seat_lock' || ['seat_locked', 'remaining_submitted'].includes(status);
  const grossFull = (trip.discounted_price || 0) * pax;
  const tripPrice = isSeatLockBooking ? grossFull : (parseFloat(String((booking as any).total_price || 0)) || grossFull);

  // Add-ons (exclude cancelled). They add to the grand total; for seat-lock they
  // sit in the remaining balance.
  const addonRows: any[] = Array.isArray((booking as any).booking_addons)
    ? (booking as any).booking_addons.filter((a: any) => a.status !== 'cancelled')
    : [];
  const addons: TicketAddon[] = addonRows.map((a) => ({
    name: a.name,
    travellers: (Array.isArray(a.selected_passenger_names) && a.selected_passenger_names.length)
      ? a.selected_passenger_names.join(', ') : '—',
    calc: ticketAddonCalc(a),
    total: Number(a.addon_total) || 0,
  }));
  const addonsTotal = addons.reduce((s, a) => s + a.total, 0);

  const money = moneyOf(booking as any, trip as any);
  const grandTotal = money.owed;
  const pendingCash = isPendingCashBooking(booking as any);
  const pendingCashMoney = pendingCashOf(booking as any, trip as any);

  return {
    ref,
    status,
    tripTitle: trip.title || 'Trip',
    destination: trip.destination || '',
    departure: fmtDate(effectiveStart),
    ret: fmtDate(effectiveEnd),
    duration: trip.duration_text || (trip.duration_days ? `${trip.duration_days} days` : '—'),
    travellers: pax,
    pickupPoint: (booking as any).pickup_point || undefined,
    passengers,
    emergencyName: (booking as any).emergency_contact_name || undefined,
    emergencyPhone: (booking as any).emergency_contact_phone || undefined,
    tripPrice,
    addons,
    addonsTotal,
    couponCode: (booking as any).coupon_code || undefined,
    couponDiscount,
    walletUsed,
    grandTotal,
    amountPaid: money.paid,
    remaining: money.remaining,
    pendingCash,
    dueNow: pendingCash ? pendingCashMoney.dueNow : undefined,
    remainingAfterDueNow: pendingCash ? pendingCashMoney.remainingAfterDueNow : undefined,
    txnId: (booking as any).reference_id || (booking as any).transaction_id || undefined,
    bookedOn: fmtDate((booking as any).created_at),
  };
}

export function ticketFilename(t: TicketData): string {
  const slug = (t.tripTitle || 'trip').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `Ghumakkars-Ticket-${slug}-${t.ref}.pdf`;
}

const PURPLE: [number, number, number] = [124, 58, 237];
const GRAY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [15, 23, 42];

/** Build the ticket PDF. Works identically in the browser and in Node. */
export function buildTicketDoc(t: TicketData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;

  // ── Header band ──
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('GHUMAKKARS  ·  TRIP TICKET', M, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(doc.splitTextToSize(t.tripTitle, 120)[0], M, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (t.destination) doc.text(t.destination, M, 31);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`REF #${t.ref}`, M, 38);

  // Status stamp (top-right)
  const stamp = t.status === 'confirmed' ? 'CONFIRMED' : t.status === 'seat_locked' ? 'SEAT LOCKED' : '';
  if (stamp) {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.6);
    const sw = 46, sx = W - M - sw, sy = 12;
    doc.roundedRect(sx, sy, sw, 11, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(stamp, sx + sw / 2, sy + 7.3, { align: 'center' });
  }

  // ── Detail fields ──
  let y = 56;
  const field = (x: number, label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(value || '—', x, y + 6);
  };
  const col = (210 - M * 2) / 4;
  field(M, 'Departure', t.departure);
  field(M + col, 'Return', t.ret);
  field(M + col * 2, 'Duration', t.duration);
  field(M + col * 3, 'Travellers', String(t.travellers));

  if (t.pickupPoint) {
    y += 16;
    field(M, 'Pickup point', t.pickupPoint);
  }

  // ── Travellers table ──
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('TRAVELLERS', M, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M },
    head: [['#', 'Name', 'Age', 'Gender', 'Phone']],
    body: t.passengers.map((p, i) => [
      String(i + 1),
      (p.name || '—') + (p.isPrimary ? '  (Primary)' : ''),
      p.age != null && p.age !== '' ? String(p.age) : '—',
      p.gender ? String(p.gender) : '—',
      p.phone ? String(p.phone) : '—',
    ]),
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
    headStyles: { fillColor: [249, 250, 251], textColor: GRAY, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 10 } },
    theme: 'grid',
    tableLineColor: [243, 244, 246],
    tableLineWidth: 0.1,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Add-ons & upgrades table (only when present) ──
  if (t.addons.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('ADD-ONS & UPGRADES', M, y);
    autoTable(doc, {
      startY: y + 3,
      margin: { left: M, right: M },
      head: [['Add-on', 'Travellers', 'Calculation', 'Amount']],
      body: t.addons.map((a) => [a.name, a.travellers, a.calc, rupee(a.total)]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK },
      headStyles: { fillColor: [249, 250, 251], textColor: GRAY, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 3: { halign: 'right', cellWidth: 26 } },
      theme: 'grid',
      tableLineColor: [243, 244, 246],
      tableLineWidth: 0.1,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── Emergency contact ──
  if (t.emergencyName || t.emergencyPhone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('EMERGENCY CONTACT', M, y);
    y += 3;
    field(M, 'Name', t.emergencyName || '—');
    field(M + col * 2, 'Phone', t.emergencyPhone || '—');
    y += 16;
  }

  // ── Payment ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('PAYMENT', M, y);
  y += 7;
  const payRow = (label: string, value: string, opts?: { bold?: boolean; color?: [number, number, number]; size?: number }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size || 10);
    doc.setTextColor(...(opts?.color || DARK));
    doc.text(label, M, y);
    doc.text(value, W - M, y, { align: 'right' });
    y += opts?.size ? opts.size * 0.6 : 6;
  };
  payRow('Base package', rupee(t.tripPrice));
  if (t.addonsTotal > 0) payRow('Add-ons & upgrades', rupee(t.addonsTotal));
  if (t.couponDiscount > 0) payRow(`Coupon${t.couponCode ? ' (' + t.couponCode + ')' : ''}`, '- ' + rupee(t.couponDiscount), { color: [21, 128, 5] });
  if (t.walletUsed > 0) payRow('Wallet used', '- ' + rupee(t.walletUsed), { color: [109, 40, 217] });
  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(M, y, W - M, y);
  y += 6;
  payRow('Grand total', rupee(t.grandTotal), { bold: true, size: 12 });
  if (t.pendingCash) {
    payRow('Payment due in person', rupee(t.dueNow || 0), { bold: true, color: [194, 65, 12] });
    payRow('Balance after this payment', rupee(t.remainingAfterDueNow || 0), { bold: true, color: [194, 65, 12] });
  } else {
    payRow('Amount paid', rupee(t.amountPaid), { bold: true, color: [21, 128, 5] });
    if (t.remaining > 0) payRow('Pending balance', rupee(t.remaining), { bold: true, color: [194, 65, 12] });
  }
  if (t.txnId) {
    y += 2;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Txn ID: ${t.txnId}`, M, y);
    y += 6;
  }

  // ── Important note ──
  y += 4;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  const noteLines = doc.splitTextToSize(
    'Please carry a printout or digital copy of this ticket + a valid government photo ID (Aadhaar / Driving Licence / Passport). Reach the pickup point 30 minutes before departure.',
    210 - M * 2 - 8,
  );
  const noteH = noteLines.length * 4.6 + 8;
  doc.roundedRect(M, y, 210 - M * 2, noteH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(154, 52, 18);
  doc.text(noteLines, M + 4, y + 6);

  // ── Footer ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    `Booked on ${t.bookedOn}  ·  support@ghumakkars.in  ·  +91 82180 20972`,
    W / 2,
    290,
    { align: 'center' },
  );

  return doc;
}

/** Server-side: return the ticket PDF as a Node Buffer. */
export async function renderTicketBuffer(bookingId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await loadTicketData(bookingId);
  if (!data) return null;
  const doc = buildTicketDoc(data);
  const ab = doc.output('arraybuffer');
  return { buffer: Buffer.from(ab), filename: ticketFilename(data) };
}
