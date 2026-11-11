'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2 } from 'lucide-react';

/*
 * Design language for the Instagram section
 * - Neutral surfaces, ink for text, violet only for selection/focus/links.
 * - Status colours (emerald/amber/rose) only when something IS good/bad.
 * - Sentence-case labels, numbers carry the weight (semibold, tabular).
 * - One primary (dark) button per area, always on the right.
 */

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* Instagram brand: the story-ring gradient and the action blue. */
export const IG_GRADIENT = 'bg-[linear-gradient(45deg,#feda75_0%,#fa7e1e_25%,#d62976_50%,#962fbf_75%,#4f5bd5_100%)]';
export const IG_GRADIENT_TEXT = 'bg-[linear-gradient(90deg,#fa7e1e,#d62976,#962fbf)] bg-clip-text text-transparent';
export const IG_BLUE = '#0095f6';

/** Coloured icon chip (soft tint) for stat tiles and section headers. */
export const TONES = {
  pink: 'bg-pink-50 text-pink-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-sky-50 text-sky-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  indigo: 'bg-indigo-50 text-indigo-600',
} as const;
export type Tone = keyof typeof TONES;

export function IconChip({ icon, tone, size = 32, gradient }: { icon: ReactNode; tone?: Tone; size?: number; gradient?: boolean }) {
  return (
    <span style={{ width: size, height: size }}
      className={cx('flex shrink-0 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4', gradient ? cx(IG_GRADIENT, 'text-white shadow-sm shadow-pink-500/20') : TONES[tone || 'purple'])}>
      {icon}
    </span>
  );
}

/** Avatar wrapped in Instagram's story ring. */
export function StoryRing({ children, active = true, size }: { children: ReactNode; active?: boolean; size?: number }) {
  return (
    <span className={cx('inline-flex shrink-0 rounded-full p-[2.5px]', active ? IG_GRADIENT : 'bg-slate-200')} style={size ? { width: size, height: size } : undefined}>
      <span className="inline-flex rounded-full bg-white p-[2px]">{children}</span>
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>{children}</section>;
}

export function PanelHeader({ title, description, right, className, icon, tone, gradient }: { title: ReactNode; description?: ReactNode; right?: ReactNode; className?: string; icon?: ReactNode; tone?: Tone; gradient?: boolean }) {
  return (
    <div className={cx('flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-5 py-3', className)}>
      {icon && <IconChip icon={icon} tone={tone} gradient={gradient} />}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Signed % change vs a previous value. Up = good unless `invert`. */
export function Delta({ cur, prev, invert = false, suffix }: { cur?: number | null; prev?: number | null; invert?: boolean; suffix?: string }) {
  if (cur == null || prev == null || prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  if (!Number.isFinite(pct)) return null;
  const flat = Math.abs(pct) < 0.5;
  const good = invert ? pct < 0 : pct > 0;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', flat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-rose-600')}>
      {!flat && <Icon className="h-3 w-3" />}
      {flat ? '0%' : `${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`}
      {suffix && <span className="ml-1 font-normal text-slate-400">{suffix}</span>}
    </span>
  );
}

/** Stat tile: label → number → context. */
export function Stat({ label, value, sub, delta, size = 'md', className, title, icon, tone }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; delta?: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string; title?: string; icon?: ReactNode; tone?: Tone;
}) {
  return (
    <div className={cx('min-w-0', className)} title={title}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] text-slate-500">{label}</p>
        {icon && <IconChip icon={icon} tone={tone} size={size === 'sm' ? 26 : 30} />}
      </div>
      <p className={cx('mt-1 truncate font-semibold tabular-nums tracking-tight text-slate-900', size === 'lg' ? 'text-[28px] leading-8' : size === 'md' ? 'text-2xl' : 'text-lg')}>{value}</p>
      {(delta || sub) && <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">{delta}{sub && <span className="truncate">{sub}</span>}</div>}
    </div>
  );
}

/** Row of stats separated by hairlines; wraps to 2 columns on phones. */
export function StatRow({ children, cols = 'lg:grid-cols-6' }: { children: ReactNode; cols?: string }) {
  return <div className={cx('grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:grid-cols-3 [&>*]:bg-white [&>*]:px-5 [&>*]:py-4', cols)}>{children}</div>;
}

export function Segmented({ options, value, onChange, size = 'sm' }: { options: { k: string; l: ReactNode }[]; value: string; onChange: (k: string) => void; size?: 'sm' | 'xs' }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.k} role="tab" aria-selected={value === o.k} onClick={() => onChange(o.k)}
          className={cx('rounded-md font-medium transition-colors', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]',
            value === o.k ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-900')}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'soft'; loading?: boolean; icon?: ReactNode; size?: 'sm' | 'md' };
export function Button({ variant = 'secondary', loading, icon, size = 'md', className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-[#0095f6] text-white shadow-sm hover:bg-[#1877f2] disabled:bg-sky-200',
    gradient: cx(IG_GRADIENT, 'text-white shadow-sm shadow-pink-500/25 hover:brightness-105'),
    soft: 'bg-slate-100 text-slate-900 hover:bg-slate-200/80',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'text-rose-600 hover:bg-rose-50',
  }[variant];
  return (
    <button {...rest} disabled={disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'h-8 px-3.5 text-[13px] font-semibold' : 'h-7 px-2.5 text-xs font-semibold', v, className)}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-50', on ? 'bg-[#0095f6]' : 'bg-slate-200')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/** A settings row: what it is on the left, the control on the right. */
export function SettingRow({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ src, name, size = 32 }: { src?: string | null; name?: string | null; size?: number }) {
  const style = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={style} referrerPolicy="no-referrer" className="shrink-0 rounded-full bg-slate-100 object-cover" />
  ) : (
    <span style={{ ...style, fontSize: Math.max(10, size * 0.4) }} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 via-pink-100 to-purple-100 font-semibold uppercase text-pink-700">{(name || '?').replace(/^@/, '').slice(0, 1)}</span>
  );
}

export function Dot({ tone }: { tone: 'green' | 'amber' | 'red' | 'gray' }) {
  return <span className={cx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', gray: 'bg-slate-300' }[tone])} />;
}

/* Kept for the Followers tab. */
export function Kpi({ label, value, sub, children }: { label: string; value?: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="truncate text-[13px] text-slate-500">{label}</p>
      {children ?? <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>}
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Banner({ tone, icon, title, children, action }: { tone: 'rose' | 'amber' | 'slate'; icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  const cls = {
    rose: 'border-rose-200 bg-rose-50/60 [&_.ic]:text-rose-600',
    amber: 'border-amber-200 bg-amber-50/60 [&_.ic]:text-amber-600',
    slate: 'border-slate-200 bg-slate-50 [&_.ic]:text-slate-500',
  }[tone];
  return (
    <div className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs', cls)}>
      <span className="ic mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 text-slate-700">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        {children && <div className="mt-0.5 leading-relaxed [&_code]:rounded [&_code]:bg-white [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[11px] [&_code]:ring-1 [&_code]:ring-slate-200">{children}</div>}
      </div>
      {action}
    </div>
  );
}
