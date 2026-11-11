'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: 'Anywhere',
    rows: [
      [['Ctrl', 'K'], 'Search pages, bookings, customers, trips, payments'],
      [['N'], 'Create new (trip, offline booking, coupon)'],
      [['['], 'Collapse or expand the sidebar'],
      [['?'], 'Show this list'],
    ],
  },
  {
    title: 'Go to',
    rows: [
      [['G', 'D'], 'Dashboard'],
      [['G', 'B'], 'Bookings'],
      [['G', 'T'], 'Trips'],
      [['G', 'P'], 'Payments'],
      [['G', 'U'], 'Users'],
      [['G', 'A'], 'Analytics'],
      [['G', 'S'], 'Settings'],
    ],
  },
  {
    title: 'Dashboard: needs your attention',
    rows: [
      [['J'], 'Next item'],
      [['K'], 'Previous item'],
      [['Enter'], 'Open the selected item'],
      [['A'], 'Review the selected payment'],
      [['R'], 'Send a WhatsApp reminder'],
    ],
  },
  {
    title: 'Payment review popup',
    rows: [
      [['A'], 'Approve'],
      [['X'], 'Reject'],
      [['Esc'], 'Close'],
    ],
  },
];

export default function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-[8vh] backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-label="Keyboard shortcuts" className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Keyboard shortcuts</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
              <ul className="space-y-1.5">
                {g.rows.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-slate-600">{label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k, i) => (
                        <kbd key={i} className="min-w-[22px] rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-[11px] font-semibold text-slate-600">
                          {k === 'Ctrl' && mac ? '⌘' : k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
