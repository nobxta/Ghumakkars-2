'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Gift,
  Info,
  LayoutGrid,
  Loader2,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdornedInput,
  Field,
  KeyValue,
  LoadError,
  PanelSkeleton,
  Pill,
  SaveBar,
  Section,
  Sheet,
  Switch,
  btn,
  inputCls,
  textareaCls,
  timeAgo,
  toneDot,
  type Tone,
} from '@/components/admin/settings/ui';

/* ───────────────────────────── types ───────────────────────────── */

type TabKey = 'overview' | 'payment' | 'whatsapp' | 'telegram';
const TAB_KEYS: TabKey[] = ['overview', 'payment', 'whatsapp', 'telegram'];

type Load<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };

type PaymentMode = 'manual' | 'razorpay' | 'both';
type PaymentSettings = {
  payment_mode: PaymentMode;
  referral_reward_amount: number;
  referral_friend_reward_amount: number;
  seat_lock_due_days_before: number;
  allow_cash_payment: boolean;
  updated_at: string | null;
  razorpay: { configured: boolean; webhookConfigured: boolean; status: string };
};
type PaymentForm = {
  payment_mode: PaymentMode;
  allow_cash_payment: boolean;
  seat_lock_due_days_before: string;
  referral_reward_amount: string;
  referral_friend_reward_amount: string;
};

type ManualMethod = {
  id: string;
  nickname: string;
  upi_id: string;
  payee_name: string;
  qr_image_url: string | null;
  instructions: string | null;
  is_enabled: boolean;
  is_default: boolean;
  display_order: number;
};
type MethodDraft = {
  id?: string;
  nickname: string;
  upi_id: string;
  payee_name: string;
  instructions: string;
  is_default: boolean;
  qr_image: File | null;
  qr_preview: string;
  remove_qr: boolean;
};

type WaStatus = {
  configured?: boolean;
  online?: boolean;
  connected: boolean;
  state?: string;
  number?: string | null;
  qr?: string | null;
  error?: string | null;
  relinkRequired?: boolean;
  queued?: number;
  lastConnectedAt?: string | null;
  lastMessageAt?: string | null;
};

type TgSettings = {
  enabled: boolean;
  bot_username: string | null;
  admin_chat_ids: string[];
  notify_new_booking: boolean;
  notify_payments: boolean;
  updated_at: string | null;
  has_bot_token: boolean;
  masked_bot_token: string | null;
  webhook_status: string;
};
type TgForm = {
  enabled: boolean;
  bot_token: string;
  admin_chat_ids: string[];
  notify_new_booking: boolean;
  notify_payments: boolean;
};

type Toast = { id: number; type: 'success' | 'error'; message: string };
type Issue = { tone: Tone; text: string; tab: TabKey };

/* ──────────────────────────── helpers ──────────────────────────── */

async function getJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const MODE_LABEL: Record<PaymentMode, string> = { manual: 'UPI / QR', razorpay: 'Razorpay', both: 'UPI + Razorpay' };

const toPaymentForm = (p: PaymentSettings): PaymentForm => ({
  payment_mode: p.payment_mode,
  allow_cash_payment: p.allow_cash_payment,
  seat_lock_due_days_before: String(p.seat_lock_due_days_before),
  referral_reward_amount: String(p.referral_reward_amount),
  referral_friend_reward_amount: String(p.referral_friend_reward_amount),
});

const normalizeTg = (raw: any): TgSettings => ({
  enabled: !!raw?.enabled,
  bot_username: raw?.bot_username ?? raw?.botUsername ?? null,
  admin_chat_ids: Array.isArray(raw?.admin_chat_ids) ? raw.admin_chat_ids.map(String) : [],
  notify_new_booking: raw?.notify_new_booking !== false,
  notify_payments: raw?.notify_payments !== false,
  updated_at: raw?.updated_at ?? null,
  has_bot_token: !!raw?.has_bot_token,
  masked_bot_token: raw?.masked_bot_token ?? null,
  webhook_status: raw?.webhook_status || 'not_configured',
});

const toTgForm = (t: TgSettings): TgForm => ({
  enabled: t.enabled,
  bot_token: '',
  admin_chat_ids: t.admin_chat_ids,
  notify_new_booking: t.notify_new_booking,
  notify_payments: t.notify_payments,
});

function validatePayment(f: PaymentForm) {
  const errors: Partial<Record<keyof PaymentForm, string>> = {};
  const due = Number(f.seat_lock_due_days_before);
  if (f.seat_lock_due_days_before.trim() === '' || !Number.isInteger(due) || due < 0 || due > 60) errors.seat_lock_due_days_before = 'Whole number from 0 to 60';
  for (const k of ['referral_reward_amount', 'referral_friend_reward_amount'] as const) {
    const n = Number(f[k]);
    if (f[k].trim() === '' || !Number.isFinite(n) || n < 0) errors[k] = 'Enter 0 or more';
  }
  return errors;
}

