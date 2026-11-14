/**
 * Shared look for the admin Payments and Settlements tabs, so both read as one page:
 * a dark summary bar, white cards with a header + filter toolbar, and dense tables
 * with tinted status badges. Brand purple is the only accent.
 */
import type { ReactNode } from 'react';

const TD_BASE = 'px-4 py-3 align-middle';

export const ui = {
  card: 'bg-white text-gray-900 rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(16,24,40,0.05)]',
  cardHeader: 'flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200',
  toolbar: 'flex flex-wrap items-end gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50/60',
  input: 'h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 min-w-[110px] placeholder:text-gray-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition',
  btn: 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition',
  btnPrimary: 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-purple-700 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-60 transition',
  link: 'text-purple-700 hover:text-purple-900 hover:underline underline-offset-2',
  table: 'w-full text-sm text-gray-700',
  thead: 'bg-gray-50/80',
  th: 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 whitespace-nowrap border-b border-gray-200',
  tr: 'border-b border-gray-100 last:border-b-0 hover:bg-purple-50/40 transition-colors',
  td: TD_BASE,
  num: `${TD_BASE} text-right tabular-nums whitespace-nowrap text-gray-700`,
  tfoot: 'bg-gray-50/80 border-t border-gray-200 font-semibold text-gray-900',
  mono: 'font-mono text-xs text-gray-600',
};

export type Tone = 'green' | 'amber' | 'red' | 'purple' | 'gray' | 'blue';

const BADGE: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  gray: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${BADGE[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export interface SummaryItem {
  label: string;
  value: string;
  note?: string;
  /** Colours the note: good / warn / bad, or plain. */
  noteTone?: 'good' | 'warn' | 'bad';
}

/** The dark headline strip at the top of both tabs. */
export function SummaryBar({ items }: { items: SummaryItem[] }) {
  const cols = items.length >= 6 ? 'lg:grid-cols-6 sm:grid-cols-3' : 'lg:grid-cols-4 sm:grid-cols-2';
  return (
    <div className="rounded-xl bg-[#1d1433] text-white shadow-[0_8px_24px_-12px_rgba(29,20,51,0.6)] overflow-hidden">
      <div className={`grid grid-cols-2 ${cols} gap-px bg-white/[0.07]`}>
        {items.map((it) => (
          <div key={it.label} className="bg-[#1d1433] px-4 py-4 sm:px-5 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/55">{it.label}</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight truncate">{it.value}</p>
            {it.note && (
              <p className={`mt-1 text-xs truncate ${it.noteTone === 'good' ? 'text-emerald-300' : it.noteTone === 'warn' ? 'text-amber-300' : it.noteTone === 'bad' ? 'text-red-300' : 'text-white/50'}`}>
                {it.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Segmented switch, used for the views inside a card. */
export function Segmented<T extends string>({ value, onChange, items }: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={`h-7 px-3 rounded-md text-sm font-medium whitespace-nowrap transition ${on ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {it.label}
            {it.count !== undefined && <span className={`ml-1.5 tabular-nums ${on ? 'text-purple-700' : 'text-gray-400'}`}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Labelled control in a toolbar. */
export function Field({ label, children, grow }: { label: string; children: ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${grow ? 'flex-1 min-w-[220px] max-w-[380px]' : ''}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function CardTitle({ title, count, sub }: { title: string; count?: number; sub?: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-gray-900">
        {title}
        {count !== undefined && <span className="ml-2 text-gray-400 font-normal tabular-nums">{count}</span>}
      </h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
