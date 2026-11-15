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
import { isPendingCashBooking, moneyOf, pendingCashOf, seatLockBaseOf } from '@/lib/booking-money';
import { getSiteUrl } from '@/lib/site-url';

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
  bookingId?: string;
  /** PNG data URL of a QR code linking to the booking page (server-generated). */
  qrDataUrl?: string;
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
  const tripPrice = isSeatLockBooking ? seatLockBaseOf(booking as any, trip as any) : (parseFloat(String((booking as any).total_price || 0)) || grossFull);

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
    bookingId: String(booking.id),
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

/** Public "is this ticket valid?" page the QR code opens — no login needed. */
export function ticketVerifyUrl(bookingId: string): string {
  return `${getSiteUrl()}/verify/${bookingId}`;
}

/** Poppins faces (assets/pdf-fonts, OFL, subset incl. ₹): [file, family, style]. */
const TICKET_FONT_FILES: Array<[string, string, string]> = [
  ['Poppins-Regular', 'Poppins', 'normal'],
  ['Poppins-SemiBold', 'Poppins', 'bold'],
  ['Poppins-Bold', 'PoppinsHeavy', 'normal'],
];
export type TicketFonts = Record<string, string>;
let fontCache: TicketFonts | null = null;

/** Server only: base64 TTF data for the ticket fonts, or null if unavailable. */
export async function loadTicketFonts(): Promise<TicketFonts | null> {
  if (fontCache) return fontCache;
  try {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    const out: TicketFonts = {};
    await Promise.all(TICKET_FONT_FILES.map(async ([file]) => {
      const buf = await readFile(path.join(process.cwd(), 'assets', 'pdf-fonts', `${file}.ttf`));
      out[file] = buf.toString('base64');
    }));
    fontCache = out;
    return out;
  } catch {
    return null; // falls back to Helvetica
  }
}

type RGB = [number, number, number];

// Brand palette (matches tailwind `primary` / violet scale).
const C = {
  brand: [109, 40, 217] as RGB, // violet-700/800 — hero
  brandDeep: [76, 29, 149] as RGB, // violet-900 — headings
  brandInk: [46, 16, 101] as RGB, // violet-950 — ref / QR
  brandMid: [139, 92, 246] as RGB, // violet-500 — lines on hero
  brandMuted: [196, 181, 253] as RGB, // violet-300 — labels on hero
  brandLine: [221, 214, 254] as RGB, // violet-200
  brandSoft: [245, 243, 255] as RGB, // violet-50
  ink: [17, 24, 39] as RGB,
  body: [55, 65, 81] as RGB,
  muted: [107, 114, 128] as RGB,
  faint: [156, 163, 175] as RGB,
  line: [229, 231, 235] as RGB,
  white: [255, 255, 255] as RGB,
  green: [21, 128, 61] as RGB,
  greenSoft: [220, 252, 231] as RGB,
  amber: [180, 83, 9] as RGB,
  amberSoft: [254, 243, 199] as RGB,
  red: [185, 28, 28] as RGB,
  redSoft: [254, 226, 226] as RGB,
  slate: [75, 85, 99] as RGB,
  slateSoft: [243, 244, 246] as RGB,
};

function statusBadge(status: string): { label: string; fg: RGB; bg: RGB } {
  switch (status) {
    case 'confirmed': return { label: 'CONFIRMED', fg: C.green, bg: C.greenSoft };
    case 'completed': return { label: 'COMPLETED', fg: C.green, bg: C.greenSoft };
    case 'seat_locked': return { label: 'SEAT LOCKED', fg: C.amber, bg: C.amberSoft };
    case 'remaining_submitted': return { label: 'PAYMENT IN REVIEW', fg: C.amber, bg: C.amberSoft };
    case 'cancelled': return { label: 'CANCELLED', fg: C.red, bg: C.redSoft };
    default: return { label: 'PENDING', fg: C.slate, bg: C.slateSoft };
  }
}

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

/**
 * Build the ticket PDF. Works in the browser and in Node. Pass `fonts`
 * (from `loadTicketFonts`) to typeset in Poppins with a real ₹ sign; without
 * them it falls back to Helvetica and "Rs".
 */
