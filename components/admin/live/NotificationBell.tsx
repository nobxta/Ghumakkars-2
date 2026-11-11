'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Settings2, Volume2, VolumeX, MonitorSmartphone } from 'lucide-react';
import { useAdminLive } from './AdminLiveProvider';
import { EventIcon } from './events';
import { timeAgo } from '@/components/admin/dashboard/utils';

export default function NotificationBell() {
  const router = useRouter();
  const { events, unread, lastSeen, markAllRead, openReview, settings, setSettings, setOverlay, toast } = useAdminLive();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOverlay('bell', open), [open, setOverlay]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggleDesktop = async () => {
    if (settings.desktop) { setSettings({ desktop: false }); return; }
    if (typeof Notification === 'undefined') { toast('This browser does not support desktop notifications', 'error'); return; }
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (perm === 'granted') { setSettings({ desktop: true }); toast('Desktop notifications on'); }
    else toast('Notifications are blocked for this site in your browser settings', 'error');
  };

  const list = events.slice(0, 25);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); setShowSettings(false); }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${open ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-14 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-slide-down sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{unread} new</span>}
            <div className="ml-auto flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setShowSettings((s) => !s)} className={`rounded-md p-1.5 ${showSettings ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} aria-label="Notification settings">
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="space-y-1 border-b border-slate-100 bg-slate-50/70 px-2 py-2">
              <Toggle
                icon={settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                label="Sound for new bookings and payments"
                on={settings.sound}
                onClick={() => setSettings({ sound: !settings.sound })}
              />
              <Toggle
                icon={<MonitorSmartphone className="h-4 w-4" />}
                label="Desktop notifications when this tab is in the background"
                on={settings.desktop}
                onClick={toggleDesktop}
              />
            </div>
          )}

          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto sm:max-h-[420px]">
            {list.length === 0 && (
              <li className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                <p className="text-sm text-slate-500">Nothing in the last two weeks</p>
              </li>
            )}
            {list.map((e) => {
              const isNew = new Date(e.at).getTime() > lastSeen;
              return (
                <li key={e.id} className={`flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 ${isNew ? 'bg-violet-50/40' : ''}`}>
                  <EventIcon type={e.type} />
                  <button onClick={() => { setOpen(false); router.push(e.href); }} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[13px] font-medium text-slate-900">{e.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{e.meta} · {timeAgo(e.at)}</p>
                  </button>
                  {e.type === 'payment_pending' && e.approval ? (
                    <button
                      onClick={() => { setOpen(false); openReview(e.approval); }}
                      className="mt-0.5 shrink-0 rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      Review
                    </button>
                  ) : isNew ? (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" aria-label="Unread" />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
            <Link href="/admin/bookings" onClick={() => setOpen(false)} className="font-medium text-violet-600 hover:text-violet-700">All bookings</Link>
            <span className="text-slate-400">Checks every 15 seconds</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-white">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-violet-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
