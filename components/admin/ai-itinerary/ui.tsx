'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { ProjectStatus } from '@/lib/ai-itinerary/types';

export const STATUS_META: Record<ProjectStatus | 'final' | 'outdated', { label: string; cls: string; dot: string }> = {
  new: { label: 'New', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  collecting: { label: 'Draft', cls: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  clarifying: { label: 'Needs details', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  ready: { label: 'Ready to generate', cls: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  generating: { label: 'Generating', cls: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500 animate-pulse' },
  pdf_ready: { label: 'PDF ready', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  editing: { label: 'Edited', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  final: { label: 'Final', cls: 'bg-slate-900 text-white', dot: 'bg-emerald-400' },
  outdated: { label: 'PDF outdated', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
};

export function StatusBadge({ status, final, dirty, small }: { status: ProjectStatus; final?: boolean; dirty?: boolean; small?: boolean }) {
  const key = final ? 'final' : dirty ? 'outdated' : status;
  const m = STATUS_META[key] || STATUS_META.new;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${small ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[11.5px]'} ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}

/** Side drawer (right on desktop, bottom sheet on phones). */
export function Drawer({
  open, onClose, title, subtitle, children, footer, width = 'sm:max-w-md',
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-end bg-slate-950/30 backdrop-blur-[1px] sm:items-stretch" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl outline-none motion-safe:animate-[gk-rise_.18s_ease-out] sm:max-h-none sm:rounded-none sm:rounded-l-2xl ${width}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[15px] font-bold text-slate-950">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/** Small anchored menu. Closes on outside click / Esc. */
export function Menu({
  trigger, children, align = 'right', width = 'w-52',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right'; width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" className={`absolute z-50 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} ${width} overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] motion-safe:animate-[gk-rise_.12s_ease-out]`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, disabled, hint }: { icon?: React.ElementType; children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 opacity-70" aria-hidden />}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </button>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose,
}: {
  open: boolean; title: string; body: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={onClose}>
      <div role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl motion-safe:animate-[gk-rise_.15s_ease-out]">
        <div className="flex gap-3">
          {danger && <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="h-4 w-4" /></span>}
          <div>
            <h3 className="text-[15px] font-bold text-slate-950">{title}</h3>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">{body}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-white disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600"><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-40';

export const ghostBtn =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-40';

export const smallPrimary =
  'inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50';

export const smallSecondary =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50';
