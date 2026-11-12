'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, CreditCard, ExternalLink, KeyRound, Mail,
  Monitor, MoreHorizontal, RefreshCw, RotateCcw, Search, Server, Shield, Smartphone, Sparkles, Tablet, Ticket,
  Trash2, User, UserX, Webhook, X,
} from 'lucide-react';
import { explainLog, issueKey, KIND_META, type LogExplanation, type LogKind } from '@/lib/log-explain';

export interface ErrorLog {
  id: string;
  created_at: string;
  level: 'error' | 'warning';
  category: string;
  process: string;
  message: string;
  code: string | null;
  user_id: string | null;
  user_email: string | null;
  booking_id: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  ip: string | null;
  user_agent: string | null;
  device: string | null;
  details: Record<string, any> | null;
  resolved: boolean;
}

/* ------------------------------------------------------------------ */
/* Look & labels                                                       */
/* ------------------------------------------------------------------ */

const AREAS: Record<string, { label: string; icon: typeof Mail }> = {
  payment: { label: 'Payments', icon: CreditCard },
  otp: { label: 'Login & OTP', icon: KeyRound },
  auth: { label: 'Accounts', icon: User },
  email: { label: 'Emails', icon: Mail },
  booking: { label: 'Bookings', icon: Ticket },
  webhook: { label: 'Integrations', icon: Webhook },
  admin: { label: 'Admin panel', icon: Shield },
  system: { label: 'Website', icon: Server },
};
const AREA_ORDER = ['payment', 'booking', 'otp', 'auth', 'email', 'webhook', 'admin', 'system'];
const areaOf = (key: string) => AREAS[key] || AREAS.system;

const KIND_STYLE: Record<LogKind, { dot: string; text: string; bg: string; ring: string }> = {
  problem: { dot: 'bg-[#E5484D]', text: 'text-[#C62A2F]', bg: 'bg-[#FFF0F0]', ring: 'border-[#FBD5D6]' },
  customer: { dot: 'bg-[#F5A524]', text: 'text-[#A35200]', bg: 'bg-[#FFF7E6]', ring: 'border-[#F9E1B4]' },
  routine: { dot: 'bg-[#A1A3AD]', text: 'text-[#55575F]', bg: 'bg-[#F4F4F6]', ring: 'border-[#E7E8EE]' },
};

