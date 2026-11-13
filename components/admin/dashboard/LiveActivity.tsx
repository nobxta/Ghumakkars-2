'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { EventIcon } from '@/components/admin/live/events';
import { Card, Skeleton, timeAgo } from './utils';

const SHOW = 20;

/** Newest sign-ups, bookings, payments and cancellations — fed by the admin live provider. */
export default function LiveActivity({ className = '' }: { className?: string }) {
  const { events, loaded, lastSeen, openReview } = useAdminLive();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);

  return (
    <Card className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <h2 className="text-[13px] font-semibold text-slate-900">Live activity</h2>
        <span className="ml-auto text-[11px] text-slate-400">auto-updates</span>
      </div>
      {!loaded ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : events.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">No activity in the last two weeks.</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {events.slice(0, SHOW).map((e) => {
            const isNew = new Date(e.at).getTime() > lastSeen;
            return (
              <li key={e.id} className="flex items-center gap-2.5 px-4 py-2">
                <EventIcon type={e.type} size="h-7 w-7" />
                <Link href={e.href} className="min-w-0 flex-1 hover:text-violet-700">
                  <p className="truncate text-xs font-medium text-slate-800">{e.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{e.meta}</p>
                </Link>
                {e.type === 'payment_pending' && e.approval ? (
                  <button onClick={() => openReview(e.approval)} className="shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">Review</button>
                ) : (
                  <span className={`shrink-0 text-[10px] ${isNew ? 'font-semibold text-violet-600' : 'text-slate-400'}`}>{timeAgo(e.at).replace(' ago', '')}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
