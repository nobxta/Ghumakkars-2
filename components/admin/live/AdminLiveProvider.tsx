'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import PaymentReviewDialog, { type ApprovalItem } from '@/components/admin/dashboard/PaymentReviewDialog';
import QuickAddDialog from './QuickAddDialog';
import ShortcutsDialog from './ShortcutsDialog';
import { type ActivityEvent, isTypingTarget } from './events';

/* ───────────────────────────── Types ───────────────────────────── */

type ToastTone = 'success' | 'error' | 'info';
interface ToastAction { label: string; onClick: () => void }
interface Toast { id: number; msg: string; sub?: string; tone: ToastTone; action?: ToastAction }

interface LiveSettings { sound: boolean; desktop: boolean }

interface AdminLiveCtx {
  events: ActivityEvent[];
  unread: number;
  lastSeen: number;
  pendingReview: number;
  loaded: boolean;
  /** Bumps whenever server data probably changed — pages refetch on change. */
  dataVersion: number;
  markAllRead: () => void;
  refresh: () => void;
  notifyChanged: () => void;
  toast: (msg: string, tone?: ToastTone, opts?: { sub?: string; action?: ToastAction }) => void;
  openReview: (item: ApprovalItem) => void;
  /** True while any admin overlay (dialog, palette, menu) is open — page shortcuts pause. */
  overlayOpen: boolean;
  setOverlay: (key: string, open: boolean) => void;
  openQuickAdd: () => void;
  openShortcuts: () => void;
  settings: LiveSettings;
  setSettings: (s: Partial<LiveSettings>) => void;
}

const Ctx = createContext<AdminLiveCtx | null>(null);

export function useAdminLive() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdminLive must be used inside <AdminLiveProvider>');
  return c;
}

const SEEN_KEY = 'gk_admin_notif_seen';
const SETTINGS_KEY = 'gk_admin_live_settings';
const POLL_VISIBLE_MS = 15_000;
const POLL_HIDDEN_MS = 60_000;

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** Short two-note chime — no audio file needed. */
function chime() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
    setTimeout(() => ctx.close?.(), 800);
  } catch { /* audio blocked until user interaction */ }
}

/* ───────────────────────────── Provider ───────────────────────────── */

