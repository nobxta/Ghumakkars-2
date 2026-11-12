'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X, Upload, Loader2 } from 'lucide-react';
import { fid } from './state';

/* ───────────────────────── Field ─────────────────────────
   Label + control + hint/error. The control gets the matching id
   and aria-invalid via the render prop so errors can focus it. */
export function Field({
  name,
  label,
  required,
  optional,
  hint,
  error,
  className = '',
  children,
}: {
  name: string;
  label: ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = fid(name);
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {optional && <span className="ml-1.5 font-normal text-gray-400">(optional)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? msgId : undefined })}
      {error ? (
        <p id={msgId} className="field-error" role="alert">{error}</p>
      ) : hint ? (
        <p id={msgId} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/* ───────────────────────── Switch ───────────────────────── */
export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="switch mt-0.5"
      >
        <span />
      </button>
      <button type="button" onClick={() => onChange(!checked)} className="no-min-touch min-w-0 text-left">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </button>
    </div>
  );
}

/* ───────────────────────── Section ───────────────────────── */
export function Section({
  title,
  description,
  action,
  children,
  tone = 'plain',
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'plain' | 'tinted';
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border p-4 sm:p-5 ${tone === 'tinted' ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-white'}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ───────────────────────── ListEditor ─────────────────────────
   Rows of single-line inputs. Rules (same everywhere):
   - "Add" is always a full-width dashed button BELOW the list.
   - Adding focuses the new row; Enter in a row jumps to the next / adds one.
   - Remove is the same small × button on every row; disabled on the last row. */
export function ListEditor({
  name,
  items,
  onChange,
  placeholder,
  addLabel,
  maxLength,
}: {
  name: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
  maxLength?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useEffect(() => {
    if (focusIdx != null) {
      refs.current[focusIdx]?.focus();
      setFocusIdx(null);
    }
  }, [focusIdx, items.length]);

  const add = () => {
    onChange([...items, '']);
    setFocusIdx(items.length);
  };

  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            ref={(el) => { refs.current[i] = el; }}
            id={i === 0 ? fid(name) : undefined}
            type="text"
            value={v}
            maxLength={maxLength}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (i < items.length - 1) refs.current[i + 1]?.focus();
              else if (v.trim()) add();
            }}
            placeholder={placeholder}
            aria-label={`${addLabel.replace(/^Add /, '')} ${i + 1}`}
            className="field"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            disabled={items.length <= 1}
            className="btn btn-sm btn-icon btn-danger"
            aria-label={`Remove row ${i + 1}`}
            title="Remove"
          >
            <X />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-sm btn-add">
        <Plus /> {addLabel}
      </button>
    </div>
  );
}

/* ───────────────────────── Uploads ───────────────────────── */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'trips');
  const res = await fetch('/api/upload/cloudinary', { method: 'POST', body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Upload failed');
  }
  const { url } = await res.json();
  return url;
}

/** A real (keyboard-accessible) button that opens the file picker. */
export function UploadButton({
  onFiles,
  multiple,
  busy,
  label = 'Upload',
  size = 'md',
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  busy?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={`btn btn-secondary ${size === 'sm' ? 'btn-sm' : ''}`}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/** Thumbnail with a graceful fallback when the URL doesn't load. */
export function Thumb({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src.trim()) return null;
  return broken ? (
    <div className={`flex items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50 text-[11px] text-red-500 ${className}`}>
      Can’t load
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setBroken(true)} className={`rounded-lg border border-gray-200 object-cover ${className}`} />
  );
}

/* ───────────────────────── Toast ───────────────────────── */
export interface ToastData {
  id: number;
  message: string;
  tone?: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.onAction ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  const tone =
    toast.tone === 'error' ? 'bg-red-600' : toast.tone === 'success' ? 'bg-green-600' : 'bg-gray-900';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 z-[65] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg animate-slide-up ${tone} bottom-[8.5rem] md:bottom-24`}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.onAction && (
        <button
          type="button"
          onClick={() => { toast.onAction?.(); onClose(); }}
          className="btn btn-sm bg-white/15 text-white hover:bg-white/25"
        >
          {toast.actionLabel || 'Undo'}
        </button>
      )}
      <button type="button" onClick={onClose} className="btn btn-sm btn-icon text-white/80 hover:bg-white/15" aria-label="Dismiss">
        <X />
      </button>
    </div>
  );
}
