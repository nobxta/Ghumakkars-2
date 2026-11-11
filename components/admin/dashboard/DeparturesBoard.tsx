'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight, Users, Send, Loader2, Download } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, inrShort, inr, fmtDay } from './utils';

export interface Departure {
  key: string;
  tripId: string;
  date: string;
  daysAway: number;
  title: string;
  destination: string;
  cover: string | null;
  capacity: number;
  pax: number;
  bookings: number;
  collected: number;
  due: number;
  dueBookingIds: string[];
  pendingReview: number;
}

const countdownTone = (d: number) =>
  d <= 2 ? 'bg-rose-50 text-rose-700 ring-rose-200' : d <= 6 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-50 text-slate-600 ring-slate-200';

const fillTone = (pct: number) => (pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-violet-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400');

/** Next 14 days of departures — countdown, seats, money due, one-click chase. */
export default function DeparturesBoard({
  departures,
  onRemind,
}: {
  departures: Departure[];
  onRemind: (bookingIds: string[], label: string) => Promise<void>;
}) {
  const [sending, setSending] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<CalendarDays className="h-4 w-4" />}
        title="Departures"
        right={
          <>
            <span className="text-[11px] text-slate-400">Next 14 days</span>
            <Link href="/admin/trips" className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
              All trips <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        }
      />
      {departures.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">No departures in the next two weeks</p>
          <p className="mt-0.5 text-xs text-slate-500">Schedule a trip so customers have something to book.</p>
          <Link href="/admin/trips/create" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
            Create trip
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {departures.map((d) => {
            const pct = d.capacity > 0 ? Math.min(100, Math.round((d.pax / d.capacity) * 100)) : d.pax > 0 ? 100 : 0;
            return (
              <li key={d.key} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/70">
                {/* Countdown chip */}
                <div className={`flex w-14 shrink-0 flex-col items-center rounded-lg py-1 ring-1 ring-inset ${countdownTone(d.daysAway)}`}>
                  <span className="text-[13px] font-bold leading-tight">{d.daysAway <= 0 ? 'Today' : `${d.daysAway}d`}</span>
                  <span className="text-[10px] leading-tight opacity-80">{fmtDay(d.date)}</span>
                </div>

                {d.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.cover} alt="" className="hidden h-9 w-9 shrink-0 rounded-lg border border-slate-100 object-cover sm:block" />
                ) : (
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 sm:flex"><MapPin className="h-4 w-4 text-violet-300" /></div>
                )}

                <Link href={`/admin/trips/${d.tripId}`} className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-violet-700">{d.title}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {fmtDay(d.date, true)}
                    {d.bookings > 0 && <> · {d.bookings} booking{d.bookings > 1 ? 's' : ''}</>}
                    {d.pendingReview > 0 && <span className="font-medium text-amber-600"> · {d.pendingReview} to review</span>}
                  </p>
                </Link>

                {/* Money */}
                <div className="hidden w-20 shrink-0 text-right tabular-nums md:block">
                  <p className="text-xs font-semibold text-emerald-700" title={`${inr(d.collected)} collected`}>{inrShort(d.collected)}</p>
                  <p className={`text-[11px] ${d.due > 0 ? 'font-medium text-orange-600' : 'text-slate-400'}`} title={d.due > 0 ? `${inr(d.due)} still due` : undefined}>
                    {d.due > 0 ? `${inrShort(d.due)} due` : 'nothing due'}
                  </p>
                </div>

                {/* Seats */}
                <div className="w-20 shrink-0 sm:w-28">
                  <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums">
                    <span className="flex items-center gap-1 font-semibold text-slate-700"><Users className="h-3 w-3 text-slate-400" />{d.pax}{d.capacity > 0 ? `/${d.capacity}` : ''}</span>
                    {d.capacity > 0 && <span className={pct >= 100 ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{pct >= 100 ? 'Full' : `${pct}%`}</span>}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${fillTone(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Quick actions: passenger list + chase all balances on this departure */}
                <div className="hidden w-16 shrink-0 items-center justify-end gap-0.5 lg:flex">
                  {d.bookings > 0 && (
                    <a
                      href={`/api/admin/dashboard/passengers?tripId=${d.tripId}&date=${d.date}`}
                      download
                      title="Download passenger list (CSV)"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {d.dueBookingIds.length > 0 && (
                    <button
                      onClick={async () => {
                        setSending(d.key);
                        try { await onRemind(d.dueBookingIds, `${d.dueBookingIds.length} traveller${d.dueBookingIds.length > 1 ? 's' : ''} on ${d.title}`); } catch { /* toast shown by page */ } finally { setSending(null); }
                      }}
                      disabled={sending !== null}
                      title={`WhatsApp a balance reminder to ${d.dueBookingIds.length} traveller${d.dueBookingIds.length > 1 ? 's' : ''}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-emerald-50 hover:text-emerald-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {sending === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
