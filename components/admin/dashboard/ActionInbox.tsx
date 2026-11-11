'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { isTypingTarget } from '@/components/admin/live/events';
import {
  Inbox, Receipt, Banknote, Clock, TrendingDown, Bug, CheckCircle2, ChevronDown, Loader2, Send, ArrowRight,
} from 'lucide-react';
import { Card, inr, fmtDay, timeAgo, daysLabel } from './utils';
import type { ApprovalItem } from './PaymentReviewDialog';

interface CashItem { kind: 'cash'; bookingId: string; createdAt: string; name: string; phone: string | null; trip: string; departure: string | null; amount: number }
interface DueItem { kind: 'due'; bookingId: string; name: string; phone: string | null; trip: string; departure: string; daysAway: number; amount: number }
interface LowFillItem { kind: 'lowfill'; tripId: string; trip: string; departure: string; daysAway: number; pax: number; capacity: number }

export interface InboxData {
  approvals: ApprovalItem[];
  cashPending: CashItem[];
  dueSoon: DueItem[];
  lowFill: LowFillItem[];
}

const COLLAPSED_ROWS = 5;

const rowBtn = 'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50';

function Row({ icon, tone, title, meta, actions, selected = false, idx }: { icon: React.ReactNode; tone: string; title: React.ReactNode; meta: React.ReactNode; actions: React.ReactNode; selected?: boolean; idx?: number }) {
  return (
    <li data-inbox-idx={idx} className={`relative flex items-center gap-3 px-4 py-2.5 transition-colors ${selected ? 'bg-violet-50/60' : 'hover:bg-slate-50/70'}`}>
      {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-violet-500" />}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-900">{title}</p>
        <p className="truncate text-[11px] text-slate-500">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </li>
  );
}

/**
 * Everything that is waiting on an admin, each with the action that resolves it.
 * Ordered by urgency: money to verify → money in person → balances before
 * departure → under-filled departures → system errors.
 */
export default function ActionInbox({
  inbox,
  unresolvedErrors,
  onReview,
  onRemind,
}: {
  inbox: InboxData;
  unresolvedErrors: number;
  onReview: (a: ApprovalItem) => void;
  onRemind: (bookingIds: string[], label: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  const remind = async (ids: string[], key: string, label: string) => {
    setSending(key);
    try {
      await onRemind(ids, label);
      setReminded((s) => new Set([...Array.from(s), ...ids]));
    } catch {
      /* the page already showed an error toast */
    } finally {
      setSending(null);
    }
  };

  const router = useRouter();
  const { overlayOpen } = useAdminLive();
  const [sel, setSel] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  type RowDef = { key: string; node: React.ReactNode; open: () => void; approve?: () => void; remind?: () => void };
  const rows: RowDef[] = [];
  // Row index at push time — used to mark the keyboard selection.
  const at = () => rows.length;

  inbox.approvals.forEach((a) =>
    rows.push({
      key: `a-${a.txnId}`,
      open: () => onReview(a),
      approve: () => onReview(a),
      node: (
        <Row
          idx={at()}
          selected={sel === at()}
          icon={<Receipt className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-600"
          title={<>{a.name} paid <span className="tabular-nums">{inr(a.amount)}</span>{a.method ? <span className="font-normal text-slate-500"> via {a.method.toUpperCase()}</span> : null}</>}
          meta={<>{a.trip} · {fmtDay(a.departure)}{a.reference ? <> · <span className="font-mono">{a.reference}</span></> : null} · {timeAgo(a.createdAt)}</>}
          actions={<button onClick={() => onReview(a)} className={`${rowBtn} border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100`}>Review</button>}
        />
      ),
    }),
  );

  inbox.cashPending.forEach((c) =>
    rows.push({
      key: `c-${c.bookingId}`,
      open: () => router.push(`/admin/bookings/${c.bookingId}`),
      node: (
        <Row
          idx={at()}
          selected={sel === at()}
          icon={<Banknote className="h-4 w-4" />}
          tone="bg-amber-50 text-amber-600"
          title={<>{c.name} will pay <span className="tabular-nums">{inr(c.amount)}</span> in person</>}
          meta={<>{c.trip} · {fmtDay(c.departure)} · {timeAgo(c.createdAt)}</>}
          actions={<Link href={`/admin/bookings/${c.bookingId}`} className={rowBtn}>Record cash</Link>}
        />
      ),
    }),
  );

  inbox.dueSoon.forEach((d) => {
    const done = reminded.has(d.bookingId);
    rows.push({
      key: `d-${d.bookingId}`,
      open: () => router.push(`/admin/bookings/${d.bookingId}`),
      remind: d.phone && !done ? () => remind([d.bookingId], `d-${d.bookingId}`, d.name) : undefined,
      node: (
        <Row
          idx={at()}
          selected={sel === at()}
          icon={<Clock className="h-4 w-4" />}
          tone={d.daysAway <= 2 ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'}
          title={<>{d.name} owes <span className="tabular-nums">{inr(d.amount)}</span></>}
          meta={<>{d.trip} · departs {d.daysAway <= 1 ? daysLabel(d.daysAway).toLowerCase() : `in ${d.daysAway} days`} ({fmtDay(d.departure)}){!d.phone ? ' · no phone' : ''}</>}
          actions={
            <>
              <Link href={`/admin/bookings/${d.bookingId}`} className={`${rowBtn} hidden sm:inline-flex`}>Open</Link>
              <button
                disabled={!d.phone || done || sending !== null}
                onClick={() => remind([d.bookingId], `d-${d.bookingId}`, d.name)}
                className={`${rowBtn} ${done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}`}
                title={d.phone ? 'Send a WhatsApp balance reminder' : 'No phone number on this booking'}
              >
                {sending === `d-${d.bookingId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <CheckCircle2 className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                {done ? 'Sent' : 'Remind'}
              </button>
            </>
          }
        />
      ),
    });
  });

  inbox.lowFill.forEach((l) =>
    rows.push({
      key: `l-${l.tripId}-${l.departure}`,
      open: () => router.push(`/admin/trips/${l.tripId}`),
      node: (
        <Row
          idx={at()}
          selected={sel === at()}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="bg-slate-100 text-slate-500"
          title={<>{l.trip} is only <span className="tabular-nums">{l.pax}/{l.capacity}</span> full</>}
          meta={<>Departs {l.daysAway <= 1 ? daysLabel(l.daysAway).toLowerCase() : `in ${l.daysAway} days`} ({fmtDay(l.departure)}) · consider promoting or a coupon</>}
          actions={<Link href={`/admin/trips/${l.tripId}`} className={rowBtn}>View trip</Link>}
        />
      ),
    }),
  );

  if (unresolvedErrors > 0)
    rows.push({
      key: 'errors',
      open: () => router.push('/admin/error-logs'),
      node: (
        <Row
          idx={at()}
          selected={sel === at()}
          icon={<Bug className="h-4 w-4" />}
          tone="bg-rose-50 text-rose-600"
          title={<>{unresolvedErrors} unresolved error{unresolvedErrors > 1 ? 's' : ''}</>}
          meta="Logged by the website or API"
          actions={<Link href="/admin/error-logs" className={rowBtn}>View</Link>}
        />
      ),
    });

  // Keyboard: J/K move, Enter opens, A reviews a payment, R sends a reminder.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const list = rowsRef.current;
      if (list.length === 0) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'k') {
        e.preventDefault();
        setSel((i) => {
          const next = k === 'j' ? Math.min(i + 1, list.length - 1) : Math.max(i - 1, 0);
          if (next >= COLLAPSED_ROWS) setExpanded(true);
          return next;
        });
        return;
      }
      const row = sel >= 0 ? list[sel] : undefined;
      if (!row) return;
      if (e.key === 'Enter') { e.preventDefault(); row.open(); }
      else if (k === 'a' && row.approve) { e.preventDefault(); row.approve(); }
      else if (k === 'r' && row.remind) { e.preventDefault(); row.remind(); }
      else if (e.key === 'Escape') setSel(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen, sel]);

  useEffect(() => {
    if (sel >= rows.length) setSel(rows.length - 1);
    if (sel >= 0) listRef.current?.querySelector(`[data-inbox-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel, rows.length]);

  // Nothing waiting → one quiet line instead of an empty card.
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="font-medium">All clear</span>
        <span className="text-emerald-700/80">— no payments to review, no balances due this week.</span>
      </div>
    );
  }

  const pendingDueIds = inbox.dueSoon.filter((d) => d.phone && !reminded.has(d.bookingId)).map((d) => d.bookingId);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const counts = [
    inbox.approvals.length && `${inbox.approvals.length} to review`,
    inbox.cashPending.length && `${inbox.cashPending.length} cash`,
    inbox.dueSoon.length && `${inbox.dueSoon.length} due soon`,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Inbox className="h-4 w-4 text-slate-400" />
        <h2 className="text-[13px] font-semibold text-slate-900">Needs your attention</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-700">{rows.length}</span>
        {counts.length > 0 && <span className="hidden text-[11px] text-slate-400 sm:inline">{counts.join(' · ')}</span>}
        <span className="hidden text-[11px] text-slate-300 xl:inline">· <kbd className="font-sans">J</kbd>/<kbd className="font-sans">K</kbd> to move</span>
        <div className="ml-auto flex items-center gap-2">
          {pendingDueIds.length > 1 && (
            <button
              disabled={sending !== null}
              onClick={() => remind(pendingDueIds, 'all', `${pendingDueIds.length} travellers`)}
              className={`${rowBtn} border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50`}
            >
              {sending === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Remind all {pendingDueIds.length}
            </button>
          )}
          <Link href="/admin/bookings" className="hidden items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 sm:inline-flex">
            Bookings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <ul ref={listRef} className="divide-y divide-slate-100">{shown.map((r) => <Fragment key={r.key}>{r.node}</Fragment>)}</ul>
      {rows.length > COLLAPSED_ROWS && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          {expanded ? 'Show less' : `Show ${rows.length - COLLAPSED_ROWS} more`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </Card>
  );
}
