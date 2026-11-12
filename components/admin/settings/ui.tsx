'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Save, X } from 'lucide-react';

export type Tone = 'ok' | 'warn' | 'error' | 'muted' | 'loading';

export const toneDot: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  muted: 'bg-slate-300',
  loading: 'bg-slate-300 animate-pulse',
};

const pillTone: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  muted: 'border-slate-200 bg-slate-50 text-slate-600',
  loading: 'border-slate-200 bg-slate-50 text-slate-500',
};

export const btn = {
  primary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50',
  icon:
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-40',
};

export const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:bg-slate-50';
export const textareaCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-100';

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pillTone[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export function Section({
  title,
  description,
  icon: Icon,
  action,
  children,
  flush,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 flex-1 gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate-950">{title}</h2>
            {description && <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
        </div>
        {action && <div className="flex flex-shrink-0 flex-wrap gap-2">{action}</div>}
      </header>
      <div className={flush ? 'pt-4' : 'p-4 sm:p-5'}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Text input with an optional leading/trailing adornment (₹, "days"...). */
export function AdornedInput({
  prefix,
  suffix,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string; invalid?: boolean }) {
  return (
    <div
      className={`flex h-11 items-center overflow-hidden rounded-xl border bg-white transition focus-within:ring-4 ${
        invalid ? 'border-red-300 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-purple-500 focus-within:ring-purple-100'
      }`}
    >
      {prefix && <span className="pl-3 text-sm font-semibold text-slate-400">{prefix}</span>}
      <input {...props} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums text-slate-950 outline-none" />
      {suffix && <span className="whitespace-nowrap pr-3 text-xs font-medium text-slate-400">{suffix}</span>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 transition has-[button:focus-visible]:ring-4 has-[button:focus-visible]:ring-purple-100">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`no-min-touch relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 ${checked ? 'bg-purple-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left] ${checked ? 'left-6' : 'left-1'}`} />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className="text-slate-500">{item.label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadError({ what, error, onRetry }: { what: string; error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-red-800">Couldn&apos;t load {what}</p>
          <p className="mt-0.5 text-sm text-red-700/80">{error}</p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className={btn.secondary}>
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

/** Sticky bar that appears while a form has unsaved edits. Sits above the mobile bottom nav. */
export function SaveBar({
  visible,
  saving,
  onSave,
  onDiscard,
  message = 'You have unsaved changes',
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  message?: string;
}) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4" role="region" aria-label="Unsaved changes">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-900/10 bg-slate-900/95 px-4 py-2.5 text-white shadow-xl backdrop-blur motion-safe:animate-[gk-rise_.18s_ease-out]">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" aria-hidden />
          <span className="truncate sm:hidden">Unsaved</span>
          <span className="hidden truncate sm:inline">{message}</span>
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <button type="button" onClick={onDiscard} disabled={saving} className="no-min-touch h-9 rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50">
            Discard
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="no-min-touch inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-bold text-slate-900 hover:bg-purple-50 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. Esc closes, body scroll is locked. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button');
    first?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl motion-safe:animate-[gk-rise_.2s_ease-out] sm:max-w-xl sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 id={titleId} className="text-base font-bold text-slate-950">
            {title}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