const RANGES = [
  { key: '1', label: 'Last 24 hours', ms: 1 },
  { key: '7', label: 'Last 7 days', ms: 7 },
  { key: '30', label: 'Last 30 days', ms: 30 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

type Tab = LogKind | 'timeline';

const DAY = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function ago(iso: string | Date) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} hr ago`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function dayLabel(d: Date) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - t.getTime()) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return dayFmt.format(d);
}

function who(log: ErrorLog) {
  if (log.user_email) return log.user_email;
  if (log.category === 'admin') return 'An admin';
  if (log.category === 'webhook') return 'An outside service';
  return 'A visitor (not logged in)';
}

function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const Icon = !device ? Monitor
    : device.includes('Server') ? Server
    : device.includes('Tablet') ? Tablet
    : device.includes('Mobile') ? Smartphone
    : Monitor;
  return <Icon className={className} />;
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

interface Issue {
  key: string;
  explanation: LogExplanation;
  category: string;
  logs: ErrorLog[]; // newest first
  open: number;
  people: number;
  last: string;
  first: string;
  cameBack: boolean;
}

type ExplainedLog = ErrorLog & { x: LogExplanation; key: string };

function buildIssues(logs: ExplainedLog[]): Issue[] {
  const map = new Map<string, ExplainedLog[]>();
  for (const l of logs) {
    const list = map.get(l.key);
    if (list) list.push(l); else map.set(l.key, [l]);
  }
  return [...map.entries()].map(([key, list]) => {
    const open = list.filter((l) => !l.resolved).length;
    const newestResolvedIdx = list.findIndex((l) => l.resolved);
    return {
      key,
      explanation: list[0].x,
      category: list[0].category,
      logs: list,
      open,
      people: new Set(list.map((l) => l.user_email || l.ip || l.id)).size,
      last: list[0].created_at,
      first: list[list.length - 1].created_at,
      cameBack: open > 0 && newestResolvedIdx > 0,
    };
  }).sort((a, b) => (b.open > 0 ? 1 : 0) - (a.open > 0 ? 1 : 0) || b.last.localeCompare(a.last));
}

/** Plain-text report for pasting into a chat with a developer. */
function developerReport(issue: Issue) {
  const latest = issue.logs[0];
  const lines = [
    `${issue.explanation.title}`,
    `Happened ${issue.logs.length} time(s), last ${fullFmt.format(new Date(latest.created_at))}`,
    '',
    `Area: ${areaOf(latest.category).label} · Process: ${latest.process}`,
    `Raw message: ${latest.message}`,
    latest.code && `Code: ${latest.code}`,
    latest.route && `Request: ${[latest.method, latest.route].filter(Boolean).join(' ')}`,
    latest.user_email && `User: ${latest.user_email}`,
    latest.booking_id && `Booking: ${latest.booking_id}`,
    latest.device && `Device: ${latest.device}`,
    latest.details && `Details: ${JSON.stringify(latest.details, null, 2)}`,
  ];
  return lines.filter((l) => typeof l === 'string').join('\n');
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

interface ErrorLogsViewProps {
  logs: ErrorLog[];
  loading?: boolean;
  refreshing?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  onSetResolved?: (ids: string[], resolved: boolean) => void;
  onResolveAll?: () => void;
  onClearResolved?: () => void;
  onClearRoutine?: () => void;
  onClearAll?: () => void;
}

export default function ErrorLogsView({
  logs, loading, refreshing, lastUpdated, onRefresh, onSetResolved, onResolveAll, onClearResolved, onClearRoutine, onClearAll,
}: ErrorLogsViewProps) {
  const [tab, setTab] = useState<Tab>('problem');
  const [range, setRange] = useState<RangeKey>('7');
  const [area, setArea] = useState('all');
  const [search, setSearch] = useState('');
  const [showFixed, setShowFixed] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [, tick] = useState(0);

  // Keep "x min ago" labels fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const explained = useMemo<ExplainedLog[]>(
    () => logs
      .map((l) => ({ ...l, x: explainLog(l), key: issueKey(l) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [logs],
  );

  const filtered = useMemo(() => {
    const since = Date.now() - (RANGES.find((r) => r.key === range)?.ms ?? 7) * DAY;
    const q = search.trim().toLowerCase();
    return explained.filter((l) => {
      if (new Date(l.created_at).getTime() < since) return false;
      if (area !== 'all' && l.category !== area) return false;
      if (!q) return true;
      return [l.x.title, l.x.summary, l.process, l.message, l.code, l.user_email, l.booking_id, l.device]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [explained, range, area, search]);

  const issuesByKind = useMemo(() => {
    const all = buildIssues(filtered);
    return {
      problem: all.filter((i) => i.explanation.kind === 'problem'),
      customer: all.filter((i) => i.explanation.kind === 'customer'),
      routine: all.filter((i) => i.explanation.kind === 'routine'),
    };
  }, [filtered]);

  // Health banner always looks at the whole table, not the filters.
  const health = useMemo(() => {
    const openProblems = buildIssues(explained.filter((l) => l.x.kind === 'problem' && !l.resolved));
    const weekAgo = Date.now() - 7 * DAY;
    const recent = explained.filter((l) => new Date(l.created_at).getTime() >= weekAgo);
    return {
      openProblems,
      customer: recent.filter((l) => l.x.kind === 'customer').length,
      routine: recent.filter((l) => l.x.kind === 'routine').length,
    };
  }, [explained]);

  const openProblemCount = issuesByKind.problem.filter((i) => i.open > 0).length;
  const visibleIssues = tab === 'timeline' ? [] : tab === 'problem' && !showFixed
    ? issuesByKind.problem.filter((i) => i.open > 0)
    : issuesByKind[tab];

  // The drawer reads from the full list so it stays open while filters change.
  const allIssues = useMemo(() => buildIssues(explained), [explained]);
  const selected = selectedKey ? allIssues.find((i) => i.key === selectedKey) || null : null;

  const filtersActive = area !== 'all' || search.trim() !== '' || range !== '7';
  const clearFilters = () => { setArea('all'); setSearch(''); setRange('7'); };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-5" aria-busy="true">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-[#ECEDF2]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#ECEDF2]" />
        <div className="h-11 animate-pulse rounded-xl bg-[#ECEDF2]" />
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#ECEDF2]" />)}
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'problem', label: 'Needs attention', count: openProblemCount },
    { key: 'customer', label: 'Customer-side', count: issuesByKind.customer.length },
    { key: 'routine', label: 'Routine', count: issuesByKind.routine.length },
    { key: 'timeline', label: 'Timeline', count: filtered.length },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-fade-in-up">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#17171C] sm:text-[28px]">Error Logs</h1>
          <p className="mt-1 text-sm text-[#666873]">
            What went wrong on the website, explained in plain English.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden text-xs text-[#8A8C96] sm:inline">Updated {ago(lastUpdated)}</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E8EE] bg-white px-3 text-sm font-medium text-[#17171C] transition hover:border-[#C9CBD3]"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <MoreMenu
            items={[
              { label: 'Mark every problem fixed', icon: CheckCircle2, onClick: onResolveAll, disabled: !logs.some((l) => !l.resolved) },
              { label: 'Delete fixed logs', icon: Trash2, onClick: onClearResolved, disabled: !logs.some((l) => l.resolved) },
              { label: 'Delete routine activity', icon: Trash2, onClick: onClearRoutine, disabled: !logs.some((l) => l.level === 'warning') },
              { label: 'Delete all logs', icon: Trash2, onClick: onClearAll, disabled: logs.length === 0, danger: true },
            ]}
          />
        </div>
      </header>

      {/* ---------- Health ---------- */}
      <HealthBanner
        openProblems={health.openProblems}
        customer={health.customer}
        routine={health.routine}
        onOpen={(key) => setSelectedKey(key)}
        onShowTab={(t) => setTab(t)}
      />

      {/* ---------- Tabs ---------- */}
      <nav
        className="mt-6 -mx-3 overflow-x-auto border-b border-[#E7E8EE] px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Log views"
      >
        <div className="flex w-max gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={(e) => {
                setTab(t.key);
                e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
              }}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`-mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
                tab === t.key ? 'border-[#8758F6] text-[#17171C]' : 'border-transparent text-[#666873] hover:text-[#17171C]'
              }`}
            >
              {t.key !== 'timeline' && <span className={`h-2 w-2 rounded-full ${KIND_STYLE[t.key].dot}`} />}
              {t.key === 'timeline' && <Clock className="h-3.5 w-3.5" />}
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                tab === t.key
                  ? t.key === 'problem' && t.count > 0 ? 'bg-[#FFF0F0] text-[#C62A2F]' : 'bg-[#F1EBFF] text-[#6D3FE0]'
                  : 'bg-[#F1F2F5] text-[#666873]'
              }`}>{t.count}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ---------- Tab intro + filters ---------- */}
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="text-sm text-[#666873]">
          {tab === 'timeline' ? 'Every event, newest first. Click one to see what it means.' : KIND_META[tab].description}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:min-w-[240px] sm:flex-1 xl:w-64 xl:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8C96]" />
            <input
              type="search"
              placeholder="Search email, booking, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E7E8EE] bg-white pl-9 pr-3 text-sm text-[#17171C] outline-none transition placeholder:text-[#8A8C96] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10"
            />
          </div>
          <Select value={area} onChange={setArea} label="Area">
            <option value="all">All areas</option>
            {AREA_ORDER.map((k) => <option key={k} value={k}>{AREAS[k].label}</option>)}
          </Select>
          <Select value={range} onChange={(v) => setRange(v as RangeKey)} label="Time range">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          {tab === 'problem' && (
            <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-[#E7E8EE] bg-white px-3 text-sm text-[#17171C]">
              <input
                type="checkbox"
                checked={showFixed}
                onChange={(e) => setShowFixed(e.target.checked)}
                className="h-4 w-4 accent-[#8758F6]"
              />
              Show fixed
            </label>
          )}
        </div>
      </div>

      {/* ---------- Content ---------- */}
      <section className="mt-4">
        {tab === 'timeline' ? (
          <Timeline logs={filtered} onOpen={(key) => setSelectedKey(key)} emptyNode={
            <EmptyState filtersActive={filtersActive} onClear={clearFilters} kind="timeline" />
          } />
        ) : visibleIssues.length === 0 ? (
          <EmptyState filtersActive={filtersActive} onClear={clearFilters} kind={tab} />
        ) : (
          <ul className="space-y-3">
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.key}
                issue={issue}
                onOpen={() => setSelectedKey(issue.key)}
                onSetResolved={onSetResolved}
              />
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-8 flex items-start gap-2 rounded-xl border border-dashed border-[#E0E1E8] px-4 py-3 text-xs leading-relaxed text-[#8A8C96]">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Logs clean themselves up: fixed items after 3 days, routine activity after 7 days, everything else after 30 days.
          Refreshes every minute while this page is open.
        </span>
      </footer>

      {selected && (
        <IssueDrawer issue={selected} onClose={() => setSelectedKey(null)} onSetResolved={onSetResolved} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function HealthBanner({ openProblems, customer, routine, onOpen, onShowTab }: {
  openProblems: Issue[]; customer: number; routine: number;
  onOpen: (key: string) => void; onShowTab: (t: Tab) => void;
}) {
  if (openProblems.length === 0) {
    return (
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#CDEBD7] bg-[#F0FAF3] p-4 sm:items-center sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DDF3E4] text-[#218358]">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#17171C]">Everything is working. Nothing needs your attention.</p>
          <p className="mt-0.5 text-sm text-[#4B5E52]">
            This week: {customer} customer-side {customer === 1 ? 'issue' : 'issues'} and {routine} routine{' '}
            {routine === 1 ? 'event' : 'events'}. No action needed.
          </p>
        </div>
      </div>
    );
  }

  const top = openProblems.slice(0, 3);
  return (
    <div className="mt-5 rounded-2xl border border-[#FBD5D6] bg-[#FFF5F5] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFE3E3] text-[#C62A2F]">
          <AlertOctagon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#17171C]">
            {openProblems.length} website {openProblems.length === 1 ? 'problem needs' : 'problems need'} your attention
          </p>
          <p className="mt-0.5 text-sm text-[#7A4A4C]">Open one to see what happened and what to do.</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-[#FBE0E1] overflow-hidden rounded-xl border border-[#FBE0E1] bg-white sm:ml-[52px]">
        {top.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              onClick={() => onOpen(i.key)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[#FFF8F8]"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#17171C]">{i.explanation.title}</span>
              <span className="shrink-0 text-xs text-[#8A8C96]">{ago(i.last)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#B0B2BA]" />
            </button>
          </li>
        ))}
      </ul>
      {openProblems.length > top.length && (
        <button
          type="button"
          onClick={() => onShowTab('problem')}
          className="mt-2 text-sm font-semibold text-[#C62A2F] hover:underline sm:ml-[52px]"
        >
          See all {openProblems.length}
        </button>
      )}
    </div>
  );
}

function IssueCard({ issue, onOpen, onSetResolved }: {
  issue: Issue; onOpen: () => void; onSetResolved?: (ids: string[], resolved: boolean) => void;
}) {
  const { explanation: x } = issue;
  const style = KIND_STYLE[x.kind];
  const Area = areaOf(issue.category);
  const AreaIcon = Area.icon;
  const isFixed = issue.open === 0;
  const times = issue.logs.length;

  return (
    <li
      className={`group relative rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(23,23,28,0.04)] transition hover:border-[#C9CBD3] hover:shadow-[0_6px_20px_rgba(23,23,28,0.06)] sm:p-5 ${
        isFixed && x.kind === 'problem' ? 'border-[#E7E8EE] opacity-70' : 'border-[#E7E8EE]'
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.text}`}>
          <AreaIcon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[15px] font-semibold leading-snug text-[#17171C]">
              {/* The title button covers the whole card, so anywhere opens the details. */}
              <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-2xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#8758F6]">
                {x.title}
              </button>
            </h3>
            {times > 1 && (
              <span className="shrink-0 rounded-full bg-[#F1F2F5] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#3A3B42]">
                {times}×
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#55575F]">{x.summary}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8A8C96]">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Last {ago(issue.last)}</span>
            {times > 1 && <span>Since {dayFmt.format(new Date(issue.first))}</span>}
            <span>{issue.people} {issue.people === 1 ? 'person' : 'people'}</span>
            <span>{Area.label}</span>
            {isFixed && x.kind === 'problem' && (
              <span className="inline-flex items-center gap-1 font-medium text-[#218358]"><CheckCircle2 className="h-3 w-3" />Fixed</span>
            )}
            {issue.cameBack && (
              <span className="inline-flex items-center gap-1 font-medium text-[#C62A2F]"><RotateCcw className="h-3 w-3" />Came back after being fixed</span>
            )}
          </div>

          {x.kind !== 'routine' && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="rounded-lg bg-[#F7F8FC] px-3 py-2 text-[13px] leading-relaxed text-[#3A3B42] sm:flex-1">
                <span className="font-semibold text-[#17171C]">What to do: </span>{x.action}
              </p>
              {x.kind === 'problem' && (
                <button
                  type="button"
                  onClick={() => onSetResolved?.(issue.logs.map((l) => l.id), !isFixed)}
                  className={`relative z-10 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition ${
                    isFixed
                      ? 'border border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#C9CBD3]'
                      : 'bg-[#17171C] text-white hover:bg-[#2B2B33]'
                  }`}
                >
                  {isFixed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isFixed ? 'Reopen' : 'Mark fixed'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Timeline({ logs, onOpen, emptyNode }: {
  logs: ExplainedLog[]; onOpen: (key: string) => void; emptyNode: React.ReactNode;
}) {
  const [limit, setLimit] = useState(150);
  useEffect(() => setLimit(150), [logs]);

  const days = useMemo(() => {
    const out: { label: string; items: ExplainedLog[] }[] = [];
    for (const l of logs.slice(0, limit)) {
      const label = dayLabel(new Date(l.created_at));
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(l); else out.push({ label, items: [l] });
    }
    return out;
  }, [logs, limit]);

  if (logs.length === 0) return <>{emptyNode}</>;

  return (
    <div className="space-y-6">
      {days.map((d) => (
        <div key={d.label}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#666873]">
            {d.label}
            <span className="font-medium normal-case tracking-normal text-[#A1A3AD]">{d.items.length} {d.items.length === 1 ? 'event' : 'events'}</span>
          </h3>
          <ol className="overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white">
            {d.items.map((l, idx) => {
              const style = KIND_STYLE[l.x.kind];
              return (
                <li key={l.id} className={idx > 0 ? 'border-t border-[#F0F1F5]' : ''}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.key)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#FAFAFD] focus:bg-[#FAFAFD] focus:outline-none"
                  >
                    <span className="w-[64px] shrink-0 pt-0.5 text-xs tabular-nums text-[#8A8C96]">
                      {timeFmt.format(new Date(l.created_at))}
                    </span>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-label={KIND_META[l.x.kind].short} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium text-[#17171C] ${l.resolved ? 'line-through decoration-[#C6C8D0]' : ''}`}>
                        {l.x.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#8A8C96]">
                        {who(l)} · {areaOf(l.category).label}
                        {l.device ? ` · ${l.device.split(' · ').slice(0, 2).join(' on ')}` : ''}
                      </span>
                    </span>
                    <ChevronRight className="mt-0.5 hidden h-4 w-4 shrink-0 text-[#C6C8D0] sm:block" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {logs.length > limit && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + 150)}
            className="inline-flex h-9 items-center rounded-lg border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] hover:border-[#C9CBD3]"
          >
            Show older ({logs.length - limit} more)
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ kind, filtersActive, onClear }: { kind: Tab; filtersActive: boolean; onClear: () => void }) {
  const copy: Record<Tab, [string, string]> = {
    problem: ['No website problems', 'Nothing on the site is broken right now.'],
    customer: ['No customer-side issues', 'No declined payments or connection problems in this period.'],
    routine: ['No routine activity', 'No typos, wrong OTPs or incomplete forms in this period.'],
    timeline: ['Nothing logged', 'No events in this period.'],
  };
  const [title, sub] = copy[kind];
  return (
    <div className="rounded-2xl border border-[#E7E8EE] bg-white px-6 py-14 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-[#30A46C]" />
      <p className="text-sm font-semibold text-[#17171C]">{title}</p>
      <p className="mt-1 text-sm text-[#666873]">{sub}</p>
      {filtersActive && (
        <button type="button" onClick={onClear} className="mt-3 text-sm font-semibold text-[#8758F6] hover:underline">
          Reset filters
        </button>
      )}
    </div>
  );
}

function Select({ value, onChange, label, children }: {
  value: string; onChange: (v: string) => void; label: string; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-[#E7E8EE] bg-white pl-3 pr-8 text-sm text-[#17171C] outline-none transition hover:border-[#C9CBD3] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8C96]" />
    </div>
  );
}

function MoreMenu({ items }: {
  items: { label: string; icon: typeof Mail; onClick?: () => void; disabled?: boolean; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E7E8EE] bg-white text-[#17171C] transition hover:border-[#C9CBD3]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-[#E7E8EE] bg-white py-1 shadow-[0_12px_32px_rgba(23,23,28,0.12)]">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick?.(); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger ? 'text-[#C62A2F] hover:bg-[#FFF5F5]' : 'text-[#17171C] hover:bg-[#F7F8FC]'
                } ${item.danger && i > 0 ? 'mt-1 border-t border-[#F0F1F5] pt-2.5' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

function IssueDrawer({ issue, onClose, onSetResolved }: {
  issue: Issue; onClose: () => void; onSetResolved?: (ids: string[], resolved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const x = issue.explanation;
  const style = KIND_STYLE[x.kind];
  const Area = areaOf(issue.category);
  const latest = issue.logs[0];
  const isFixed = issue.open === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const people = useMemo(() => {
    const map = new Map<string, { label: string; userId: string | null; count: number }>();
    for (const l of issue.logs) {
      const k = l.user_email || 'anon';
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { label: l.user_email || who(l), userId: l.user_id, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [issue.logs]);

  const occurrences = showAll ? issue.logs : issue.logs.slice(0, 8);
  const { stack, hint, ...details } = latest.details || {};

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(developerReport(issue));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={x.title}>
      <div className="absolute inset-0 bg-[#17171C]/40" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[540px] sm:rounded-none sm:animate-slide-in">
        {/* Head */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E7E8EE] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold ${style.bg} ${style.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {KIND_META[x.kind].label}
              </span>
              <span className="inline-flex h-6 items-center rounded-md bg-[#F4F4F6] px-2 text-xs font-medium text-[#55575F]">{Area.label}</span>
              {x.kind === 'problem' && isFixed && (
                <span className="inline-flex h-6 items-center gap-1 rounded-md bg-[#E9F9EE] px-2 text-xs font-semibold text-[#218358]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fixed
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-snug text-[#17171C]">{x.title}</h2>
            <p className="mt-1 text-xs text-[#8A8C96]">
              {issue.logs.length === 1 ? 'Happened once' : `Happened ${issue.logs.length} times`} · last {ago(issue.last)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-lg p-1.5 text-[#666873] transition hover:bg-[#F4F4F7] hover:text-[#17171C]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <Section title="What happened">
            <p className="text-sm leading-relaxed text-[#17171C]">{x.summary}</p>
            {x.summary !== latest.message && latest.message && (
              <p className="mt-2 text-[13px] text-[#8A8C96]">Message shown: &ldquo;{latest.message}&rdquo;</p>
            )}
          </Section>

          <div className={`rounded-xl border p-4 ${x.kind === 'problem' ? 'border-[#E4D8FF] bg-[#F7F2FF]' : 'border-[#E7E8EE] bg-[#F7F8FC]'}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.08em] ${x.kind === 'problem' ? 'text-[#6D3FE0]' : 'text-[#666873]'}`}>What to do</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#17171C]">{x.action}</p>
            {typeof hint === 'string' && hint && <p className="mt-2 text-[13px] leading-relaxed text-[#55575F]">Tip: {hint}</p>}
          </div>

          <Section title={`Who was affected (${people.length})`}>
            <ul className="flex flex-wrap gap-1.5">
              {people.slice(0, 12).map((p) => (
                <li key={p.label}>
                  {p.userId ? (
                    <Link href={`/admin/users/${p.userId}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E7E8EE] px-2.5 py-1 text-xs text-[#6D3FE0] hover:border-[#8758F6]">
                      <span className="truncate">{p.label}</span>
                      {p.count > 1 && <span className="text-[#8A8C96]">×{p.count}</span>}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Link>
                  ) : (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E7E8EE] px-2.5 py-1 text-xs text-[#3A3B42]">
                      {p.label.startsWith('A ') ? <UserX className="h-3 w-3 shrink-0 text-[#8A8C96]" /> : null}
                      <span className="truncate">{p.label}</span>
                      {p.count > 1 && <span className="text-[#8A8C96]">×{p.count}</span>}
                    </span>
                  )}
                </li>
              ))}
              {people.length > 12 && <li className="px-1 py-1 text-xs text-[#8A8C96]">+{people.length - 12} more</li>}
            </ul>
          </Section>

          <Section title="Each time it happened">
            <ol className="divide-y divide-[#F0F1F5] rounded-xl border border-[#E7E8EE]">
              {occurrences.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className="w-[108px] shrink-0 text-xs tabular-nums text-[#8A8C96]">
                    {dayLabel(new Date(l.created_at))}<br />{timeFmt.format(new Date(l.created_at))}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className={`block truncate text-[#17171C] ${l.resolved ? 'line-through decoration-[#C6C8D0]' : ''}`}>{who(l)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#8A8C96]">
                      {l.device && (
                        <span className="inline-flex items-center gap-1"><DeviceIcon device={l.device} className="h-3 w-3" />{l.device}</span>
                      )}
                      {l.booking_id && (
                        <Link href={`/admin/bookings/${l.booking_id}`} className="inline-flex items-center gap-0.5 text-[#6D3FE0] hover:underline">
                          Open booking <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            {issue.logs.length > occurrences.length && (
              <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-sm font-semibold text-[#6D3FE0] hover:underline">
                Show all {issue.logs.length}
              </button>
            )}
          </Section>

          <details className="group rounded-xl border border-[#E7E8EE]">
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-medium text-[#55575F] hover:text-[#17171C] [&::-webkit-details-marker]:hidden">
              Technical details (for your developer)
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-[#E7E8EE] px-4 py-3">
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <Tech label="Process" value={latest.process} />
                <Tech label="Raw message" value={latest.message} />
                <Tech label="Code" value={latest.code} mono />
                <Tech label="Request" value={latest.route ? [latest.method, latest.route].filter(Boolean).join(' ') : null} mono />
                <Tech label="IP" value={latest.ip} mono />
                <Tech label="Time" value={fullFmt.format(new Date(latest.created_at))} />
                <Tech label="Browser" value={latest.user_agent} />
              </dl>
              {Object.keys(details).length > 0 && (
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#17171C] p-3 font-mono text-[11.5px] leading-relaxed text-[#E7E8EE]">
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
              {typeof stack === 'string' && stack && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#F7F8FC] p-3 font-mono text-[11px] leading-relaxed text-[#55575F]">
                  {stack}
                </pre>
              )}
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[#E7E8EE] px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
          {x.kind === 'problem' && (
            <button
              type="button"
              onClick={() => onSetResolved?.(issue.logs.map((l) => l.id), !isFixed)}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${
                isFixed
                  ? 'border border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#C9CBD3]'
                  : 'bg-[#8758F6] text-white hover:bg-[#7646EA]'
              }`}
            >
              {isFixed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {isFixed ? 'Reopen' : 'Mark fixed'}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] transition hover:border-[#C9CBD3] ${x.kind === 'problem' ? '' : 'flex-1'}`}
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy for developer'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#666873]">{title}</h3>
      {children}
    </section>
  );
}

function Tech({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-[#8A8C96]">{label}</dt>
      <dd className={`min-w-0 break-words text-[#17171C] ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </>
  );
}
