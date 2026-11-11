'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, ExternalLink, MessageCircle, Phone, X, Loader2 } from 'lucide-react';
import { inr, fmtDay, timeAgo } from './utils';

export interface ApprovalItem {
  kind: 'approval';
  txnId: string;
  bookingId: string;
  amount: number;
  reference: string | null;
  method: string | null;
  paymentType: string | null;
  createdAt: string;
  name: string;
  phone: string | null;
  email: string | null;
  trip: string;
  departure: string | null;
  pax: number;
  bookingStatus: string;
  owed: number;
  paid: number;
}

const REJECT_REASONS = [
  'Fake Payment / Invalid Transaction ID',
  'Fake Details / Invalid Information',
  'Seats Full',
  'Other',
];

const prettyType = (t?: string | null) =>
  !t ? null : t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Review one pending payment without leaving the dashboard. Uses the same
 * endpoint as the Bookings page, so seat counts, booking status, referral
 * rewards and customer notifications all behave identically.
 */
export default function PaymentReviewDialog({
  item,
  onClose,
  onDone,
}: {
  item: ApprovalItem | null;
  onClose: () => void;
  onDone: (msg: string, tone?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState<null | 'verified' | 'rejected'>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const keyActions = useRef<{ approve: () => void }>({ approve: () => {} });

  useEffect(() => {
    setRejecting(false);
    setReason(REJECT_REASONS[0]);
    setNotes('');
    setError('');
    setBusy(null);
  }, [item?.txnId]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'Escape') { onClose(); return; }
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === 'a' && !rejecting) { e.preventDefault(); keyActions.current.approve(); }
      else if (k === 'x' && !rejecting) { e.preventDefault(); setRejecting(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, busy, rejecting, onClose]);

  if (!item) return null;

  const remainingAfter = Math.max(0, item.owed - item.paid - item.amount);

  const submit = async (status: 'verified' | 'rejected') => {
    if (status === 'rejected' && reason === 'Other' && !notes.trim()) {
      setError('Add a note explaining the rejection.');
      return;
    }
    setBusy(status);
    setError('');
    try {
      const res = await fetch('/api/admin/bookings/review-payment-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: item.txnId,
          status,
          reviewNotes: notes.trim() || null,
          rejectionReason: status === 'rejected' ? (reason === 'Other' ? notes.trim() : reason) : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Could not update the payment');
      onDone(
        status === 'verified'
          ? `Approved ${inr(item.amount)} from ${item.name}`
          : `Rejected payment from ${item.name}`,
      );
    } catch (e: any) {
      setError(e.message || 'Could not update the payment');
      setBusy(null);
    }
  };

  keyActions.current.approve = () => submit('verified');

  const copyRef = async () => {
    if (!item.reference) return;
    try {
      await navigator.clipboard.writeText(item.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard blocked */ }
  };

  const waDigits = (item.phone || '').replace(/\D/g, '');
  const waLink = waDigits ? `https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}` : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review payment"
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: amount first — it's what you're verifying */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review payment</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{inr(item.amount)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[item.method?.toUpperCase(), prettyType(item.paymentType), timeAgo(item.createdAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} disabled={!!busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Reference — the thing to match against the bank app */}
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">Transaction / UTR reference</p>
            {item.reference ? (
              <button
                onClick={copyRef}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-sm text-slate-900 hover:border-slate-300"
                title="Copy reference"
              >
                <span className="truncate">{item.reference}</span>
                {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Copy className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No reference was submitted with this payment.</p>
            )}
          </div>

          {/* Who + what */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <div className="min-w-0">
              <dt className="text-[11px] text-slate-500">Customer</dt>
              <dd className="truncate font-medium text-slate-900">{item.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-slate-500">Phone</dt>
              <dd className="flex items-center gap-2 font-medium text-slate-900">
                {item.phone ? (
                  <>
                    <a href={`tel:${item.phone}`} className="truncate hover:text-violet-700">{item.phone}</a>
                    <a href={`tel:${item.phone}`} className="text-slate-400 hover:text-violet-700" aria-label="Call"><Phone className="h-3.5 w-3.5" /></a>
                    {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-600" aria-label="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>}
                  </>
                ) : '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-slate-500">Trip</dt>
              <dd className="truncate font-medium text-slate-900">{item.trip}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Departure · travellers</dt>
              <dd className="font-medium text-slate-900">{fmtDay(item.departure)} · {item.pax}</dd>
            </div>
          </dl>

          {/* Money picture after approval */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-200 text-center tabular-nums">
            <div className="px-2 py-2"><p className="text-[10px] text-slate-500">Trip total</p><p className="text-sm font-semibold text-slate-900">{inr(item.owed)}</p></div>
            <div className="px-2 py-2"><p className="text-[10px] text-slate-500">Paid so far</p><p className="text-sm font-semibold text-slate-900">{inr(item.paid)}</p></div>
            <div className="px-2 py-2"><p className="text-[10px] text-slate-500">Left after this</p><p className={`text-sm font-semibold ${remainingAfter > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{remainingAfter > 0 ? inr(remainingAfter) : 'Fully paid'}</p></div>
          </div>

          {rejecting && (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
              <label className="block text-[11px] font-medium text-rose-800">Reason (sent to the customer)</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-sm text-slate-900">
                {REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setError(''); }}
                rows={2}
                placeholder={reason === 'Other' ? 'Explain why the payment is rejected' : 'Internal note (optional)'}
                className="w-full resize-none rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <Link href={`/admin/bookings/${item.bookingId}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            Open booking <ExternalLink className="h-3 w-3" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {rejecting ? (
              <>
                <button onClick={() => setRejecting(false)} disabled={!!busy} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Back</button>
                <button onClick={() => submit('rejected')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                  {busy === 'rejected' && <Loader2 className="h-4 w-4 animate-spin" />} Reject payment
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setRejecting(true)} disabled={!!busy} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50">Reject <kbd className="ml-1 hidden rounded border border-rose-200 px-1 text-[10px] sm:inline">X</kbd></button>
                <button onClick={() => submit('verified')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {busy === 'verified' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve <kbd className="hidden rounded bg-white/20 px-1 text-[10px] sm:inline">A</kbd>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
