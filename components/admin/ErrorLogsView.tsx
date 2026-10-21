'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon, AlertTriangle, CheckCheck, CheckCircle2, Copy, CreditCard, ExternalLink, KeyRound, Lightbulb,
  Mail, Monitor, RefreshCw, Search, Server, Shield, Smartphone, Tablet, Ticket, Trash2, User, Webhook, X,
} from 'lucide-react';

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

const CATEGORIES: Record<string, { label: string; icon: typeof Mail; color: string; bg: string }> = {
  payment: { label: 'Payment', icon: CreditCard, color: '#047857', bg: '#ECFDF5' },
  otp: { label: 'OTP', icon: KeyRound, color: '#7C4DEB', bg: '#F1EBFF' },
  auth: { label: 'Account', icon: User, color: '#4F46E5', bg: '#EEF2FF' },
  email: { label: 'Email', icon: Mail, color: '#0369A1', bg: '#E0F2FE' },
  booking: { label: 'Booking', icon: Ticket, color: '#C2410C', bg: '#FFF1E7' },
  webhook: { label: 'Webhook', icon: Webhook, color: '#A21CAF', bg: '#FDF0FF' },
  admin: { label: 'Admin', icon: Shield, color: '#334155', bg: '#F1F5F9' },
  system: { label: 'System', icon: Server, color: '#52525B', bg: '#F4F4F5' },
};
const CATEGORY_ORDER = ['payment', 'otp', 'email', 'booking', 'auth', 'webhook', 'admin', 'system'];

const DAY = 24 * 60 * 60 * 1000;