export function buildTicketDoc(t: TicketData, fonts?: TicketFonts | null): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const hasFonts = !!fonts && TICKET_FONT_FILES.every(([file]) => !!fonts[file]);
  if (hasFonts) {
    for (const [file, family, style] of TICKET_FONT_FILES) {
      doc.addFileToVFS(`${file}.ttf`, fonts![file]);
      doc.addFont(`${file}.ttf`, family, style);
    }
  }
  const FAM = hasFonts ? 'Poppins' : 'helvetica';
  const money = (n: number) => (hasFonts ? '₹' : 'Rs ') + Number(n || 0).toLocaleString('en-IN');
  const calcText = (s: string) => (hasFonts ? s.replace(/Rs /g, '₹').replace(/ x /g, ' × ') : s);
  const W = 210;
  const H = 297;
  const M = 14;
  const CW = W - M * 2;
  const BOTTOM = H - 20; // keep clear of the footer

  const font = (style: 'normal' | 'bold' | 'heavy', size: number, color: RGB) => {
    if (style === 'heavy') doc.setFont(hasFonts ? 'PoppinsHeavy' : 'helvetica', hasFonts ? 'normal' : 'bold');
    else doc.setFont(FAM, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  /** Small tracked uppercase label. */
  const label = (text: string, x: number, y: number, color: RGB, align: 'left' | 'right' | 'center' = 'left', size = 7) => {
    const cs = 0.35;
    font('bold', size, color);
    const w = doc.getTextWidth(text) + cs * (text.length - 1);
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    doc.text(text, x0, y, { charSpace: cs });
    return w;
  };
  const section = (title: string, y: number) => {
    doc.setFillColor(...C.brand);
    doc.roundedRect(M, y - 3.1, 1.3, 4, 0.6, 0.6, 'F');
    const w = label(title, M + 3.6, y, C.brandDeep, 'left', 7.5);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(M + 3.6 + w + 3, y - 1.2, W - M, y - 1.2);
  };
  /** Booking reference — heavy, letter-spaced, centred. */
  const refText = (ref: string, cx: number, y: number, size: number) => {
    const cs = 0.6;
    font('heavy', size, C.brandInk);
    const w = doc.getTextWidth(ref) + cs * (ref.length - 1);
    doc.text(ref, cx - w / 2, y, { charSpace: cs });
  };
  const ensureSpace = (y: number, need: number) => {
    if (y + need <= BOTTOM) return y;
    doc.addPage();
    return 20;
  };

  // ── Brand bar ─────────────────────────────────────────────
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, W, 2.2, 'F');
  font('heavy', 17, C.brand);
  doc.text('Ghumakkars', M, 14.5);
  const brandW = doc.getTextWidth('Ghumakkars');
  label('TRAVEL AGENCY', M + brandW + 3, 14.3, C.faint, 'left', 6.5);
  label('E-TICKET', W - M, 9.8, C.brand, 'right', 7);
  font('normal', 8.5, C.muted);
  doc.text(`Booked on ${t.bookedOn}`, W - M, 14.5, { align: 'right' });

  // ── Hero ticket ───────────────────────────────────────────
  const hy = 20;
  const hh = 60;
  const stubW = 48;
  const splitX = W - M - stubW;
  doc.setFillColor(...C.brand);
  doc.roundedRect(M, hy, CW, hh, 4, 4, 'F');

  const lx = M + 8;
  const rx = splitX - 8;

  // Status pill (top-right of the main part)
  const badge = statusBadge(t.status);
  font('bold', 6.8, badge.fg);
  const pw = doc.getTextWidth(badge.label) + 0.3 * (badge.label.length - 1) + 7;
  doc.setFillColor(...badge.bg);
  doc.roundedRect(rx - pw, hy + 6.2, pw, 5.6, 2.8, 2.8, 'F');
  doc.text(badge.label, rx - pw + 3.5, hy + 10, { charSpace: 0.3 });

  label('TRIP TICKET', lx, hy + 10.2, C.brandMuted);

  // Title (max 2 lines)
  font('heavy', 18, C.white);
  let titleLines: string[] = doc.splitTextToSize(t.tripTitle || 'Trip', rx - lx);
  if (titleLines.length > 2) {
    titleLines = titleLines.slice(0, 2);
    titleLines[1] = titleLines[1].replace(/\s*\S*$/, '') + '...';
  }
  let ty = hy + 19.5;
  for (const l of titleLines) { doc.text(l, lx, ty); ty += 7.4; }
  if (t.destination) {
    font('normal', 9.5, C.brandLine);
    doc.text(doc.splitTextToSize(t.destination, rx - lx)[0], lx, ty - 1.4);
  }

  // Journey row: departs —— duration —— returns
  const sepY = hy + 38.5;
  doc.setDrawColor(...C.brandMid);
  doc.setLineWidth(0.25);
  doc.line(lx, sepY, rx, sepY);
  label('DEPARTS', lx, hy + 45.5, C.brandMuted);
  label('RETURNS', rx, hy + 45.5, C.brandMuted, 'right');
  font('bold', 12.5, C.white);
  const depW = doc.getTextWidth(t.departure);
  const retW = doc.getTextWidth(t.ret);
  doc.text(t.departure, lx, hy + 52.5);
  doc.text(t.ret, rx, hy + 52.5, { align: 'right' });
  const a = lx + depW + 5;
  const b = rx - retW - 5;
  let durationInHero = false;
  if (b - a > 18) {
    const ly = hy + 50.5;
    doc.setDrawColor(...C.brandMuted);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(a, ly, b, ly);
    doc.setLineDashPattern([], 0);
    doc.setFillColor(...C.white);
    doc.circle(a, ly, 0.8, 'F');
    doc.circle(b, ly, 0.8, 'F');
    if (t.duration && t.duration !== '—') {
      font('bold', 7, C.white);
      const dw = doc.getTextWidth(t.duration) + 6;
      if (dw < b - a - 4) {
        durationInHero = true;
        doc.setFillColor(...C.brandDeep);
        doc.roundedRect((a + b) / 2 - dw / 2, ly - 2.6, dw, 5.2, 2.6, 2.6, 'F');
        doc.text(t.duration, (a + b) / 2, ly + 0.9, { align: 'center' });
      }
    }
  }

  // Perforation + notches
  doc.setDrawColor(...C.brandMid);
  doc.setLineWidth(0.35);
  doc.setLineDashPattern([1.3, 1.1], 0);
  doc.line(splitX, hy + 5, splitX, hy + hh - 5);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(...C.white);
  doc.circle(splitX, hy, 3, 'F');
  doc.circle(splitX, hy + hh, 3, 'F');

  // Stub: QR + reference
  const sx = splitX + 4.5;
  const sw = stubW - 9;
  const sc = sx + sw / 2;
  doc.setFillColor(...C.white);
  doc.roundedRect(sx, hy + 4.5, sw, hh - 9, 2.5, 2.5, 'F');
  if (t.qrDataUrl) {
    const q = 27;
    doc.addImage(t.qrDataUrl, 'PNG', sc - q / 2, hy + 8.5, q, q);
    label('BOOKING REF', sc, hy + 40.5, C.muted, 'center', 5.8);
    refText(t.ref, sc, hy + 46.2, 11);
    font('normal', 5.8, C.faint);
    doc.text('Scan to verify this ticket', sc, hy + 50.6, { align: 'center' });
  } else {
    label('BOOKING REF', sc, hy + 24, C.muted, 'center', 6.5);
    refText(t.ref, sc, hy + 32, 14);
  }

  // ── Quick facts strip ─────────────────────────────────────
  let y = hy + hh + 5;
  {
    const pickup = t.pickupPoint || '—';
    const cells = [
      // Duration already sits on the hero's journey line when it fits there.
      ...(durationInHero ? [] : [{ k: 'DURATION', v: t.duration || '—', w: 40 }]),
      { k: 'TRAVELLERS', v: `${t.travellers} ${t.travellers === 1 ? 'person' : 'people'}`, w: 36 },
    ];
    const used = cells.reduce((s, c) => s + c.w, 0);
    cells.push({ k: 'PICKUP POINT', v: pickup, w: CW - used });
    const pickupIdx = cells.length - 1;
    font('bold', 10, C.ink);
    const pickupLines: string[] = doc.splitTextToSize(pickup, cells[pickupIdx].w - 12).slice(0, 2);
    const sh = 15 + (pickupLines.length - 1) * 4.6;
    doc.setFillColor(...C.brandSoft);
    doc.roundedRect(M, y, CW, sh, 3, 3, 'F');
    let cx = M;
    cells.forEach((c, i) => {
      if (i > 0) {
        doc.setDrawColor(...C.brandLine);
        doc.setLineWidth(0.25);
        doc.line(cx, y + 3.5, cx, y + sh - 3.5);
      }
      label(c.k, cx + 6, y + 5.8, C.brand, 'left', 6.5);
      font('bold', 10, C.ink);
      doc.text(i === pickupIdx ? pickupLines : [c.v], cx + 6, y + 11.2);
      cx += c.w;
    });
    y += sh + 9;
  }

  // ── Travellers ────────────────────────────────────────────
  const tableBase = {
    margin: { left: M, right: M, top: 18, bottom: 22 },
    theme: 'plain' as const,
    styles: {
      font: FAM,
      fontSize: 9,
      textColor: C.ink,
      cellPadding: { top: 2.3, bottom: 2.3, left: 3, right: 3 },
      lineColor: C.line,
      lineWidth: { bottom: 0.2 },
      valign: 'middle' as const,
    },
    headStyles: { fillColor: C.brandSoft, textColor: C.brandDeep, fontStyle: 'bold' as const, fontSize: 7, lineWidth: 0 },
  };
  y = ensureSpace(y, 30);
  section('TRAVELLERS', y);
  autoTable(doc, {
    ...tableBase,
    startY: y + 3,
    head: [['#', 'NAME', 'AGE', 'GENDER', 'PHONE']],
    body: t.passengers.map((p, i) => [
      String(i + 1),
      p.name || '—',
      p.age != null && p.age !== '' ? String(p.age) : '—',
      cap(p.gender ? String(p.gender) : '') || '—',
      p.phone ? String(p.phone) : '—',
    ]),
    columnStyles: {
      0: { cellWidth: 10, textColor: C.faint },
      1: { fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 26 },
      4: { cellWidth: 40 },
    },
    didDrawCell: (data: any) => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      if (!t.passengers[data.row.index]?.isPrimary) return;
      doc.setFont(FAM, 'bold');
      doc.setFontSize(9);
      const nameW = doc.getTextWidth(String(data.cell.text?.[0] ?? ''));
      const bx = data.cell.x + data.cell.padding('left') + nameW + 2.5;
      const by = data.cell.y + data.cell.height / 2 - 2;
      if (bx + 12 > data.cell.x + data.cell.width) return;
      doc.setFillColor(...C.brandSoft);
      doc.roundedRect(bx, by, 11, 4, 2, 2, 'F');
      doc.setFontSize(5.8);
      doc.setTextColor(...C.brand);
      doc.text('LEAD', bx + 5.5, by + 2.8, { align: 'center', charSpace: 0.2 });
    },
  });
  y = (doc as any).lastAutoTable.finalY + 9;

  // ── Add-ons (only when present) ───────────────────────────
  if (t.addons.length > 0) {
    y = ensureSpace(y, 30);
    section('ADD-ONS & UPGRADES', y);
    autoTable(doc, {
      ...tableBase,
      startY: y + 3,
      head: [['ADD-ON', 'FOR', 'CALCULATION', 'AMOUNT']],
      body: t.addons.map((a) => [a.name, a.travellers, calcText(a.calc), money(a.total)]),
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 52 },
        2: { textColor: C.muted, cellWidth: 44 },
        3: { fontStyle: 'bold', cellWidth: 28 },
      },
      didParseCell: (data: any) => {
        if (data.column.index === 3) data.cell.styles.halign = 'right';
      },
    });
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  // ── Payment (left) + contacts (right) ─────────────────────
  type Row = { k: string; v: string; color?: RGB };
  const rows: Row[] = [{ k: 'Trip package', v: money(t.tripPrice) }];
  if (t.addonsTotal > 0) rows.push({ k: 'Add-ons & upgrades', v: money(t.addonsTotal) });
  if (t.couponDiscount > 0) rows.push({ k: `Coupon${t.couponCode ? ` (${t.couponCode})` : ''}`, v: '- ' + money(t.couponDiscount), color: C.green });
  if (t.walletUsed > 0) rows.push({ k: 'Wallet used', v: '- ' + money(t.walletUsed), color: C.brand });

  type Tile = { k: string; v: string; fg: RGB; bg: RGB };
  const tiles: Tile[] = t.pendingCash
    ? [
        { k: 'DUE IN PERSON', v: money(t.dueNow || 0), fg: C.amber, bg: C.amberSoft },
        { k: 'BALANCE AFTER', v: money(t.remainingAfterDueNow || 0), fg: C.slate, bg: C.slateSoft },
      ]
    : [
        { k: 'AMOUNT PAID', v: money(t.amountPaid), fg: C.green, bg: C.greenSoft },
        ...(t.remaining > 0 ? [{ k: 'BALANCE DUE', v: money(t.remaining), fg: C.amber, bg: C.amberSoft }] : []),
      ];

  const payW = 114;
  const gap = 6;
  const sideX = M + payW + gap;
  const sideW = CW - payW - gap;
  const payH = 40.5 + rows.length * 6 + (t.txnId ? 5 : 0);
  const hasEmergency = !!(t.emergencyName || t.emergencyPhone);
  const emH = 25;

  // "Before you go" tips — sit in the right column beside the payment card.
  const tips = [
    'Carry this ticket (printed or on phone) and a govt. photo ID: Aadhaar, DL or Passport.',
    'Reach the pickup point 30 minutes before departure.',
  ];
  if (t.qrDataUrl) tips.push('Anyone can scan the QR code to check this ticket is valid.');
  font('normal', 8, C.body);
  const tipLines = tips.map((tp) => doc.splitTextToSize(tp, sideW - 14) as string[]);
  const tipH = 11 + tipLines.reduce((s, l) => s + l.length * 3.8 + 1.4, 0) + 1.5;
  const sideH = (hasEmergency ? emH + 4 : 0) + tipH;

  y = ensureSpace(y, Math.max(payH, sideH) + 6);
  section('PAYMENT & TRAVEL INFO', y);
  y += 4;
  const top = y;

  // Payment card
  {
    const px = M + 6;
    const pr = M + payW - 6;
    let cy = top + 8;
    label('PAYMENT SUMMARY', px, cy, C.muted, 'left', 6.5);
    cy += 6.5;
    for (const r of rows) {
      font('normal', 9, C.body);
      doc.text(r.k, px, cy);
      font('normal', 9, r.color || C.ink);
      doc.text(r.v, pr, cy, { align: 'right' });
      cy += 6;
    }
    cy -= 2.5;
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(px, cy, pr, cy);
    cy += 6.5;
    font('heavy', 11, C.ink);
    doc.text('Grand total', px, cy);
    doc.text(money(t.grandTotal), pr, cy, { align: 'right' });
    cy += 4;
    const tw = (pr - px - (tiles.length - 1) * 3) / tiles.length;
    tiles.forEach((tl, i) => {
      const tx = px + i * (tw + 3);
      doc.setFillColor(...tl.bg);
      doc.roundedRect(tx, cy, tw, 13, 2, 2, 'F');
      label(tl.k, tx + 3.5, cy + 4.8, tl.fg, 'left', 6);
      font('heavy', 11.5, tl.fg);
      doc.text(tl.v, tx + 3.5, cy + 10.4);
    });
    cy += 13;
    if (t.txnId) {
      cy += 5;
      font('normal', 7, C.faint);
      doc.text('Txn ID', px, cy);
      font('normal', 7, C.muted);
      doc.text(String(t.txnId), px + 10.5, cy);
    }
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, top, payW, cy + 5 - top, 3, 3, 'S');
  }

  // Right column: emergency contact + tips
  {
    let cy = top;
    const ix = sideX + 5;
    const iw = sideW - 10;
    if (hasEmergency) {
      doc.setFillColor(...C.brandSoft);
      doc.roundedRect(sideX, cy, sideW, emH, 3, 3, 'F');
      label('EMERGENCY CONTACT', ix, cy + 7, C.brand, 'left', 6.5);
      font('bold', 10, C.ink);
      doc.text(doc.splitTextToSize(t.emergencyName || '—', iw)[0], ix, cy + 13.5);
      font('normal', 9, C.body);
      doc.text(t.emergencyPhone || '—', ix, cy + 19.5);
      cy += emH + 4;
    }
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.3);
    doc.roundedRect(sideX, cy, sideW, tipH, 3, 3, 'FD');
    label('BEFORE YOU GO', ix, cy + 7, C.amber, 'left', 6.5);
    let ny = cy + 12.5;
    for (const lines of tipLines) {
      doc.setFillColor(...C.amber);
      doc.circle(ix + 1, ny - 1, 0.65, 'F');
      font('normal', 8, [120, 53, 15]);
      doc.text(lines, ix + 4, ny);
      ny += lines.length * 3.8 + 1.4;
    }
  }

  // ── Footer on every page ──────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 14, W - M, H - 14);
    font('bold', 7.5, C.brand);
    doc.text('Ghumakkars', M, H - 9);
    font('normal', 7.5, C.muted);
    doc.text('Help: +91 82180 20972  ·  support@ghumakkars.in  ·  www.ghumakkars.in', W / 2, H - 9, { align: 'center' });
    doc.text(pages > 1 ? `Page ${i} of ${pages}` : `Ref #${t.ref}`, W - M, H - 9, { align: 'right' });
  }

  return doc;
}

/** Server-side: return the ticket PDF as a Node Buffer. */
export async function renderTicketBuffer(bookingId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await loadTicketData(bookingId);
  if (!data) return null;
  try {
    const QRCode = (await import('qrcode')).default;
    data.qrDataUrl = await QRCode.toDataURL(ticketVerifyUrl(data.bookingId!), {
      margin: 0,
      width: 300,
      errorCorrectionLevel: 'M',
      color: { dark: '#2E1065', light: '#FFFFFF' },
    });
  } catch {
    /* QR is a nice-to-have — the ticket still renders without it */
  }
  const doc = buildTicketDoc(data, await loadTicketFonts());
  const ab = doc.output('arraybuffer');
  return { buffer: Buffer.from(ab), filename: ticketFilename(data) };
}
