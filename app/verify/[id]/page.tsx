import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, CalendarDays, Users, MapPin, User } from 'lucide-react';
import { loadTicketData } from '@/lib/ticket-pdf';

// Public ticket check — the QR code on every ticket PDF opens this page.
// No login needed, so it only shows what a checker needs: whether the ticket
// is valid, the trip and dates, and a masked lead-traveller name.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify ticket',
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Verdict = {
  tone: 'valid' | 'warn' | 'invalid';
  title: string;
  note: string;
};

function verdictFor(status: string): Verdict {
  switch (status) {
    case 'confirmed':
      return { tone: 'valid', title: 'Valid ticket', note: 'This booking is confirmed.' };
    case 'seat_locked':
      return { tone: 'valid', title: 'Valid ticket', note: 'Seat reserved. Balance payment is still pending.' };
    case 'remaining_submitted':
      return { tone: 'valid', title: 'Valid ticket', note: 'Seat reserved. Balance payment is being verified.' };
    case 'completed':
      return { tone: 'warn', title: 'Trip completed', note: 'This ticket was for a trip that has already finished.' };
    case 'cancelled':
      return { tone: 'invalid', title: 'Ticket cancelled', note: 'This booking was cancelled and is no longer valid.' };
    default:
      return { tone: 'warn', title: 'Not confirmed yet', note: 'This booking has not been confirmed yet.' };
  }
}

/** "Rahul Sharma" → "Rahul S." */
function maskName(name?: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

const TONE = {
  valid: { panel: 'bg-emerald-600', ring: 'bg-white/15', Icon: ShieldCheck },
  warn: { panel: 'bg-amber-500', ring: 'bg-white/20', Icon: ShieldAlert },
  invalid: { panel: 'bg-red-600', ring: 'bg-white/15', Icon: ShieldX },
};

export default async function VerifyTicketPage({ params }: { params: { id: string } }) {
  const id = String(params.id || '');
  const ticket = UUID_RE.test(id) ? await loadTicketData(id).catch(() => null) : null;
  const checkedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const verdict: Verdict = ticket
    ? verdictFor(ticket.status)
    : { tone: 'invalid', title: 'Ticket not found', note: 'We could not find a booking for this code. The ticket may be fake or mistyped.' };
  const tone = TONE[verdict.tone];
  const lead = ticket?.passengers.find((p) => p.isPrimary) || ticket?.passengers[0];

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-white pt-20 pb-28 px-4">
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-700">
          Ghumakkars ticket check
        </p>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-purple-900/5 ring-1 ring-gray-100">
          {/* Verdict */}
          <div className={`${tone.panel} px-6 py-7 text-center text-white`}>
            <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${tone.ring}`}>
              <tone.Icon className="h-9 w-9" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-bold">{verdict.title}</h1>
            <p className="mt-1 text-sm text-white/90">{verdict.note}</p>
            {ticket && (
              <p className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-[0.15em]">
                REF #{ticket.ref}
              </p>
            )}
          </div>

          {/* Trip details */}
          {ticket && (
            <div className="px-6 py-5">
              <h2 className="text-lg font-bold leading-snug text-gray-900">{ticket.tripTitle}</h2>
              {ticket.destination && <p className="text-sm text-gray-500">{ticket.destination}</p>}

              <dl className="mt-4 divide-y divide-gray-100 text-sm">
                <Row icon={<CalendarDays className="h-4 w-4" />} label="Travel dates" value={`${ticket.departure} → ${ticket.ret}`} />
                <Row icon={<User className="h-4 w-4" />} label="Lead traveller" value={maskName(lead?.name)} />
                <Row icon={<Users className="h-4 w-4" />} label="Travellers" value={`${ticket.travellers} ${ticket.travellers === 1 ? 'person' : 'people'}`} />
                {ticket.pickupPoint && <Row icon={<MapPin className="h-4 w-4" />} label="Pickup point" value={ticket.pickupPoint} />}
              </dl>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            Checked live on {checkedAt} IST
          </div>
        </div>

        <div className="mt-5 space-y-2 text-center text-sm">
          {ticket && (
            <p className="text-gray-600">
              Is this your booking?{' '}
              <Link href={`/bookings/${id}`} className="font-semibold text-purple-700 hover:underline">
                Open full details
              </Link>
            </p>
          )}
          <p className="text-gray-500">
            Questions? Call{' '}
            <a href="tel:+918218020972" className="font-medium text-gray-700 hover:underline">+91 82180 20972</a>
          </p>
        </div>
      </div>
    </main>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-purple-600">{icon}</span>
      <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
      <dd className="flex-1 font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