export default function AdminLiveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [pendingReview, setPendingReview] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reviewing, setReviewing] = useState<ApprovalItem | null>(null);
  const [overlays, setOverlays] = useState<Record<string, boolean>>({});
  const [quickAdd, setQuickAdd] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [settings, setSettingsState] = useState<LiveSettings>({ sound: true, desktop: false });

  const knownIds = useRef<Set<string> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /* ── persisted state ── */
  useEffect(() => {
    const seen = Number(lsGet(SEEN_KEY));
    if (seen) setLastSeen(seen);
    else { const now = Date.now(); setLastSeen(now); lsSet(SEEN_KEY, String(now)); }
    try {
      const s = JSON.parse(lsGet(SETTINGS_KEY) || '{}');
      setSettingsState((cur) => ({ ...cur, ...s, desktop: !!s.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted' }));
    } catch { /* ignore */ }
  }, []);

  const setSettings = useCallback((s: Partial<LiveSettings>) => {
    setSettingsState((cur) => {
      const next = { ...cur, ...s };
      lsSet(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /* ── toasts ── */
  const toast = useCallback<AdminLiveCtx['toast']>((msg, tone = 'success', opts) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, tone, sub: opts?.sub, action: opts?.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 9000 : 4500);
  }, []);

  const openReview = useCallback((item: ApprovalItem) => setReviewing(item), []);
  const notifyChanged = useCallback(() => setDataVersion((v) => v + 1), []);

  /* ── polling ── */
  /** `quiet`: learn new events without announcing them (used after the admin's own actions). */
  const fetchActivity = useCallback(async (quiet = false) => {
    try {
      const res = await fetch('/api/admin/activity?limit=40', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const list: ActivityEvent[] = json.events || [];
      setEvents(list);
      setPendingReview(json.pendingReview || 0);
      setLoaded(true);

      // First load just learns what exists; later loads announce what's new.
      if (!knownIds.current) {
        knownIds.current = new Set(list.map((e) => e.id));
        return;
      }
      const fresh = list.filter((e) => !knownIds.current!.has(e.id));
      fresh.forEach((e) => knownIds.current!.add(e.id));
      if (fresh.length === 0) return;
      if (quiet) { setDataVersion((v) => v + 1); return; }

      setDataVersion((v) => v + 1);
      const s = settingsRef.current;
      if (s.sound && fresh.some((e) => e.type === 'payment_pending' || e.type === 'booking' || e.type === 'payment_received')) chime();

      fresh.slice(0, 3).reverse().forEach((e) => {
        toast(e.title, e.type === 'cancelled' || e.type === 'payment_rejected' ? 'error' : e.type === 'signup' ? 'info' : 'success', {
          sub: e.meta,
          action: e.type === 'payment_pending' && e.approval
            ? { label: 'Review', onClick: () => setReviewing(e.approval) }
            : { label: 'Open', onClick: () => router.push(e.href) },
        });
      });
      if (fresh.length > 3) toast(`${fresh.length - 3} more updates`, 'info');

      if (s.desktop && document.visibilityState === 'hidden' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        fresh.slice(0, 3).forEach((e) => {
          try {
            const n = new Notification(e.title, { body: e.meta, tag: e.id, icon: '/favicon.ico' });
            n.onclick = () => { window.focus(); router.push(e.href); n.close(); };
          } catch { /* not allowed */ }
        });
      }
    } catch { /* offline — try again next tick */ }
  }, [router, toast]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      await fetchActivity(false);
      if (stopped) return;
      timer = setTimeout(loop, document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
    };
    loop();
    const onVis = () => {
      if (document.visibilityState === 'visible') { clearTimeout(timer); loop(); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchActivity]);

  /* ── unread ── */
  const unread = useMemo(() => events.filter((e) => new Date(e.at).getTime() > lastSeen).length, [events, lastSeen]);
  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastSeen(now);
    lsSet(SEEN_KEY, String(now));
  }, []);

  /* ── tab title: "(3) Admin" while payments wait for review ── */
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\)\s+/, '');
      const want = pendingReview > 0 ? `(${pendingReview}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const titleEl = document.querySelector('title');
    const obs = new MutationObserver(apply);
    if (titleEl) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      obs.disconnect();
      document.title = document.title.replace(/^\(\d+\)\s+/, '');
    };
  }, [pendingReview, pathname]);

  /* ── overlays + global shortcuts ── */
  const setOverlay = useCallback((key: string, open: boolean) => {
    setOverlays((o) => (o[key] === open ? o : { ...o, [key]: open }));
  }, []);
  const overlayOpen = quickAdd || shortcuts || !!reviewing || Object.values(overlays).some(Boolean);

  useEffect(() => {
    let pendingG = 0;
    const GO: Record<string, string> = { d: '/admin', b: '/admin/bookings', t: '/admin/trips', p: '/admin/payments', u: '/admin/users', a: '/admin/analytics', s: '/admin/settings' };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (overlayOpen) return;
      const k = e.key.toLowerCase();
      if (pendingG && Date.now() - pendingG < 1200 && GO[k]) {
        e.preventDefault();
        pendingG = 0;
        router.push(GO[k]);
        return;
      }
      pendingG = 0;
      if (k === 'g') { pendingG = Date.now(); return; }
      if (k === 'n') { e.preventDefault(); setQuickAdd(true); }
      else if (e.key === '?') { e.preventDefault(); setShortcuts(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen, router]);

  useEffect(() => { setQuickAdd(false); setShortcuts(false); }, [pathname]);

  const value: AdminLiveCtx = {
    events, unread, lastSeen, pendingReview, loaded, dataVersion,
    markAllRead, refresh: () => fetchActivity(true), notifyChanged, toast, openReview,
    overlayOpen, setOverlay,
    openQuickAdd: () => setQuickAdd(true),
    openShortcuts: () => setShortcuts(true),
    settings, setSettings,
  };

  return (
    <Ctx.Provider value={value}>
      {children}

      <PaymentReviewDialog
        item={reviewing}
        onClose={() => setReviewing(null)}
        onDone={(msg, tone) => {
          setReviewing(null);
          toast(msg, tone || 'success');
          notifyChanged();
          fetchActivity(true);
        }}
      />
      <QuickAddDialog
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        onCreated={(msg) => { toast(msg); notifyChanged(); fetchActivity(true); }}
      />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />

      {/* Toast stack — above the mobile bottom nav */}
      <div className="pointer-events-none fixed bottom-20 right-3 z-[95] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 md:bottom-5 md:right-5" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
          const tone = t.tone === 'success' ? 'text-emerald-600' : t.tone === 'error' ? 'text-rose-600' : 'text-violet-600';
          return (
            <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm shadow-lg shadow-slate-900/5 animate-slide-up">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{t.msg}</p>
                {t.sub && <p className="truncate text-xs text-slate-500">{t.sub}</p>}
              </div>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}
                  className="shrink-0 rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="shrink-0 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