function categoryOf(key: string) {
  return CATEGORIES[key] || CATEGORIES.system;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function formatFull(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const Icon = !device ? Monitor
    : device.includes('Server') ? Server
    : device.includes('Tablet') ? Tablet
    : device.includes('Mobile') ? Smartphone
    : Monitor;
  return <Icon className={className} />;
}

function CategoryPill({ category }: { category: string }) {
  const c = categoryOf(category);
  const Icon = c.icon;
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold"
      style={{ color: c.color, background: c.bg }}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

function LevelDot({ level }: { level: ErrorLog['level'] }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${level === 'error' ? 'bg-[#E5484D]' : 'bg-[#F5A524]'}`}
      aria-label={level}
    />
  );
}

/** Plain-text report, handy for pasting into a chat with a developer. */
function toPlainText(log: ErrorLog) {
  const lines = [
    `${log.level.toUpperCase()} · ${categoryOf(log.category).label} · ${log.process}`,
    `When: ${formatFull(log.created_at)}`,
    `Message: ${log.message}`,
    log.code && `Code: ${log.code}`,
    log.user_email && `User: ${log.user_email}`,
    log.booking_id && `Booking: ${log.booking_id}`,
    log.route && `Route: ${log.method || ''} ${log.route}`.trim(),
    log.device && `Device: ${log.device}`,
    log.ip && `IP: ${log.ip}`,
    log.details && `Details: ${JSON.stringify(log.details, null, 2)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

interface ErrorLogsViewProps {
  logs: ErrorLog[];
  loading?: boolean;
  refreshing?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  onSetResolved?: (id: string, resolved: boolean) => void;
  onResolveAll?: () => void;
  onClearResolved?: () => void;
}

export default function ErrorLogsView({
  logs, loading, refreshing, lastUpdated, onRefresh, onSetResolved, onResolveAll, onClearResolved,
}: ErrorLogsViewProps) {
  const [category, setCategory] = useState<string>('all');
  const [level, setLevel] = useState<'all' | 'error' | 'warning'>('all');
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = logs.find((l) => l.id === selectedId) || null;

  const stats = useMemo(() => {
    const now = Date.now();
    const last24 = logs.filter((l) => now - new Date(l.created_at).getTime() < DAY);
    const frequency = new Map<string, number>();
    for (const l of logs) if (!l.resolved) frequency.set(l.process, (frequency.get(l.process) || 0) + 1);
    const top = [...frequency.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0];
    return {
      openErrors: logs.filter((l) => !l.resolved && l.level === 'error').length,
      errors24: last24.filter((l) => l.level === 'error').length,
      warnings24: last24.filter((l) => l.level === 'warning').length,
      payments: logs.filter((l) => l.category === 'payment' && !l.resolved).length,
      top,
    };
  }, [logs]);

  // Category counts follow the level/status/search filters, so the chips always add up.
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (level !== 'all' && l.level !== level) return false;
      if (status === 'open' && l.resolved) return false;
      if (status === 'resolved' && !l.resolved) return false;
      if (!q) return true;
      return [l.process, l.message, l.code, l.user_email, l.booking_id, l.route, l.device, l.ip]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [logs, level, status, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of baseFiltered) map[l.category] = (map[l.category] || 0) + 1;
    return map;
  }, [baseFiltered]);

  const visible = category === 'all' ? baseFiltered : baseFiltered.filter((l) => l.category === category);
  const filtersActive = category !== 'all' || level !== 'all' || status !== 'open' || search.trim() !== '';

  const clearFilters = () => {
    setCategory('all');
    setLevel('all');
    setStatus('open');
    setSearch('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#F7F8FC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#E7E8EE] border-t-[#8758F6] mx-auto"></div>
          <p className="mt-4 text-sm text-[#666873] font-medium">Loading error logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)] bg-[#F7F8FC] p-4 sm:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold leading-tight tracking-tight text-[#17171C]">Error Logs</h1>
          <p className="mt-1 text-sm text-[#666873]">
            What failed, for whom and why: payments, OTPs, emails and bookings. Kept for 7 days (newest 500).
          </p>
        </div>
        <div className="grid grid-cols-3 items-center gap-2 sm:flex sm:flex-wrap">
          {lastUpdated && (
            <span className="mr-1 hidden text-xs text-[#8A8C96] sm:inline">Updated {formatRelative(lastUpdated.toISOString()).toLowerCase()}</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E7E8EE] bg-white px-3 text-sm font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6]"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onResolveAll}
            disabled={!logs.some((l) => !l.resolved)}
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E7E8EE] bg-white px-3 text-sm font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E7E8EE] disabled:hover:text-[#17171C]"
          >
            <CheckCheck className="h-4 w-4" />
            Resolve all
          </button>
          <button
            type="button"
            onClick={onClearResolved}
            disabled={!logs.some((l) => l.resolved)}
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E7E8EE] bg-white px-3 text-sm font-medium text-[#17171C] transition hover:border-[#E5484D] hover:text-[#D93036] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E7E8EE] disabled:hover:text-[#17171C]"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Clear</span>
            <span className="hidden sm:inline">Clear resolved</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open errors"
          value={stats.openErrors}
          tone={stats.openErrors > 0 ? 'red' : 'green'}
          note={stats.openErrors > 0 ? 'Need a look' : 'All clear'}
        />
        <StatTile
          label="Last 24 hours"
          value={stats.errors24}
          tone="neutral"
          note={`errors · ${stats.warnings24} warning${stats.warnings24 === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Payment issues"
          value={stats.payments}
          tone={stats.payments > 0 ? 'amber' : 'neutral'}
          note="open, last 7 days"
          onClick={stats.payments > 0 ? () => setCategory('payment') : undefined}
        />
        <div className="rounded-2xl border border-[#E7E8EE] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,28,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Repeating issue</p>
          {stats.top ? (
            <>
              <p className="mt-2 truncate text-sm font-semibold text-[#17171C]" title={stats.top[0]}>{stats.top[0]}</p>
              <p className="mt-1 text-xs text-[#666873]">Failed {stats.top[1]} times, still open</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#8A8C96]">No repeated failures</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            <FilterChip active={category === 'all'} onClick={() => setCategory('all')} label="All" count={baseFiltered.length} />
            {CATEGORY_ORDER.map((key) => (
              <FilterChip
                key={key}
                active={category === key}
                onClick={() => setCategory(key)}
                label={CATEGORIES[key].label}
                count={counts[key] || 0}
                color={CATEGORIES[key].color}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666873]" />
            <input
              type="text"
              placeholder="Search email, booking ID, code, message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E7E8EE] bg-white pl-10 pr-4 text-sm text-[#17171C] outline-none transition placeholder:text-[#8A8C96] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={level}
              onChange={(v) => setLevel(v as typeof level)}
              options={[['all', 'All'], ['error', 'Errors'], ['warning', 'Warnings']]}
            />
            <Segmented
              value={status}
              onChange={(v) => setStatus(v as typeof status)}
              options={[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']]}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white shadow-[0_10px_30px_rgba(23,23,28,0.05)]">
        {visible.length === 0 ? (
          logs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#30A46C]" />
              <p className="text-sm font-semibold text-[#17171C]">No errors recorded</p>
              <p className="mt-1 text-sm text-[#666873]">Failed payments, OTPs, emails and bookings will show up here.</p>
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-[#C6C8D0]" />
              <p className="text-sm text-[#666873]">No logs match these filters</p>
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#8758F6] hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[11%]" />
                  <col />
                  <col className="w-[19%]" />
                  <col className="w-[11%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="border-b border-[#E7E8EE] bg-[#FAFAFD]">
                  <tr className="h-[42px]">
                    {['When', 'Type', 'What failed', 'Who', 'Code', 'Device'].map((h) => (
                      <th key={h} className="px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E8EE]">
                  {visible.map((log) => (
                    <tr
                      key={log.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(log.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedId(log.id)}
                      className={`cursor-pointer transition-colors hover:bg-[#FAF7FF] focus:bg-[#FAF7FF] focus:outline-none ${log.resolved ? 'opacity-55' : ''}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2" title={formatFull(log.created_at)}>
                          <LevelDot level={log.level} />
                          <span className="truncate text-sm text-[#17171C]">{formatRelative(log.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top"><CategoryPill category={log.category} /></td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#17171C]">{log.process}</span>
                          {log.resolved && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30A46C]" aria-label="Resolved" />}
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-[#666873]" title={log.message}>{log.message}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`block truncate text-sm ${log.user_email ? 'text-[#17171C]' : 'text-[#B0B2BA]'}`} title={log.user_email || ''}>
                          {log.user_email || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block truncate font-mono text-[12px] text-[#17171C]" title={log.code || ''}>{log.code || '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {log.device ? (
                          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-[#666873]" title={log.user_agent || ''}>
                            <DeviceIcon device={log.device} className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{log.device}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#B0B2BA]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-[#E7E8EE] lg:hidden">
              {visible.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(log.id)}
                    className={`block w-full px-4 py-3.5 text-left transition-colors active:bg-[#FAF7FF] ${log.resolved ? 'opacity-55' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <LevelDot level={log.level} />
                        <CategoryPill category={log.category} />
                        {log.resolved && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#30A46C]" />}
                      </div>
                      <span className="shrink-0 text-xs text-[#8A8C96]">{formatRelative(log.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#17171C]">{log.process}</p>
                    <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-[#666873]">{log.message}</p>
                    <div className="mt-2 flex min-w-0 items-center gap-3 text-xs text-[#8A8C96]">
                      {log.user_email && <span className="min-w-0 truncate">{log.user_email}</span>}
                      {log.code && <span className="shrink-0 font-mono">{log.code}</span>}
                      {log.device && (
                        <span className="flex shrink-0 items-center gap-1">
                          <DeviceIcon device={log.device} className="h-3 w-3" />
                          {log.device.split(' · ')[1] || log.device}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-[#E7E8EE] px-4 py-3 text-xs text-[#8A8C96]">
              Showing {visible.length} of {logs.length} log{logs.length === 1 ? '' : 's'}
            </div>
          </>
        )}
      </div>

      {selected && (
        <LogDrawer
          log={selected}
          onClose={() => setSelectedId(null)}
          onSetResolved={onSetResolved}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, note, tone, onClick }: {
  label: string; value: number; note: string; tone: 'red' | 'amber' | 'green' | 'neutral'; onClick?: () => void;
}) {
  const valueColor = { red: 'text-[#D93036]', amber: 'text-[#B45309]', green: 'text-[#218358]', neutral: 'text-[#17171C]' }[tone];
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`rounded-2xl border border-[#E7E8EE] bg-white p-4 text-left shadow-[0_1px_2px_rgba(23,23,28,0.04)] ${onClick ? 'transition hover:border-[#8758F6]' : ''}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">{label}</p>
      <p className={`mt-1.5 text-[28px] font-bold leading-none tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-xs text-[#666873]">{note}</p>
    </Wrapper>
  );
}

function FilterChip({ active, onClick, label, count, color }: {
  active: boolean; onClick: () => void; label: string; count: number; color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition ${
        active
          ? 'border-[#17171C] bg-[#17171C] text-white'
          : count === 0
            ? 'border-[#E7E8EE] bg-white text-[#B0B2BA] hover:text-[#666873]'
            : 'border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#C9CBD3]'
      }`}
    >
      {color && !active && count > 0 && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className={`tabular-nums text-xs ${active ? 'text-white/70' : 'text-[#8A8C96]'}`}>{count}</span>
    </button>
  );
}

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="inline-flex h-10 rounded-xl border border-[#E7E8EE] bg-white p-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-lg px-2.5 text-[13px] font-medium transition sm:px-3 ${
            value === key ? 'bg-[#F1EBFF] text-[#6D3FE0]' : 'text-[#666873] hover:text-[#17171C]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LogDrawer({ log, onClose, onSetResolved }: {
  log: ErrorLog; onClose: () => void; onSetResolved?: (id: string, resolved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

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

  const { hint, stack, ...restDetails } = log.details || {};
  const hasDetails = Object.keys(restDetails).length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(log));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing to do
    }
  };

  const rows: [string, React.ReactNode][] = [
    ['User', log.user_email ? (
      log.user_id ? (
        <Link href={`/admin/users/${log.user_id}`} className="inline-flex items-center gap-1 text-[#8758F6] hover:underline break-all">
          {log.user_email} <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
      ) : log.user_email
    ) : null],
    ['Booking', log.booking_id ? (
      <Link href={`/admin/bookings/${log.booking_id}`} className="inline-flex items-center gap-1 font-mono text-[12px] text-[#8758F6] hover:underline break-all">
        {log.booking_id} <ExternalLink className="h-3 w-3 shrink-0" />
      </Link>
    ) : null],
    ['Code', log.code ? <span className="font-mono text-[12px]">{log.code}</span> : null],
    ['Request', log.route ? <span className="font-mono text-[12px] break-all">{[log.method, log.route].filter(Boolean).join(' ')}</span> : null],
    ['Device', log.device ? (
      <span className="inline-flex items-center gap-1.5"><DeviceIcon device={log.device} className="h-3.5 w-3.5" />{log.device}</span>
    ) : null],
    ['IP address', log.ip ? <span className="font-mono text-[12px]">{log.ip}</span> : null],
    ['Browser', log.user_agent ? <span className="text-[12px] leading-relaxed text-[#666873] break-all">{log.user_agent}</span> : null],
  ];

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Error details">
      <div className="absolute inset-0 bg-[#17171C]/40" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[520px] sm:rounded-none sm:animate-slide-in">
        {/* Head */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E7E8EE] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-bold uppercase tracking-wide ${
                log.level === 'error' ? 'bg-[#FFF0F0] text-[#D93036]' : 'bg-[#FFF7E6] text-[#B45309]'
              }`}>
                {log.level === 'error' ? <AlertOctagon className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {log.level}
              </span>
              <CategoryPill category={log.category} />
              {log.resolved && (
                <span className="inline-flex h-6 items-center gap-1 rounded-md bg-[#E9F9EE] px-2 text-[11px] font-semibold text-[#218358]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-snug text-[#17171C]">{log.process}</h2>
            <p className="mt-0.5 text-xs text-[#8A8C96]">{formatFull(log.created_at)} · {formatRelative(log.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-[#666873] transition hover:bg-[#F4F4F7] hover:text-[#17171C]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Message</p>
            <p className="mt-1.5 select-text break-words text-sm leading-relaxed text-[#17171C]">{log.message}</p>
          </div>

          {typeof hint === 'string' && hint && (
            <div className="flex gap-2.5 rounded-xl border border-[#E4D8FF] bg-[#F7F2FF] p-3.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#8758F6]" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6D3FE0]">Likely fix</p>
                <p className="mt-1 text-sm leading-relaxed text-[#3B2A6B]">{hint}</p>
              </div>
            </div>
          )}

          <dl className="divide-y divide-[#F0F1F5] rounded-xl border border-[#E7E8EE]">
            {rows.filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="grid grid-cols-[96px_1fr] gap-3 px-3.5 py-2.5">
                <dt className="text-[13px] text-[#666873]">{label}</dt>
                <dd className="min-w-0 text-sm text-[#17171C]">{value}</dd>
              </div>
            ))}
          </dl>

          {hasDetails && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#666873]">Details</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#17171C] p-3.5 font-mono text-[12px] leading-relaxed text-[#E7E8EE]">
                {JSON.stringify(restDetails, null, 2)}
              </pre>
            </div>
          )}

          {typeof stack === 'string' && stack && (
            <details className="group rounded-xl border border-[#E7E8EE]">
              <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[13px] font-medium text-[#666873] hover:text-[#17171C]">
                Stack trace (for developers)
              </summary>
              <pre className="overflow-auto whitespace-pre-wrap break-words border-t border-[#E7E8EE] px-3.5 py-3 font-mono text-[11px] leading-relaxed text-[#666873]">
                {stack}
              </pre>
            </details>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[#E7E8EE] px-5 py-3.5">
          <button
            type="button"
            onClick={() => onSetResolved?.(log.id, !log.resolved)}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${
              log.resolved
                ? 'border border-[#E7E8EE] bg-white text-[#17171C] hover:border-[#8758F6] hover:text-[#8758F6]'
                : 'bg-[#8758F6] text-white hover:bg-[#7646EA]'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {log.resolved ? 'Reopen' : 'Mark resolved'}
          </button>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#E7E8EE] bg-white px-4 text-sm font-medium text-[#17171C] transition hover:border-[#8758F6] hover:text-[#8758F6]"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </aside>
    </div>
  );
}
