'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Ticket, Tag, Search, X, ArrowLeft, CornerDownLeft } from 'lucide-react';
import OfflineBookingForm from '@/components/admin/OfflineBookingForm';

interface Item {
  key: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  run: () => void;
}

/** "N" anywhere in the admin → create something without hunting for the page. */
export default function QuickAddDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'menu' | 'offline'>('menu');

  useEffect(() => {
    if (open) { setIndex(0); setMode('menu'); }
  }, [open]);

  const go = (href: string) => { onClose(); router.push(href); };

  const items: Item[] = [
    { key: 'trip', label: 'New trip', hint: 'Create a trip or departure', icon: MapPin, shortcut: 'T', run: () => go('/admin/trips/create') },
    { key: 'offline', label: 'Offline booking', hint: 'Walk-in, phone or cash booking', icon: Ticket, shortcut: 'B', run: () => setMode('offline') },
    { key: 'coupon', label: 'New coupon', hint: 'Discount or promo code', icon: Tag, shortcut: 'C', run: () => go('/admin/coupons?new=1') },
    {
      key: 'search', label: 'Find a booking or customer', hint: 'Search by name, phone, booking ID or UTR', icon: Search, shortcut: 'F',
      run: () => { onClose(); window.dispatchEvent(new CustomEvent('admin:open-search')); },
    },
  ];

  useEffect(() => {
    if (!open || mode !== 'menu') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % items.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + items.length) % items.length); return; }
      if (e.key === 'Enter') { e.preventDefault(); items[index]?.run(); return; }
      const hit = items.find((it) => it.shortcut.toLowerCase() === e.key.toLowerCase());
      if (hit && !e.metaKey && !e.ctrlKey) { e.preventDefault(); hit.run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, index]);

  useEffect(() => {
    if (!open || mode !== 'offline') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMode('menu');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode]);

  if (!open) return null;

  if (mode === 'offline') {
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-start sm:p-4 sm:pt-[6vh]" onClick={onClose}>
        <div
          role="dialog"
          aria-label="Offline booking"
          className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <button onClick={() => setMode('menu')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Offline booking</h2>
              <p className="text-xs text-slate-500">Choose trip, batch, passengers, add-ons and the amount collected.</p>
            </div>
            <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="overflow-y-auto p-4 sm:p-5">
            <OfflineBookingForm onCreated={() => { onClose(); onCreated('Offline booking added'); }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 px-4 pt-[14vh] backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-label="Create new" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[13px] font-semibold text-slate-900">Create new</p>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
        </div>
        <ul className="p-2">
          {items.map((it, i) => {
            const Icon = it.icon;
            const active = i === index;
            return (
              <li key={it.key}>
                <button
                  onMouseEnter={() => setIndex(i)}
                  onClick={it.run}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-violet-50' : ''}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white text-violet-600 shadow-sm' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${active ? 'text-violet-800' : 'text-slate-800'}`}>{it.label}</span>
                    <span className="block truncate text-xs text-slate-500">{it.hint}</span>
                  </span>
                  {active ? <CornerDownLeft className="h-3.5 w-3.5 text-violet-500" /> : <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{it.shortcut}</kbd>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
