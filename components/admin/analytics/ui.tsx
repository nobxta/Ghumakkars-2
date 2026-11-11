'use client';

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Info } from 'lucide-react';
import { Sparkline } from './charts';

export function Card({
  title, subtitle, icon, actions, children, className = '', bodyClass = '',
}: {
  title?: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`an-card group/card relative min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {icon && <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-600 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5 print:hidden">{actions}</div>}
        </header>
      )}
      <div className={`px-4 pb-4 pt-3 sm:px-5 sm:pb-5 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, size = 'sm', ariaLabel,
}: {
  value: T; onChange: (v: NoInfer<T>) => void; options: { value: NoInfer<T>; label: ReactNode; title?: string; disabled?: boolean }[]; size?: 'xs' | 'sm'; ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100/80 p-0.5 ring-1 ring-inset ring-slate-200/70 [scrollbar-width:none]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} title={o.title} disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative whitespace-nowrap rounded-[10px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} ${on ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function DeltaBadge({ value, invert = false, compact = false }: { value: number | null; invert?: boolean; compact?: boolean }) {
  if (value == null) return <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">NEW</span>;
  const flat = Math.abs(value) < 0.005;
  const good = invert ? value < 0 : value > 0;
  const cls = flat ? 'bg-slate-100 text-slate-500' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const txt = `${Math.abs(value * 100) >= 100 ? Math.round(Math.abs(value * 100)) : Math.abs(value * 100).toFixed(1)}%`;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${cls}`} title={flat ? 'No change' : `${value > 0 ? '+' : '−'}${txt} vs previous period`}>
      <Icon className="h-3 w-3" />{!compact && txt}
    </span>
  );
}

export function KpiTile({
  label, value, delta, invert, sub, spark, color, icon, active, onClick, hint, compare,
}: {
  label: string; value: string; delta?: number | null; invert?: boolean; sub?: ReactNode; spark?: number[]; color?: string; icon?: ReactNode;
  active?: boolean; onClick?: () => void; hint?: string; compare: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={`an-kpi group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(76,29,149,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400' : ''} ${active ? 'border-purple-300 ring-1 ring-purple-300 shadow-[0_10px_30px_-14px_rgba(124,58,237,0.45)]' : 'border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'}`}
    >
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-orange-400" />}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {icon && <span className="text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <span className="truncate">{label}</span>
          {hint && <span title={hint} className="text-slate-300 hover:text-slate-500"><Info className="h-3 w-3" /></span>}
        </span>
        {compare && delta !== undefined && <DeltaBadge value={delta} invert={invert} />}
      </div>
      <p className="mt-2 truncate text-[22px] font-bold leading-none tracking-tight text-slate-900 tabular-nums sm:text-2xl">{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11px] text-slate-500">{sub}</p>}
      {spark && <div className="-mx-1 mt-auto pt-2"><Sparkline values={spark} color={color} height={30} /></div>}
    </Tag>
  );
}

export function IconBtn({ children, onClick, title, active, disabled }: { children: ReactNode; onClick?: () => void; title: string; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${active ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneCls = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="min-w-0 rounded-xl bg-slate-50/80 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
      <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-base font-bold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