/* ───────────────────────────── page ────────────────────────────── */

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <SettingsScreen />
    </Suspense>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The active tab lives in the URL (?tab=…) so refresh, deep links and Back/Forward all work.
  const rawTab = searchParams.get('tab');
  const activeTab: TabKey = (TAB_KEYS as string[]).includes(rawTab || '') ? (rawTab as TabKey) : 'overview';

  const goTab = useCallback(
    (key: TabKey, mode: 'push' | 'replace' = 'push') => {
      if (key === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      if (key === 'overview') params.delete('tab');
      else params.set('tab', key);
      const qs = params.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [activeTab, pathname, router, searchParams],
  );

  /* ── toast ── */
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number>();
  const notify = useCallback((message: string, type: Toast['type'] = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* ── data: each source loads on its own so a slow one never blocks the others ── */
  const [payment, setPayment] = useState<Load<PaymentSettings>>({ status: 'loading' });
  const [paymentForm, setPaymentForm] = useState<PaymentForm | null>(null);
  const [methods, setMethods] = useState<Load<ManualMethod[]>>({ status: 'loading' });
  const [wa, setWa] = useState<Load<WaStatus>>({ status: 'loading' });
  const [tg, setTg] = useState<Load<TgSettings>>({ status: 'loading' });
  const [tgForm, setTgForm] = useState<TgForm | null>(null);

  const loadPayment = useCallback(async () => {
    setPayment({ status: 'loading' });
    try {
      const d = await getJSON<{ payment: PaymentSettings }>('/api/admin/settings');
      setPayment({ status: 'ready', data: d.payment });
      setPaymentForm(toPaymentForm(d.payment));
    } catch (e) {
      setPayment({ status: 'error', error: errMsg(e, 'Unknown error') });
    }
  }, []);

  const loadMethods = useCallback(async (silent = false) => {
    if (!silent) setMethods({ status: 'loading' });
    try {
      const d = await getJSON<{ methods: ManualMethod[] }>('/api/admin/manual-payment-methods');
      const list = [...(d.methods || [])].sort((a, b) => a.display_order - b.display_order);
      setMethods({ status: 'ready', data: list });
    } catch (e) {
      if (!silent) setMethods({ status: 'error', error: errMsg(e, 'Unknown error') });
    }
  }, []);

  const loadWa = useCallback(async (silent = false) => {
    if (!silent) setWa({ status: 'loading' });
    try {
      const d = await getJSON<WaStatus>('/api/admin/whatsapp');
      setWa({ status: 'ready', data: d });
      return d;
    } catch (e) {
      if (!silent) setWa({ status: 'error', error: errMsg(e, 'Unknown error') });
      return null;
    }
  }, []);

  const loadTg = useCallback(async (keepForm = false) => {
    if (!keepForm) setTg({ status: 'loading' });
    try {
      const d = normalizeTg(await getJSON('/api/admin/telegram-settings'));
      setTg({ status: 'ready', data: d });
      if (!keepForm) setTgForm(toTgForm(d));
    } catch (e) {
      setTg({ status: 'error', error: errMsg(e, 'Unknown error') });
    }
  }, []);

  useEffect(() => {
    loadPayment();
    loadMethods();
    loadWa();
    loadTg();
  }, [loadPayment, loadMethods, loadWa, loadTg]);

  /* ── dirty tracking ── */
  const paymentDirty =
    payment.status === 'ready' && !!paymentForm && JSON.stringify(paymentForm) !== JSON.stringify(toPaymentForm(payment.data));
  const tgDirty = tg.status === 'ready' && !!tgForm && JSON.stringify(tgForm) !== JSON.stringify(toTgForm(tg.data));
  const anyDirty = paymentDirty || tgDirty;

  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  const refreshAll = () => {
    if (anyDirty && !confirm('Refreshing will discard your unsaved changes. Continue?')) return;
    loadPayment();
    loadMethods();
    loadWa();
    loadTg();
  };

  /* ── derived status (all from real API data) ── */
  const receiving = methods.status === 'ready' ? methods.data.find((m) => m.is_default) || null : null;

  const issues = useMemo<Issue[]>(() => {
    const out: Issue[] = [];
    if (payment.status === 'error') out.push({ tone: 'error', text: 'Payment settings failed to load', tab: 'payment' });
    if (methods.status === 'error') out.push({ tone: 'error', text: 'UPI / QR methods failed to load', tab: 'payment' });
    if (wa.status === 'error') out.push({ tone: 'error', text: 'WhatsApp status failed to load', tab: 'whatsapp' });
    if (tg.status === 'error') out.push({ tone: 'error', text: 'Telegram settings failed to load', tab: 'telegram' });

    if (payment.status === 'ready') {
      const p = payment.data;
      const usesManual = p.payment_mode !== 'razorpay';
      const usesRzp = p.payment_mode !== 'manual';
      if (usesManual && methods.status === 'ready' && !methods.data.some((m) => m.is_default))
        out.push({ tone: 'error', text: 'No UPI / QR is set to receive payments — customers will see no UPI details', tab: 'payment' });
      if (usesRzp && !p.razorpay.configured)
        out.push({ tone: 'error', text: 'Razorpay is selected but its keys are missing on the server', tab: 'payment' });
      if (usesRzp && p.razorpay.configured && !p.razorpay.webhookConfigured)
        out.push({ tone: 'warn', text: 'Razorpay webhook secret is missing on the server', tab: 'payment' });
    }
    if (wa.status === 'ready') {
      const w = wa.data;
      if (w.relinkRequired) out.push({ tone: 'error', text: 'WhatsApp logged this server out — link the number again', tab: 'whatsapp' });
      else if (!w.connected) out.push({ tone: 'warn', text: 'WhatsApp isn’t linked — customers won’t get booking messages there', tab: 'whatsapp' });
      if (w.connected && (w.queued || 0) > 0) out.push({ tone: 'warn', text: `${w.queued} WhatsApp message(s) waiting to send`, tab: 'whatsapp' });
    }
    if (tg.status === 'ready') {
      const t = tg.data;
      if (!t.has_bot_token) out.push({ tone: 'muted', text: 'Telegram alerts aren’t set up', tab: 'telegram' });
      else if (!t.enabled) out.push({ tone: 'muted', text: 'Telegram alerts are switched off', tab: 'telegram' });
      else {
        if (!t.admin_chat_ids.length) out.push({ tone: 'warn', text: 'Telegram is on but has no chat to send alerts to', tab: 'telegram' });
        if (t.webhook_status === 'webhook_error') out.push({ tone: 'error', text: 'Telegram webhook is reporting errors — Approve/Reject buttons may not work', tab: 'telegram' });
        else if (t.webhook_status !== 'connected') out.push({ tone: 'warn', text: 'Telegram webhook isn’t connected — Approve/Reject buttons won’t work', tab: 'telegram' });
      }
    }
    return out;
  }, [payment, methods, wa, tg]);

  const tabMeta: Record<TabKey, { label: string; icon: React.ElementType; hint: string; tone: Tone; dirty?: boolean }> = {
    overview: {
      label: 'Overview',
      icon: LayoutGrid,
      hint: issues.some((i) => i.tone !== 'muted') ? `${issues.filter((i) => i.tone !== 'muted').length} to review` : 'All good',
      tone: issues.some((i) => i.tone === 'error') ? 'error' : issues.some((i) => i.tone === 'warn') ? 'warn' : 'ok',
    },
    payment: {
      label: 'Payments',
      icon: CreditCard,
      hint: payment.status === 'ready' ? MODE_LABEL[payment.data.payment_mode] : payment.status === 'error' ? 'Failed to load' : 'Loading…',
      tone: payment.status !== 'ready' ? (payment.status === 'error' ? 'error' : 'loading') : issues.some((i) => i.tab === 'payment' && i.tone === 'error') ? 'error' : 'ok',
      dirty: paymentDirty,
    },
    whatsapp: {
      label: 'WhatsApp',
      icon: MessageCircle,
      hint: wa.status === 'ready' ? (wa.data.connected ? 'Connected' : 'Not linked') : wa.status === 'error' ? 'Failed to load' : 'Checking…',
      tone: wa.status === 'ready' ? (wa.data.connected ? 'ok' : 'warn') : wa.status === 'error' ? 'error' : 'loading',
    },
    telegram: {
      label: 'Telegram',
      icon: Send,
      hint: tg.status === 'ready' ? (!tg.data.has_bot_token ? 'Not set up' : tg.data.enabled ? 'On' : 'Off') : tg.status === 'error' ? 'Failed to load' : 'Checking…',
      tone: tg.status === 'ready' ? (!tg.data.has_bot_token || !tg.data.enabled ? 'muted' : tg.data.webhook_status === 'connected' && tg.data.admin_chat_ids.length ? 'ok' : 'warn') : tg.status === 'error' ? 'error' : 'loading',
      dirty: tgDirty,
    },
  };

  /* ── scroll the panel into view on tab change if the user had scrolled past it ── */
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = panelRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 80) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + top - 132, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [activeTab]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Settings</h1>
          <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">Payments, messaging and alerts for Ghumakkars.</p>
        </div>
        <button type="button" onClick={refreshAll} className={btn.secondary} aria-label="Reload all settings">
          <RefreshCw className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Reload</span>
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
        <TabNav tabs={tabMeta} active={activeTab} onSelect={goTab} />

        <div
          ref={panelRef}
          role="tabpanel"
          id={`settings-panel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          tabIndex={-1}
          className="min-w-0 space-y-4 pt-4 focus:outline-none lg:pt-0"
        >
          {activeTab === 'overview' && (
            <OverviewPanel issues={issues} payment={payment} receiving={receiving} methods={methods} wa={wa} tg={tg} goTab={goTab} />
          )}
          {activeTab === 'payment' && (
            <PaymentPanel
              payment={payment}
              form={paymentForm}
              setForm={setPaymentForm}
              dirty={paymentDirty}
              methods={methods}
              setMethods={setMethods}
              reloadPayment={loadPayment}
              reloadMethods={loadMethods}
              onSaved={(p) => {
                setPayment({ status: 'ready', data: p });
                setPaymentForm(toPaymentForm(p));
              }}
              notify={notify}
            />
          )}
          {activeTab === 'whatsapp' && <WhatsAppPanel wa={wa} reload={loadWa} notify={notify} />}
          {activeTab === 'telegram' && (
            <TelegramPanel
              tg={tg}
              form={tgForm}
              setForm={setTgForm}
              dirty={tgDirty}
              reload={loadTg}
              onSaved={(t) => {
                setTg({ status: 'ready', data: t });
                setTgForm(toTgForm(t));
              }}
              notify={notify}
            />
          )}
        </div>
      </div>

      {toast && (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className="fixed inset-x-3 top-16 z-[80] mx-auto flex max-w-sm items-start gap-3 rounded-xl border bg-white p-3.5 shadow-xl motion-safe:animate-[gk-rise_.18s_ease-out] sm:inset-x-auto sm:right-5 sm:top-20 sm:w-96"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden />
          )}
          <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="no-min-touch -m-1 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── tab nav ──────────────────────────── */

function TabNav({
  tabs,
  active,
  onSelect,
}: {
  tabs: Record<TabKey, { label: string; icon: React.ElementType; hint: string; tone: Tone; dirty?: boolean }>;
  active: TabKey;
  onSelect: (key: TabKey, mode?: 'push' | 'replace') => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrolledOnce = useRef(false);

  // Keep the active pill visible in the horizontal (mobile) strip.
  useEffect(() => {
    const first = !scrolledOnce.current;
    scrolledOnce.current = true;
    const raf = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const el = scroller?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!scroller || !el || scroller.scrollWidth <= scroller.clientWidth) return;
      const left = el.offsetLeft - scroller.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
      scroller.scrollTo({ left, behavior: first ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // WAI-ARIA tabs keyboard model. Arrow keys replace history so Back still goes to the previous page.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TAB_KEYS.indexOf(active);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % TAB_KEYS.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TAB_KEYS.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(TAB_KEYS[next], 'replace');
    requestAnimationFrame(() => document.getElementById(`settings-tab-${TAB_KEYS[next!]}`)?.focus());
  };

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-14 z-20 -mx-3 border-b border-slate-200/80 bg-[#F8F9FB]/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-[#F8F9FB]/75 sm:-mx-6 sm:px-6 md:top-16 lg:top-24 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none"
    >
      <div
        ref={scrollerRef}
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:py-0 [&::-webkit-scrollbar]:hidden"
      >
        {TAB_KEYS.map((key) => {
          const t = tabs[key];
          const selected = key === active;
          const Icon = t.icon;
          return (
            <button
              key={key}
              id={`settings-tab-${key}`}
              data-tab={key}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`settings-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(key)}
              className={`group relative flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 lg:w-full lg:gap-3 lg:px-3 lg:py-2.5 ${
                selected
                  ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition lg:h-8 lg:w-8 ${
                  selected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap leading-tight">{t.label}</span>
                <span className="hidden truncate text-xs font-medium text-slate-500 lg:block">{t.hint}</span>
              </span>
              {t.dirty ? (
                <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700" title="Unsaved changes">
                  <span className="lg:hidden">•</span>
                  <span className="hidden lg:inline">Unsaved</span>
                </span>
              ) : (
                <span className={`ml-auto h-2 w-2 flex-shrink-0 rounded-full ${toneDot[t.tone]}`} title={t.hint} aria-label={t.hint} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ──────────────────────────── overview ─────────────────────────── */

function OverviewPanel({
  issues,
  payment,
  receiving,
  methods,
  wa,
  tg,
  goTab,
}: {
  issues: Issue[];
  payment: Load<PaymentSettings>;
  receiving: ManualMethod | null;
  methods: Load<ManualMethod[]>;
  wa: Load<WaStatus>;
  tg: Load<TgSettings>;
  goTab: (k: TabKey) => void;
}) {
  const loading = [payment, methods, wa, tg].some((l) => l.status === 'loading');
  const serious = issues.filter((i) => i.tone !== 'muted');

  return (
    <>
      <Section
        title={loading ? 'Checking your setup…' : serious.length ? 'Needs attention' : 'Everything is set up'}
        description={loading ? 'Reading live status from each service.' : serious.length ? 'Live checks from your payment and messaging services.' : 'All live checks passed.'}
        icon={loading ? Loader2 : serious.length ? AlertTriangle : CheckCircle2}
        flush
      >
        {issues.length > 0 ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {issues.map((issue) => (
              <li key={issue.text}>
                <button
                  type="button"
                  onClick={() => goTab(issue.tab)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:px-5"
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${toneDot[issue.tone]}`} aria-hidden />
                  <span className="flex-1 text-slate-700">{issue.text}</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="pb-1" />
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="Payments" icon={CreditCard} onOpen={() => goTab('payment')} load={payment}>
          {(p) => (
            <KeyValue
              items={[
                { label: 'Online payment', value: MODE_LABEL[p.payment_mode] },
                { label: 'Pay in person', value: p.allow_cash_payment ? 'Allowed' : 'Off' },
                { label: 'Balance due', value: `${p.seat_lock_due_days_before} days before trip` },
                { label: 'Referral reward', value: `₹${p.referral_reward_amount} + ₹${p.referral_friend_reward_amount} friend` },
              ]}
            />
          )}
        </SummaryCard>

        <SummaryCard title="Receiving UPI / QR" icon={QrCode} onOpen={() => goTab('payment')} load={methods}>
          {(list) =>
            receiving ? (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {receiving.qr_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receiving.qr_image_url} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <QrCode className="h-6 w-6 text-slate-400" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold text-slate-900">{receiving.nickname}</p>
                  <p className="truncate font-mono text-purple-700">{receiving.upi_id}</p>
                  <p className="truncate text-slate-500">
                    {receiving.payee_name} · {list.length} saved
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{list.length ? `${list.length} saved, none selected to receive payments.` : 'No UPI / QR added yet.'}</p>
            )
          }
        </SummaryCard>

        <SummaryCard title="WhatsApp" icon={MessageCircle} onOpen={() => goTab('whatsapp')} load={wa}>
          {(w) => (
            <KeyValue
              items={[
                { label: 'Status', value: <Pill tone={w.connected ? 'ok' : 'warn'}>{w.connected ? 'Connected' : 'Not linked'}</Pill> },
                { label: 'Number', value: w.number ? `+${w.number}` : '—' },
                { label: 'Last message', value: timeAgo(w.lastMessageAt) || '—' },
              ]}
            />
          )}
        </SummaryCard>

        <SummaryCard title="Telegram alerts" icon={Send} onOpen={() => goTab('telegram')} load={tg}>
          {(t) => (
            <KeyValue
              items={[
                {
                  label: 'Alerts',
                  value: <Pill tone={!t.has_bot_token ? 'muted' : t.enabled ? 'ok' : 'muted'}>{!t.has_bot_token ? 'Not set up' : t.enabled ? 'On' : 'Off'}</Pill>,
                },
                { label: 'Bot', value: t.bot_username ? `@${t.bot_username}` : '—' },
                { label: 'Chats', value: t.admin_chat_ids.length || '—' },
                { label: 'Webhook', value: t.webhook_status === 'connected' ? 'Connected' : t.webhook_status === 'webhook_error' ? 'Error' : 'Not connected' },
              ]}
            />
          )}
        </SummaryCard>
      </div>
    </>
  );
}

function SummaryCard<T>({
  title,
  icon: Icon,
  load,
  onOpen,
  children,
}: {
  title: string;
  icon: React.ElementType;
  load: Load<T>;
  onOpen: () => void;
  children: (data: T) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon className="h-4 w-4 text-purple-600" aria-hidden />
          {title}
        </h3>
        <button type="button" onClick={onOpen} className="no-min-touch inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50">
          Manage <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="flex-1">
        {load.status === 'loading' && (
          <div className="space-y-2.5" aria-busy="true">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        )}
        {load.status === 'error' && <p className="text-sm text-red-600">Couldn&apos;t load: {load.error}</p>}
        {load.status === 'ready' && children(load.data)}
      </div>
    </div>
  );
}

/* ──────────────────────────── payments ─────────────────────────── */

const emptyDraft: MethodDraft = {
  nickname: '',
  upi_id: '',
  payee_name: '',
  instructions: '',
  is_default: false,
  qr_image: null,
  qr_preview: '',
  remove_qr: false,
};

function methodForm(d: MethodDraft) {
  const form = new FormData();
  form.set('nickname', d.nickname.trim());
  form.set('upi_id', d.upi_id.trim());
  form.set('payee_name', d.payee_name.trim());
  form.set('instructions', d.instructions.trim());
  form.set('is_enabled', 'true');
  form.set('is_default', String(d.is_default));
  if (d.remove_qr) form.set('remove_qr', 'true');
  if (d.qr_image) form.set('qr_image', d.qr_image);
  return form;
}

function PaymentPanel({
  payment,
  form,
  setForm,
  dirty,
  methods,
  setMethods,
  reloadPayment,
  reloadMethods,
  onSaved,
  notify,
}: {
  payment: Load<PaymentSettings>;
  form: PaymentForm | null;
  setForm: (f: PaymentForm) => void;
  dirty: boolean;
  methods: Load<ManualMethod[]>;
  setMethods: (l: Load<ManualMethod[]>) => void;
  reloadPayment: () => void;
  reloadMethods: (silent?: boolean) => Promise<void>;
  onSaved: (p: PaymentSettings) => void;
  notify: (m: string, t?: 'success' | 'error') => void;
}) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MethodDraft | null>(null);
  const [busyId, setBusyId] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  if (payment.status === 'loading' || !form) {
    return payment.status === 'error' ? <LoadError what="payment settings" error={payment.error} onRetry={reloadPayment} /> : <PanelSkeleton />;
  }
  if (payment.status === 'error') return <LoadError what="payment settings" error={payment.error} onRetry={reloadPayment} />;

  const p = payment.data;
  const list = methods.status === 'ready' ? methods.data : [];
  const hasReceiving = list.some((m) => m.is_default);
  const errors = validatePayment(form);
  const shownErrors = showErrors ? errors : {};

  const modeOptions: { value: PaymentMode; label: string; detail: string; disabled: boolean }[] = [
    {
      value: 'manual',
      label: 'UPI / QR only',
      detail: hasReceiving ? 'Customer pays to your UPI and uploads a screenshot for approval.' : 'Add a UPI / QR below and set it to receive first.',
      disabled: !hasReceiving,
    },
    {
      value: 'razorpay',
      label: 'Razorpay only',
      detail: p.razorpay.configured ? 'Card / UPI / netbanking, confirmed automatically.' : 'Razorpay keys are not set on the server.',
      disabled: !p.razorpay.configured,
    },
    {
      value: 'both',
      label: 'Both',
      detail: 'Customer chooses UPI / QR or Razorpay at checkout.',
      disabled: !hasReceiving || !p.razorpay.configured,
    },
  ];

  const save = async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      notify('Fix the highlighted fields first', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await getJSON<{ payment: PaymentSettings }>('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'payment',
          payment_mode: form.payment_mode,
          allow_cash_payment: form.allow_cash_payment,
          seat_lock_due_days_before: Number(form.seat_lock_due_days_before),
          referral_reward_amount: Number(form.referral_reward_amount),
          referral_friend_reward_amount: Number(form.referral_friend_reward_amount),
        }),
      });
      onSaved({ ...p, ...data.payment, razorpay: data.payment.razorpay || p.razorpay });
      setShowErrors(false);
      notify('Payment settings saved');
    } catch (e) {
      notify(errMsg(e, 'Could not save payment settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const setReceiving = async (m: ManualMethod) => {
    setBusyId(m.id);
    try {
      await getJSON(`/api/admin/manual-payment-methods/${m.id}`, {
        method: 'PATCH',
        body: methodForm({ ...emptyDraft, id: m.id, nickname: m.nickname, upi_id: m.upi_id, payee_name: m.payee_name, instructions: m.instructions || '', is_default: true }),
      });
      await reloadMethods(true);
      notify(`${m.nickname} now receives payments`);
    } catch (e) {
      notify(errMsg(e, 'Could not switch payment method'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (m: ManualMethod) => {
    if (!confirm(`Delete “${m.nickname}”?\n\nExisting bookings keep the payment details they were made with.`)) return;
    setBusyId(m.id);
    try {
      await getJSON(`/api/admin/manual-payment-methods/${m.id}`, { method: 'DELETE' });
      await reloadMethods(true);
      notify('Payment method deleted');
    } catch (e) {
      notify(errMsg(e, 'Could not delete payment method'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const move = async (m: ManualMethod, dir: -1 | 1) => {
    const prev = list;
    const ordered = [...list];
    const i = ordered.findIndex((x) => x.id === m.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    setMethods({ status: 'ready', data: ordered.map((x, k) => ({ ...x, display_order: k })) });
    try {
      await getJSON('/api/admin/manual-payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', ids: ordered.map((x) => x.id) }),
      });
    } catch (e) {
      setMethods({ status: 'ready', data: prev });
      notify(errMsg(e, 'Could not reorder'), 'error');
    }
  };

  return (
    <>
      <Section title="How customers pay online" description="Only options that are actually set up can be picked." icon={CreditCard}>
        <div role="radiogroup" aria-label="Online payment mode" className="grid gap-2.5 md:grid-cols-3">
          {modeOptions.map((o) => {
            const selected = form.payment_mode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={o.disabled && !selected}
                onClick={() => setForm({ ...form, payment_mode: o.value })}
                className={`relative rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected ? 'border-purple-500 bg-purple-50/70 ring-1 ring-purple-500' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${selected ? 'border-purple-600' : 'border-slate-300'}`} aria-hidden>
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />}
                  </span>
                  <span className="text-sm font-bold text-slate-950">{o.label}</span>
                </span>
                <span className="mt-1.5 block pl-6 text-xs leading-relaxed text-slate-500">{o.detail}</span>
              </button>
            );
          })}
        </div>
        {modeOptions.find((o) => o.value === form.payment_mode)?.disabled && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            The current mode isn&apos;t fully set up — customers may not be able to pay online.
          </p>
        )}
        <div className="mt-4">
          <Switch
            checked={form.allow_cash_payment}
            onChange={(v) => setForm({ ...form, allow_cash_payment: v })}
            label="Allow pay in person"
            description="Customers can book now and pay cash on arrival. Turn off to require online payment."
          />
        </div>
      </Section>

      <Section
        title="UPI / QR methods"
        description="The one marked Receiving is shown on the payment page. Keep others saved to switch any time."
        icon={QrCode}
        action={
          methods.status === 'ready' && (
            <button type="button" onClick={() => setDraft({ ...emptyDraft, is_default: list.length === 0 })} className={btn.primary}>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          )
        }
        flush
      >
        {methods.status === 'loading' && (
          <div className="space-y-2 px-4 pb-4 sm:px-5">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          </div>
        )}
        {methods.status === 'error' && (
          <div className="px-4 pb-4 sm:px-5">
            <LoadError what="UPI / QR methods" error={methods.error} onRetry={() => reloadMethods()} />
          </div>
        )}
        {methods.status === 'ready' && list.length === 0 && (
          <div className="mx-4 mb-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center sm:mx-5 sm:mb-5">
            <QrCode className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-slate-700">No UPI / QR yet</p>
            <p className="mt-1 text-xs text-slate-500">Add your UPI ID (and QR image if you have one) to accept UPI payments.</p>
          </div>
        )}
        {methods.status === 'ready' && list.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {list.map((m, i) => (
              <li key={m.id} className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5 ${m.is_default ? 'bg-emerald-50/40' : ''}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {m.qr_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.qr_image_url} alt={`${m.nickname} QR`} loading="lazy" className="h-full w-full object-contain p-1" />
                    ) : (
                      <QrCode className="h-5 w-5 text-slate-300" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-950">{m.nickname}</p>
                      {m.is_default && <Pill tone="ok">Receiving</Pill>}
                    </div>
                    <p className="truncate font-mono text-sm text-purple-700">{m.upi_id}</p>
                    <p className="truncate text-xs text-slate-500">{m.payee_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pl-[68px] sm:pl-0">
                  {!m.is_default && (
                    <button type="button" onClick={() => setReceiving(m)} disabled={!!busyId} className={`${btn.secondary} h-9 px-3`}>
                      {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      Use this
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...emptyDraft,
                        id: m.id,
                        nickname: m.nickname,
                        upi_id: m.upi_id,
                        payee_name: m.payee_name,
                        instructions: m.instructions || '',
                        is_default: m.is_default,
                        qr_preview: m.qr_image_url || '',
                      })
                    }
                    className={btn.icon}
                    aria-label={`Edit ${m.nickname}`}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {list.length > 1 && (
                    <>
                      <button type="button" onClick={() => move(m, -1)} disabled={i === 0} className={btn.icon} aria-label="Move up" title="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => move(m, 1)} disabled={i === list.length - 1} className={btn.icon} aria-label="Move down" title="Move down">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    disabled={!!busyId}
                    className={`${btn.icon} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                    aria-label={`Delete ${m.nickname}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Balance & referrals" description="Used by seat-lock reminders and referral payouts." icon={Gift}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Balance due" htmlFor="due-days" hint="Days before departure" error={shownErrors.seat_lock_due_days_before}>
            <AdornedInput
              id="due-days"
              inputMode="numeric"
              suffix="days before"
              value={form.seat_lock_due_days_before}
              invalid={!!shownErrors.seat_lock_due_days_before}
              onChange={(e) => setForm({ ...form, seat_lock_due_days_before: e.target.value.replace(/[^\d]/g, '') })}
            />
          </Field>
          <Field label="Referrer reward" htmlFor="ref-reward" hint="Paid to the person who referred" error={shownErrors.referral_reward_amount}>
            <AdornedInput
              id="ref-reward"
              inputMode="decimal"
              prefix="₹"
              value={form.referral_reward_amount}
              invalid={!!shownErrors.referral_reward_amount}
              onChange={(e) => setForm({ ...form, referral_reward_amount: e.target.value.replace(/[^\d.]/g, '') })}
            />
          </Field>
          <Field label="Friend bonus" htmlFor="friend-reward" hint="Given to the new traveller" error={shownErrors.referral_friend_reward_amount}>
            <AdornedInput
              id="friend-reward"
              inputMode="decimal"
              prefix="₹"
              value={form.referral_friend_reward_amount}
              invalid={!!shownErrors.referral_friend_reward_amount}
              onChange={(e) => setForm({ ...form, referral_friend_reward_amount: e.target.value.replace(/[^\d.]/g, '') })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Razorpay" description="Keys live in the server environment and are never sent to the browser." icon={Banknote}>
        <div className="flex flex-wrap gap-2">
          <Pill tone={p.razorpay.configured ? 'ok' : 'error'}>{p.razorpay.configured ? 'API keys set' : 'API keys missing'}</Pill>
          <Pill tone={p.razorpay.webhookConfigured ? 'ok' : 'warn'}>{p.razorpay.webhookConfigured ? 'Webhook secret set' : 'Webhook secret missing'}</Pill>
        </div>
        {(!p.razorpay.configured || !p.razorpay.webhookConfigured) && (
          <p className="mt-3 text-sm text-slate-500">
            Add{' '}
            {[!p.razorpay.configured && 'RAZORPAY_KEY_ID', !p.razorpay.configured && 'RAZORPAY_KEY_SECRET', !p.razorpay.webhookConfigured && 'RAZORPAY_WEBHOOK_SECRET']
              .filter(Boolean)
              .map((k, i, arr) => (
                <span key={k as string}>
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700">{k}</code>
                  {i < arr.length - 1 ? ', ' : ''}
                </span>
              ))}{' '}
            to the deployment environment, then redeploy.
          </p>
        )}
      </Section>

      {p.updated_at && <p className="px-1 text-xs text-slate-400">Payment settings last saved {timeAgo(p.updated_at)}</p>}

      <SaveBar
        visible={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => {
          setForm(toPaymentForm(p));
          setShowErrors(false);
        }}
      />

      <MethodSheet draft={draft} setDraft={setDraft} onSaved={async () => { await reloadMethods(true); }} notify={notify} />
    </>
  );
}

function MethodSheet({
  draft,
  setDraft,
  onSaved,
  notify,
}: {
  draft: MethodDraft | null;
  setDraft: (d: MethodDraft | null) => void;
  onSaved: () => Promise<void>;
  notify: (m: string, t?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const close = useCallback(() => {
    if (busy) return;
    setDraft(null);
    setTried(false);
  }, [busy, setDraft]);

  // Free object URLs made for local previews.
  useEffect(() => {
    const url = draft?.qr_preview;
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [draft?.qr_preview]);

  const d = draft;
  const errs = d
    ? {
        nickname: !d.nickname.trim() ? 'Required' : '',
        upi_id: !d.upi_id.trim() ? 'Required' : !/^[\w.\-]{2,}@[a-zA-Z][\w.\-]*$/.test(d.upi_id.trim()) ? 'Looks like name@bank' : '',
        payee_name: !d.payee_name.trim() ? 'Required' : '',
      }
    : { nickname: '', upi_id: '', payee_name: '' };
  const invalid = Object.values(errs).some(Boolean);

  const submit = async () => {
    if (!d) return;
    setTried(true);
    if (invalid) return;
    setBusy(true);
    try {
      await getJSON(d.id ? `/api/admin/manual-payment-methods/${d.id}` : '/api/admin/manual-payment-methods', {
        method: d.id ? 'PATCH' : 'POST',
        body: methodForm(d),
      });
      await onSaved();
      setDraft(null);
      setTried(false);
      notify(d.id ? 'Payment method updated' : 'Payment method added');
    } catch (e) {
      notify(errMsg(e, 'Could not save payment method'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!d}
      title={d?.id ? 'Edit UPI / QR' : 'Add UPI / QR'}
      onClose={close}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className={btn.secondary}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy} className={btn.primary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {d?.id ? 'Save changes' : 'Add method'}
          </button>
        </div>
      }
    >
      {d && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Nickname" htmlFor="m-nick" hint="Only you see this" error={tried ? errs.nickname : ''}>
            <input id="m-nick" value={d.nickname} onChange={(e) => setDraft({ ...d, nickname: e.target.value })} placeholder="e.g. Main HDFC" className={inputCls} />
          </Field>
          <Field label="Payee name" htmlFor="m-payee" hint="Name shown in the UPI app" error={tried ? errs.payee_name : ''}>
            <input id="m-payee" value={d.payee_name} onChange={(e) => setDraft({ ...d, payee_name: e.target.value })} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="UPI ID" htmlFor="m-upi" error={tried ? errs.upi_id : ''}>
              <input
                id="m-upi"
                value={d.upi_id}
                onChange={(e) => setDraft({ ...d, upi_id: e.target.value })}
                placeholder="name@okhdfcbank"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="QR image" hint="Optional. PNG, JPG or WebP up to 5 MB.">
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  {d.qr_preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.qr_preview} alt="QR preview" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <QrCode className="h-6 w-6 text-slate-300" aria-hidden />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className={`${btn.secondary} cursor-pointer`}>
                    <Upload className="h-4 w-4" aria-hidden /> {d.qr_preview ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) return notify('QR image must be 5 MB or smaller', 'error');
                        setDraft({ ...d, qr_image: file, qr_preview: URL.createObjectURL(file), remove_qr: false });
                      }}
                    />
                  </label>
                  {d.qr_preview && (
                    <button type="button" onClick={() => setDraft({ ...d, qr_image: null, qr_preview: '', remove_qr: true })} className={btn.danger}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Note for customers" htmlFor="m-ins" hint="Optional. Shown under the QR on the payment page.">
              <textarea id="m-ins" rows={2} value={d.instructions} onChange={(e) => setDraft({ ...d, instructions: e.target.value })} className={textareaCls} />
            </Field>
          </div>
          {!d.id && (
            <div className="sm:col-span-2">
              <Switch checked={d.is_default} onChange={(v) => setDraft({ ...d, is_default: v })} label="Receive payments here" description="Replaces the current receiving UPI / QR." />
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      )}
    </Sheet>
  );
}

/* ──────────────────────────── whatsapp ─────────────────────────── */

const WA_TEMPLATES = [
  { value: 'confirmed', label: 'Booking confirmed' },
  { value: 'pending', label: 'Booking received' },
  { value: 'seat_locked', label: 'Seat locked' },
  { value: 'rejected', label: 'Booking rejected' },
  { value: 'cancelled', label: 'Booking cancelled' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'otp', label: 'Login code' },
  { value: 'custom', label: 'Custom text' },
];

function WhatsAppPanel({ wa, reload, notify }: { wa: Load<WaStatus>; reload: (silent?: boolean) => Promise<WaStatus | null>; notify: (m: string, t?: 'success' | 'error') => void }) {
  const [busy, setBusy] = useState('');
  const [method, setMethod] = useState<'code' | 'qr'>('code');
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [qr, setQr] = useState('');
  const [polls, setPolls] = useState(0);
  const [testPhone, setTestPhone] = useState('');
  const [template, setTemplate] = useState('confirmed');
  const [custom, setCustom] = useState('');

  const status = wa.status === 'ready' ? wa.data : null;
  const linking = !!(pairingCode || qr) && !status?.connected;
  const MAX_POLLS = 50; // ~3 minutes

  // While a code / QR is showing: poll quietly, only when the page is visible, for ~3 minutes.
  const pollCount = useRef(0);
  useEffect(() => {
    if (!linking) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== 'visible' || pollCount.current >= MAX_POLLS) return;
      pollCount.current += 1;
      setPolls(pollCount.current);
      const d = await reload(true);
      if (d?.connected) {
        setPairingCode('');
        setQr('');
        notify('WhatsApp connected');
      } else if (d?.qr) {
        setQr((cur) => (cur ? d.qr! : cur)); // QR rotates; keep showing the newest one
      }
    }, 3500);
    return () => window.clearInterval(id);
  }, [linking, reload, notify]);

  if (wa.status === 'loading') return <PanelSkeleton rows={2} />;
  if (wa.status === 'error') return <LoadError what="WhatsApp status" error={wa.error} onRetry={() => reload()} />;
  const w = wa.data;

  const link = async () => {
    setBusy('link');
    setPairingCode('');
    setQr('');
    setPolls(0);
    pollCount.current = 0;
    try {
      const body = method === 'code' ? { action: 'login', mode: 'pairing', phone: phone.replace(/\D/g, '') } : { action: 'login', mode: 'qr' };
      const data = await getJSON<any>('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (data.pairingCode) setPairingCode(data.pairingCode);
      if (data.qr) setQr(data.qr);
      const fresh = await reload(true);
      if (!data.pairingCode && !data.qr && fresh?.qr && method === 'qr') setQr(fresh.qr);
      if (data.message) notify(data.message);
    } catch (e) {
      notify(errMsg(e, 'Could not start linking'), 'error');
    } finally {
      setBusy('');
    }
  };

  const logout = async () => {
    if (!confirm('Disconnect WhatsApp? Customers will stop getting booking messages until you link again.')) return;
    setBusy('logout');
    try {
      await getJSON('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      await reload(true);
      notify('WhatsApp disconnected');
    } catch (e) {
      notify(errMsg(e, 'Could not disconnect'), 'error');
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      await getJSON('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', phone: testPhone.replace(/\D/g, ''), template, message: custom }),
      });
      notify('Test message sent');
      reload(true);
    } catch (e) {
      notify(errMsg(e, 'Could not send test message'), 'error');
    } finally {
      setBusy('');
    }
  };

  const stateLabel = w.connected ? 'Connected' : linking ? 'Waiting for phone…' : w.relinkRequired ? 'Logged out' : (w.state || 'disconnected').replace(/_/g, ' ');
  const tone: Tone = w.connected ? 'ok' : w.relinkRequired ? 'error' : linking ? 'warn' : 'muted';

  return (
    <>
      <Section
        title="Connection"
        description="WhatsApp runs on this server. Link once — it stays linked across restarts."
        icon={MessageCircle}
        action={
          <button type="button" onClick={() => reload()} className={btn.secondary} aria-label="Refresh WhatsApp status">
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${w.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <Smartphone className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold capitalize text-slate-950">{stateLabel}</p>
              <p className="text-sm text-slate-500">{w.number ? `+${w.number}` : 'No number linked'}</p>
            </div>
          </div>
          {w.connected && (
            <button type="button" onClick={logout} disabled={!!busy} className={btn.danger}>
              {busy === 'logout' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
              Disconnect
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm sm:grid-cols-3">
          {[
            { k: 'Status', v: <Pill tone={tone}>{w.connected ? 'Online' : 'Offline'}</Pill> },
            { k: 'Last connected', v: timeAgo(w.lastConnectedAt) || '—' },
            { k: 'Last message', v: timeAgo(w.lastMessageAt) || '—' },
          ].map((x) => (
            <div key={x.k} className="bg-white px-3 py-2.5 last:col-span-2 sm:last:col-span-1">
              <p className="text-xs text-slate-500">{x.k}</p>
              <div className="mt-0.5 font-semibold text-slate-900">{x.v}</div>
            </div>
          ))}
        </div>

        {(w.queued || 0) > 0 && <p className="mt-3 text-sm text-amber-700">{w.queued} message(s) queued — they send once connected.</p>}
        {w.error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            {w.error}
          </p>
        )}
      </Section>

      {!w.connected && (
        <Section title="Link a number" description="Use the phone that has the WhatsApp account you want to send from." icon={QrCode}>
          <div role="radiogroup" aria-label="Link method" className="inline-flex rounded-xl bg-slate-100 p-1">
            {(
              [
                { v: 'code', label: 'Phone code', icon: Smartphone },
                { v: 'qr', label: 'QR code', icon: QrCode },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={method === o.v}
                onClick={() => setMethod(o.v)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${method === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <o.icon className="h-4 w-4" aria-hidden /> {o.label}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              link();
            }}
          >
            {method === 'code' && (
              <div className="flex-1 sm:max-w-xs">
                <Field label="WhatsApp number" htmlFor="wa-phone" hint="With country code, e.g. 91 then 10 digits">
                  <input id="wa-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="91XXXXXXXXXX" className={inputCls} />
                </Field>
              </div>
            )}
            <button type="submit" disabled={!!busy || (method === 'code' && phone.replace(/\D/g, '').length < 10)} className={`${btn.primary} sm:mb-[22px]`}>
              {busy === 'link' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {method === 'code' ? (pairingCode ? 'Get a new code' : 'Get code') : qr ? 'New QR' : 'Show QR'}
            </button>
          </form>

          {pairingCode && (
            <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-purple-950 sm:text-3xl">{pairingCode}</p>
                <button
                  type="button"
                  className={btn.icon}
                  aria-label="Copy code"
                  onClick={() => navigator.clipboard?.writeText(pairingCode).then(() => notify('Code copied'), () => undefined)}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-purple-900/80">
                <li>Open WhatsApp → Settings → Linked devices → Link a device.</li>
                <li>Tap “Link with phone number instead” and enter this code.</li>
              </ol>
            </div>
          )}

          {qr && (
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="WhatsApp link QR code" className="h-52 w-52 object-contain" />
              </div>
              <p className="max-w-xs text-sm text-slate-600">Open WhatsApp → Settings → Linked devices → Link a device, and scan this code.</p>
            </div>
          )}

          {linking && (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              {polls < MAX_POLLS ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Waiting for your phone — this updates by itself.
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-amber-600" aria-hidden /> Still not linked. The code may have expired — get a new one.
                </>
              )}
            </p>
          )}
        </Section>
      )}

      {w.connected && (
        <Section title="Send a test message" description="Sends a sample with placeholder booking details to the number you enter." icon={Send}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendTest();
            }}
          >
            <Field label="Send to" htmlFor="wa-test-phone" hint="With country code">
              <input id="wa-test-phone" type="tel" inputMode="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="91XXXXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Message" htmlFor="wa-template">
              <select id="wa-template" value={template} onChange={(e) => setTemplate(e.target.value)} className={inputCls}>
                {WA_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            {template === 'custom' && (
              <div className="sm:col-span-2">
                <Field label="Custom text" htmlFor="wa-custom">
                  <textarea id="wa-custom" rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} className={textareaCls} />
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!!busy || testPhone.replace(/\D/g, '').length < 10 || (template === 'custom' && !custom.trim())}
                className={btn.primary}
              >
                {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Send test
              </button>
            </div>
          </form>
        </Section>
      )}
    </>
  );
}

/* ──────────────────────────── telegram ─────────────────────────── */

function TelegramPanel({
  tg,
  form,
  setForm,
  dirty,
  reload,
  onSaved,
  notify,
}: {
  tg: Load<TgSettings>;
  form: TgForm | null;
  setForm: (f: TgForm) => void;
  dirty: boolean;
  reload: (keepForm?: boolean) => Promise<void>;
  onSaved: (t: TgSettings) => void;
  notify: (m: string, t?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  if (tg.status === 'loading' || (tg.status === 'ready' && !form)) return <PanelSkeleton rows={2} />;
  if (tg.status === 'error') return <LoadError what="Telegram settings" error={tg.error} onRetry={() => reload()} />;
  const t = tg.data;
  const f = form!;

  const addChat = () => {
    const id = chatInput.trim();
    if (!id) return;
    if (!/^-?\d+$/.test(id)) return notify('Chat ID must be a number (group IDs start with -)', 'error');
    if (!f.admin_chat_ids.includes(id)) setForm({ ...f, admin_chat_ids: [...f.admin_chat_ids, id] });
    setChatInput('');
  };

  const save = async () => {
    setBusy('save');
    try {
      const data = await getJSON<{ settings: any }>('/api/admin/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...f }),
      });
      onSaved(normalizeTg({ ...data.settings, webhook_status: t.webhook_status }));
      setShowToken(false);
      notify('Telegram settings saved');
      reload(true); // refresh webhook status in the background
    } catch (e) {
      notify(errMsg(e, 'Could not save Telegram settings'), 'error');
    } finally {
      setBusy('');
    }
  };

  const act = async (action: 'set_webhook' | 'test') => {
    setBusy(action);
    try {
      const data = await getJSON<{ message?: string }>('/api/admin/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      notify(data.message || 'Done');
      await reload(true);
    } catch (e) {
      notify(errMsg(e, 'Telegram request failed'), 'error');
    } finally {
      setBusy('');
    }
  };

  const webhookTone: Tone = t.webhook_status === 'connected' ? 'ok' : t.webhook_status === 'webhook_error' ? 'error' : 'muted';
  const webhookLabel = t.webhook_status === 'connected' ? 'Connected' : t.webhook_status === 'webhook_error' ? 'Error' : 'Not connected';
  const needsSaveFirst = dirty ? 'Save your changes first' : undefined;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Telegram alerts" description="Get booking and payment alerts in Telegram, with Approve / Reject buttons." icon={Send}>
          <div className="space-y-4">
            <Switch checked={f.enabled} onChange={(v) => setForm({ ...f, enabled: v })} label="Send alerts" description="Master switch for every Telegram alert." />

            <Field
              label="Bot token"
              htmlFor="tg-token"
              hint={t.has_bot_token ? <>Saved as <code className="text-slate-700">{t.masked_bot_token}</code>. Leave blank to keep it.</> : 'From @BotFather in Telegram.'}
            >
              <div className="relative">
                <input
                  id="tg-token"
                  type={showToken ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={f.bot_token}
                  onChange={(e) => setForm({ ...f, bot_token: e.target.value })}
                  placeholder={t.has_bot_token ? '•••••••• (unchanged)' : '123456789:AA…'}
                  className={`${inputCls} pr-11 font-mono`}
                />
                {f.bot_token && (
                  <button type="button" onClick={() => setShowToken((s) => !s)} className="no-min-touch absolute right-1.5 top-1.5 rounded-lg p-2 text-slate-400 hover:text-slate-700" aria-label={showToken ? 'Hide token' : 'Show token'}>
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </Field>

            <Field label="Send alerts to" htmlFor="tg-chat" hint="Chat IDs. Send /id to your bot to get yours. Press Enter to add.">
              <div className="flex gap-2">
                <input
                  id="tg-chat"
                  inputMode="numeric"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChat();
                    }
                  }}
                  placeholder="Chat ID"
                  className={`${inputCls} font-mono`}
                />
                <button type="button" onClick={addChat} disabled={!chatInput.trim()} className={btn.secondary}>
                  <Plus className="h-4 w-4" aria-hidden /> Add
                </button>
              </div>
            </Field>
            {f.admin_chat_ids.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Chat IDs">
                {f.admin_chat_ids.map((id) => (
                  <li key={id} className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 py-1 pl-3 pr-1 font-mono text-xs font-semibold text-purple-800">
                    {id}
                    <button
                      type="button"
                      onClick={() => setForm({ ...f, admin_chat_ids: f.admin_chat_ids.filter((x) => x !== id) })}
                      className="no-min-touch rounded-full p-1 hover:bg-purple-100"
                      aria-label={`Remove ${id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={`grid gap-2.5 sm:grid-cols-2 ${f.enabled ? '' : 'opacity-60'}`}>
              <Switch
                checked={f.notify_new_booking}
                onChange={(v) => setForm({ ...f, notify_new_booking: v })}
                label="New bookings"
                description="New bookings and Razorpay auto-confirmed payments."
              />
              <Switch
                checked={f.notify_payments}
                onChange={(v) => setForm({ ...f, notify_payments: v })}
                label="Payments to approve"
                description="UPI screenshots waiting for approval, with buttons."
              />
            </div>
            <p className="text-xs text-slate-500">Confirmed, rejected and cancelled updates are sent whenever alerts are on.</p>
          </div>
        </Section>

        <div className="space-y-4">
          <Section title="Connection" icon={Info}>
            <KeyValue
              items={[
                { label: 'Bot', value: t.bot_username ? `@${t.bot_username}` : '—' },
                { label: 'Token', value: t.has_bot_token ? 'Saved' : 'Not set' },
                { label: 'Chats', value: t.admin_chat_ids.length || '—' },
                { label: 'Webhook', value: <Pill tone={webhookTone}>{webhookLabel}</Pill> },
              ]}
            />
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => act('set_webhook')} disabled={!!busy || !t.has_bot_token || dirty} title={needsSaveFirst} className={btn.secondary}>
                {busy === 'set_webhook' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                {t.webhook_status === 'connected' ? 'Reconnect webhook' : 'Connect webhook'}
              </button>
              <button type="button" onClick={() => act('test')} disabled={!!busy || !t.has_bot_token || !t.admin_chat_ids.length || dirty} title={needsSaveFirst} className={btn.secondary}>
                {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Send test alert
              </button>
              {dirty && <p className="text-center text-xs text-amber-700">Save your changes to use these.</p>}
            </div>
          </Section>

          <details className="group rounded-2xl border border-slate-200/80 bg-white" open={!t.has_bot_token}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-bold text-slate-900 sm:px-5 [&::-webkit-details-marker]:hidden">
              Setup steps
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" aria-hidden />
            </summary>
            <ol className="list-decimal space-y-2 px-4 pb-4 pl-9 text-sm leading-relaxed text-slate-600 sm:px-5 sm:pl-10">
              <li>In Telegram, message @BotFather → /newbot, and paste the token here.</li>
              <li>Open your new bot and press Start.</li>
              <li>Send /id to the bot and add the number it replies with.</li>
              <li>Save, then Connect webhook, then Send test alert.</li>
            </ol>
          </details>
        </div>
      </div>

      <SaveBar visible={dirty} saving={busy === 'save'} onSave={save} onDiscard={() => setForm(toTgForm(t))} />
    </>
  );
}
