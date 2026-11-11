'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, Ticket, User, MapPin, Receipt, Loader2, type LucideIcon } from 'lucide-react';
import { ADMIN_NAV } from '@/components/admin/adminNav';

interface Hit { id: string; title: string; meta: string; href: string }
interface DataResults { bookings: Hit[]; users: Hit[]; trips: Hit[]; payments: Hit[] }
interface Row { key: string; group: string; title: string; meta?: string; href: string; icon: LucideIcon }

const EMPTY: DataResults = { bookings: [], users: [], trips: [], payments: [] };
const GROUPS: { key: keyof DataResults; label: string; icon: LucideIcon }[] = [
  { key: 'bookings', label: 'Bookings', icon: Ticket },
  { key: 'payments', label: 'Payments', icon: Receipt },
  { key: 'users', label: 'Customers', icon: User },
  { key: 'trips', label: 'Trips', icon: MapPin },
];

/** Ctrl/⌘ K — jump to a page, or find a booking, customer, trip or payment. */
export default function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<DataResults>(EMPTY);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setData(EMPTY);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced data search; stale responses are dropped.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setData(EMPTY); setSearching(false); return; }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch { /* aborted */ }
      if (!ctrl.signal.aborted) setSearching(false);
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Row[] = ADMIN_NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })))
      .filter((i) => !q || `${i.label} ${i.group} ${i.keywords || ''}`.toLowerCase().includes(q))
      .slice(0, q ? 4 : 20)
      .map((i) => ({ key: `page-${i.href}`, group: 'Pages', title: i.label, meta: i.group, href: i.href, icon: i.icon }));
    const dataRows: Row[] = GROUPS.flatMap((g) =>
      (data[g.key] || []).map((h) => ({ key: `${g.key}-${h.id}`, group: g.label, title: h.title, meta: h.meta, href: h.href, icon: g.icon })),
    );
    // Data matches first when the user is clearly searching for a record.
    return q ? [...dataRows, ...pages] : pages;
  }, [query, data]);

  useEffect(() => setIndex(0), [query, data]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const go = (row?: Row) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[index]); }
    else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  const q = query.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 px-4 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          {searching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" /> : <Search className="h-4 w-4 shrink-0 text-slate-400" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search bookings, customers, trips, UTR, or a page…"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
        </div>

        <ul ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {rows.length === 0 && !searching && (
            <li className="px-3 py-8 text-center text-sm text-slate-500">Nothing matches “{q}”. Try a name, phone number, booking ID or UTR.</li>
          )}
          {rows.map((row, i) => {
            const Icon = row.icon;
            const active = i === index;
            const header = row.group !== lastGroup ? row.group : null;
            lastGroup = row.group;
            return (
              <li key={row.key}>
                {header && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{header}</p>}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(row)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-violet-50 text-violet-800' : 'text-slate-700'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white text-violet-600 shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.title}</span>
                    {row.meta && <span className="block truncate text-xs text-slate-500">{row.meta}</span>}
                  </span>
                  {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span><kbd className="font-semibold">↑↓</kbd> move</span>
          <span><kbd className="font-semibold">Enter</kbd> open</span>
          <span className="ml-auto">Tip: paste the 8-character booking ID</span>
        </div>
      </div>
    </div>
  );
}
