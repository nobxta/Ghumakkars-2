'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle,
  CreditCard,
  IndianRupee,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Settings,
  Smartphone,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

type TabKey = 'general' | 'payment' | 'whatsapp' | 'telegram';
type Toast = { type: 'success' | 'error' | 'info'; message: string } | null;

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
  is_enabled: boolean;
  is_default: boolean;
  qr_image?: File | null;
  qr_preview?: string;
  remove_qr?: boolean;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'payment', label: 'Payment' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'telegram', label: 'Telegram' },
];

const emptyDraft: MethodDraft = {
  nickname: '',
  upi_id: '',
  payee_name: '',
  instructions: '',
  is_enabled: true,
  is_default: false,
  qr_image: null,
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-relaxed text-slate-500">{hint}</span>}
    </label>
  );
}

function Card({ title, description, icon: Icon, children, action }: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-purple-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 gap-3">
          {Icon && <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700"><Icon className="h-4 w-4" /></div>}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function StatusPill({ status, label }: { status: 'ok' | 'warn' | 'error' | 'muted'; label: string }) {
  const cls = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    muted: 'border-slate-200 bg-slate-50 text-slate-600',
  }[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

function Toggle({ checked, onChange, disabled, label, description }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-purple-200 hover:bg-purple-50/30 disabled:cursor-not-allowed disabled:opacity-60"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </span>
      <span className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${checked ? 'bg-purple-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function buildMethodForm(draft: MethodDraft) {
  const form = new FormData();
  form.set('nickname', draft.nickname);
  form.set('upi_id', draft.upi_id);
  form.set('payee_name', draft.payee_name);
  form.set('instructions', draft.instructions);
  form.set('is_enabled', String(draft.is_enabled));
  form.set('is_default', String(draft.is_default));
  if (draft.remove_qr) form.set('remove_qr', 'true');
  if (draft.qr_image) form.set('qr_image', draft.qr_image);
  return form;
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const [general, setGeneral] = useState({
    email_notifications: true,
    booking_alerts: true,
    weekly_reports: false,
    maintenance_mode: false,
    updated_at: null as string | null,
  });
  const [savedGeneral, setSavedGeneral] = useState('');
  const [payment, setPayment] = useState({
    payment_mode: 'manual',
    referral_reward_amount: 100,
    referral_friend_reward_amount: 50,
    seat_lock_due_days_before: 5,
    updated_at: null as string | null,
    razorpay: { status: 'missing_configuration', configured: false, webhookConfigured: false },
  });
  const [savedPayment, setSavedPayment] = useState('');
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [methodDraft, setMethodDraft] = useState<MethodDraft | null>(null);
  const [methodBusy, setMethodBusy] = useState('');

  const [wa, setWa] = useState<any>({ configured: true, online: false, connected: false, state: 'disconnected' });
  const [waPhone, setWaPhone] = useState('');
  const [waPairingCode, setWaPairingCode] = useState('');
  const [waQr, setWaQr] = useState('');
  const [waBusy, setWaBusy] = useState('');

  const [tg, setTg] = useState<any>({
    enabled: false,
    bot_token: '',
    masked_bot_token: null,
    has_bot_token: false,
    admin_chat_ids: [] as string[],
    notify_new_booking: true,
    notify_payments: true,
    webhook_status: 'not_configured',
  });
  const [chatIdInput, setChatIdInput] = useState('');
  const [tgBusy, setTgBusy] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const showToast = (message: string, type: NonNullable<Toast>['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, methodsRes, waRes, tgRes] = await Promise.all([
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/admin/manual-payment-methods', { cache: 'no-store' }),
        fetch('/api/admin/whatsapp', { cache: 'no-store' }),
        fetch('/api/admin/telegram-settings', { cache: 'no-store' }),
      ]);
      const settings = await settingsRes.json();
      const manual = await methodsRes.json();
      const whatsapp = await waRes.json();
      const telegram = await tgRes.json();
      if (!settingsRes.ok) throw new Error(settings.error || 'Failed to load settings');
      setGeneral(settings.general);
      setPayment(settings.payment);
      setSavedGeneral(JSON.stringify(settings.general));
      setSavedPayment(JSON.stringify({
        payment_mode: settings.payment.payment_mode,
        referral_reward_amount: settings.payment.referral_reward_amount,
        referral_friend_reward_amount: settings.payment.referral_friend_reward_amount,
        seat_lock_due_days_before: settings.payment.seat_lock_due_days_before,
      }));
      setMethods(manual.methods || []);
      setWa(whatsapp);
      setTg((prev: any) => ({ ...prev, ...telegram, bot_token: '', admin_chat_ids: telegram.admin_chat_ids || [] }));
    } catch (error: any) {
      showToast(error.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const hasUnsavedGeneral = savedGeneral && JSON.stringify(general) !== savedGeneral;
    const currentPayment = JSON.stringify({
      payment_mode: payment.payment_mode,
      referral_reward_amount: payment.referral_reward_amount,
      referral_friend_reward_amount: payment.referral_friend_reward_amount,
      seat_lock_due_days_before: payment.seat_lock_due_days_before,
    });
    const hasUnsavedPayment = savedPayment && currentPayment !== savedPayment;
    if (!hasUnsavedGeneral && !hasUnsavedPayment) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [general, payment, savedGeneral, savedPayment]);

  const manualAvailable = methods.some((m) => m.is_enabled);
  const paymentModeOptions = useMemo(() => [
    { value: 'manual', label: 'Manual payment', disabled: !manualAvailable, detail: manualAvailable ? 'Use enabled UPI/QR methods' : 'Add an enabled manual method first' },
    { value: 'razorpay', label: 'Razorpay', disabled: !payment.razorpay.configured, detail: payment.razorpay.configured ? 'Online payment gateway' : 'Missing Razorpay environment keys' },
    { value: 'both', label: 'Both', disabled: !manualAvailable || !payment.razorpay.configured, detail: 'Customers can choose manual UPI or Razorpay' },
  ], [manualAvailable, payment.razorpay.configured]);

  const saveGeneral = async () => {
    setSaving('general');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'general', ...general }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save general settings');
      setGeneral(data.general);
      setSavedGeneral(JSON.stringify(data.general));
      showToast('General settings saved');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving('');
    }
  };

  const savePayment = async () => {
    setSaving('payment');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'payment', ...payment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save payment settings');
      setPayment((prev) => ({ ...prev, ...data.payment }));
      setSavedPayment(JSON.stringify({
        payment_mode: data.payment.payment_mode,
        referral_reward_amount: data.payment.referral_reward_amount,
        referral_friend_reward_amount: data.payment.referral_friend_reward_amount,
        seat_lock_due_days_before: data.payment.seat_lock_due_days_before,
      }));
      showToast('Payment settings saved');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving('');
    }
  };

  const refreshMethods = async () => {
    const res = await fetch('/api/admin/manual-payment-methods', { cache: 'no-store' });
    const data = await res.json();
    if (res.ok) setMethods(data.methods || []);
  };

  const submitMethod = async () => {
    if (!methodDraft) return;
    setMethodBusy(methodDraft.id ? 'update' : 'create');
    try {
      const res = await fetch(methodDraft.id ? `/api/admin/manual-payment-methods/${methodDraft.id}` : '/api/admin/manual-payment-methods', {
        method: methodDraft.id ? 'PATCH' : 'POST',
        body: buildMethodForm(methodDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save payment method');
      await refreshMethods();
      setMethodDraft(null);
      showToast('Payment method saved');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setMethodBusy('');
    }
  };

  const deleteMethod = async (method: ManualMethod) => {
    if (!confirm(`Delete ${method.nickname}? Existing bookings keep their saved payment snapshot.`)) return;
    setMethodBusy(method.id);
    try {
      const res = await fetch(`/api/admin/manual-payment-methods/${method.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete payment method');
      await refreshMethods();
      showToast('Payment method deleted');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setMethodBusy('');
    }
  };

  const quickUpdateMethod = async (method: ManualMethod, patch: Partial<ManualMethod>) => {
    const draft: MethodDraft = {
      id: method.id,
      nickname: patch.nickname ?? method.nickname,
      upi_id: patch.upi_id ?? method.upi_id,
      payee_name: patch.payee_name ?? method.payee_name,
      instructions: patch.instructions ?? method.instructions ?? '',
      is_enabled: patch.is_enabled ?? method.is_enabled,
      is_default: patch.is_default ?? method.is_default,
    };
    setMethodBusy(method.id);
    try {
      const res = await fetch(`/api/admin/manual-payment-methods/${method.id}`, { method: 'PATCH', body: buildMethodForm(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment method');
      await refreshMethods();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setMethodBusy('');
    }
  };

  const moveMethod = async (method: ManualMethod, direction: -1 | 1) => {
    const ordered = [...methods].sort((a, b) => a.display_order - b.display_order);
    const index = ordered.findIndex((m) => m.id === method.id);
    const next = index + direction;
    if (next < 0 || next >= ordered.length) return;
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    setMethods(ordered.map((m, i) => ({ ...m, display_order: i })));
    await fetch('/api/admin/manual-payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', ids: ordered.map((m) => m.id) }),
    });
  };

  const refreshWhatsApp = async () => {
    setWaBusy('refresh');
    try {
      const res = await fetch('/api/admin/whatsapp', { cache: 'no-store' });
      const data = await res.json();
      setWa(data);
      if (data.qr) setWaQr(data.qr);
    } finally {
      setWaBusy('');
    }
  };

  const whatsappAction = async (action: 'login' | 'qr' | 'logout' | 'test') => {
    setWaBusy(action);
    setWaPairingCode('');
    if (action !== 'qr') setWaQr('');
    try {
      const body = action === 'login'
        ? { action: 'login', mode: 'pairing', phone: waPhone }
        : action === 'qr'
          ? { action: 'login', mode: 'qr' }
          : { action };
      const res = await fetch('/api/admin/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'WhatsApp action failed');
      if (data.pairingCode) setWaPairingCode(data.pairingCode);
      if (data.qr) setWaQr(data.qr);
      await refreshWhatsApp();
      showToast(action === 'logout' ? 'WhatsApp disconnected' : 'WhatsApp action completed');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setWaBusy('');
    }
  };

  const saveTelegram = async () => {
    setTgBusy('save');
    try {
      const res = await fetch('/api/admin/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          enabled: tg.enabled,
          bot_token: tg.bot_token,
          admin_chat_ids: tg.admin_chat_ids,
          notify_new_booking: tg.notify_new_booking,
          notify_payments: tg.notify_payments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Telegram settings');
      setTg((prev: any) => ({ ...prev, ...data.settings, bot_token: '' }));
      showToast('Telegram settings saved');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTgBusy('');
    }
  };

  const telegramAction = async (action: 'webhook' | 'test') => {
    setTgBusy(action);
    try {
      const res = await fetch('/api/admin/telegram-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'webhook' ? 'set_webhook' : 'test' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Telegram action failed');
      showToast(data.message || 'Telegram action completed');
      const next = await fetch('/api/admin/telegram-settings', { cache: 'no-store' }).then((r) => r.json());
      setTg((prev: any) => ({ ...prev, ...next, bot_token: '', admin_chat_ids: next.admin_chat_ids || [] }));
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTgBusy('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-purple-700">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wide">Admin settings</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Settings</h1>
        <p className="max-w-2xl text-sm text-slate-500">Manage supported system preferences, payments, and messaging integrations.</p>
      </div>

      <div className="sticky top-12 z-20 -mx-4 overflow-x-auto border-y border-purple-100 bg-white/95 px-4 py-2 backdrop-blur sm:top-14 md:top-16">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-11 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-purple-100 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <>
          {activeTab === 'general' && (
            <Card title="General preferences" description="Only supported settings are shown here." icon={Bell} action={general.updated_at && <span className="text-xs text-slate-500">Saved {new Date(general.updated_at).toLocaleString()}</span>}>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle checked={general.email_notifications} onChange={(v) => setGeneral({ ...general, email_notifications: v })} label="Email notifications" description="Allow operational email notifications." />
                <Toggle checked={general.booking_alerts} onChange={(v) => setGeneral({ ...general, booking_alerts: v })} label="Booking alerts" description="Send admin alerts for booking events." />
                <Toggle checked={general.weekly_reports} onChange={(v) => setGeneral({ ...general, weekly_reports: v })} label="Weekly reports" description="Enable scheduled weekly summaries when configured." />
                <Toggle checked={general.maintenance_mode} onChange={(v) => setGeneral({ ...general, maintenance_mode: v })} label="Maintenance mode" description="Persist the maintenance flag for system checks." />
              </div>
              <button onClick={saveGeneral} disabled={saving === 'general'} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60 sm:w-auto">
                {saving === 'general' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save general settings
              </button>
            </Card>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-5">
              <Card title="Payment mode" description="The customer payment page only shows options that are actually configured." icon={CreditCard}>
                <div className="grid gap-3 md:grid-cols-3">
                  {paymentModeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => setPayment({ ...payment, payment_mode: option.value })}
                      className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${payment.payment_mode === option.value ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-100' : 'border-slate-200 hover:border-purple-200'}`}
                    >
                      <span className="block text-sm font-bold text-slate-950">{option.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Manual payment methods" description="Manage the UPI and QR options shown to customers." icon={QrCode} action={<button type="button" onClick={() => setMethodDraft({ ...emptyDraft })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-bold text-white hover:bg-purple-700"><Plus className="h-4 w-4" /> Add method</button>}>
                {methods.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <QrCode className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">No manual payment methods yet</p>
                    <p className="mt-1 text-xs text-slate-500">Add a UPI ID and optional QR image before enabling manual payments.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {methods.map((method, index) => (
                      <div key={method.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              {method.qr_image_url ? <img src={method.qr_image_url} alt={`${method.nickname} QR code`} className="h-full w-full object-contain p-1" /> : <QrCode className="h-6 w-6 text-slate-400" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-950">{method.nickname}</p>
                                {method.is_default && <StatusPill status="ok" label="Default" />}
                                <StatusPill status={method.is_enabled ? 'ok' : 'muted'} label={method.is_enabled ? 'Enabled' : 'Disabled'} />
                              </div>
                              <p className="mt-1 break-all font-mono text-sm text-purple-700">{method.upi_id}</p>
                              <p className="text-xs text-slate-500">{method.payee_name}</p>
                              {method.instructions && <p className="mt-2 text-xs leading-relaxed text-slate-500">{method.instructions}</p>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => moveMethod(method, -1)} disabled={index === 0} className="h-10 rounded-lg border border-slate-200 px-3 text-slate-600 disabled:opacity-40" title="Move up"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => moveMethod(method, 1)} disabled={index === methods.length - 1} className="h-10 rounded-lg border border-slate-200 px-3 text-slate-600 disabled:opacity-40" title="Move down"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => quickUpdateMethod(method, { is_enabled: !method.is_enabled })} disabled={methodBusy === method.id} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">{method.is_enabled ? 'Disable' : 'Enable'}</button>
                            <button type="button" onClick={() => quickUpdateMethod(method, { is_default: true, is_enabled: true })} disabled={method.is_default || methodBusy === method.id} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40">Set default</button>
                            <button type="button" onClick={() => setMethodDraft({ id: method.id, nickname: method.nickname, upi_id: method.upi_id, payee_name: method.payee_name, instructions: method.instructions || '', is_enabled: method.is_enabled, is_default: method.is_default, qr_preview: method.qr_image_url || undefined })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">Edit</button>
                            <button type="button" onClick={() => deleteMethod(method)} disabled={methodBusy === method.id} className="h-10 rounded-lg border border-red-200 px-3 text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Razorpay status" description="Secrets are read from server environment variables and are never returned to the browser." icon={CreditCard}>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={payment.razorpay.configured ? 'ok' : 'error'} label={payment.razorpay.configured ? 'Configured' : 'Missing configuration'} />
                  <StatusPill status={payment.razorpay.webhookConfigured ? 'ok' : 'warn'} label={payment.razorpay.webhookConfigured ? 'Webhook secret configured' : 'Webhook secret missing'} />
                </div>
                <p className="mt-3 text-sm text-slate-500">Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the deployment environment.</p>
              </Card>

              <Card title="Seat-lock rules and referrals" description="These values are consumed by booking reminders and referral calculations." icon={IndianRupee}>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Balance due days before departure" hint="Used when seat-lock payment reminders calculate the due date.">
                    <input type="number" min={0} max={60} value={payment.seat_lock_due_days_before} onChange={(e) => setPayment({ ...payment, seat_lock_due_days_before: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                  </Field>
                  <Field label="Referrer reward (₹)">
                    <input type="number" min={0} value={payment.referral_reward_amount} onChange={(e) => setPayment({ ...payment, referral_reward_amount: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                  </Field>
                  <Field label="Friend bonus (₹)">
                    <input type="number" min={0} value={payment.referral_friend_reward_amount} onChange={(e) => setPayment({ ...payment, referral_friend_reward_amount: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                  </Field>
                </div>
                <button onClick={savePayment} disabled={saving === 'payment'} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-60 sm:w-auto">
                  {saving === 'payment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save payment settings
                </button>
              </Card>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <Card title="WhatsApp worker" description="Status is fetched from the self-hosted worker through the server proxy." icon={MessageCircle} action={<button type="button" onClick={refreshWhatsApp} disabled={!!waBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${waBusy === 'refresh' ? 'animate-spin' : ''}`} /> Refresh</button>}>
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={!wa.configured ? 'error' : wa.online === false ? 'warn' : wa.connected ? 'ok' : 'muted'} label={!wa.configured ? 'Worker not configured' : wa.online === false ? 'Worker unavailable' : wa.connected ? 'Connected' : (wa.state || 'Disconnected').replace(/_/g, ' ')} />
                    {wa.number && <StatusPill status="ok" label={`+${wa.number}`} />}
                  </div>
                  <dl className="grid gap-2 text-xs text-slate-600">
                    <div><dt className="font-semibold text-slate-800">Last connected</dt><dd>{wa.lastConnectedAt ? new Date(wa.lastConnectedAt).toLocaleString() : 'Not available'}</dd></div>
                    <div><dt className="font-semibold text-slate-800">Last message</dt><dd>{wa.lastMessageAt ? new Date(wa.lastMessageAt).toLocaleString() : 'Not available'}</dd></div>
                    {wa.error && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">{wa.error}</div>}
                  </dl>
                </div>
                <div className="space-y-4">
                  {!wa.connected && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <Field label="WhatsApp number">
                        <input value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="919876543210" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                      </Field>
                      <button type="button" onClick={() => whatsappAction('login')} disabled={!!waBusy || !waPhone.trim()} className="self-end inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-bold text-white disabled:opacity-60"><Smartphone className="h-4 w-4" /> Get pairing code</button>
                      <button type="button" onClick={() => whatsappAction('qr')} disabled={!!waBusy} className="self-end inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-60"><QrCode className="h-4 w-4" /> QR login</button>
                    </div>
                  )}
                  {waPairingCode && <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center"><p className="text-xs font-semibold text-purple-700">Pairing code</p><p className="mt-1 break-all font-mono text-2xl font-bold text-purple-950">{waPairingCode}</p></div>}
                  {waQr && <div className="inline-flex rounded-xl border border-slate-200 bg-white p-3"><img src={waQr} alt="WhatsApp login QR code" className="h-52 w-52 object-contain" /></div>}
                  {wa.connected && <button type="button" onClick={() => whatsappAction('logout')} disabled={!!waBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-60"><XCircle className="h-4 w-4" /> Disconnect</button>}
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'telegram' && (
            <Card title="Telegram alerts" description="Bot token is write-only in this UI. Saved tokens are masked." icon={Send}>
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <Toggle checked={tg.enabled} onChange={(v) => setTg({ ...tg, enabled: v })} label="Enable Telegram alerts" description="Allow booking and payment approval alerts to be sent to configured chats." />
                  <Field label={tg.has_bot_token ? `Bot token (${tg.masked_bot_token})` : 'Bot token'}>
                    <input value={tg.bot_token} onChange={(e) => setTg({ ...tg, bot_token: e.target.value })} placeholder={tg.has_bot_token ? 'Enter a new token to replace the saved token' : '123456:ABC...'} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                  </Field>
                  <div>
                    <Field label="Admin chat IDs">
                      <div className="flex gap-2">
                        <input value={chatIdInput} onChange={(e) => setChatIdInput(e.target.value)} placeholder="-1001234567890" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                        <button type="button" onClick={() => { const id = chatIdInput.trim(); if (!/^-?\d+$/.test(id)) return showToast('Chat ID must be numeric', 'error'); setTg({ ...tg, admin_chat_ids: [...new Set([...(tg.admin_chat_ids || []), id])] }); setChatIdInput(''); }} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">Add</button>
                      </div>
                    </Field>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(tg.admin_chat_ids || []).map((id: string) => (
                        <span key={id} className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{id}<button type="button" onClick={() => setTg({ ...tg, admin_chat_ids: tg.admin_chat_ids.filter((x: string) => x !== id) })}><X className="h-3 w-3" /></button></span>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Toggle checked={tg.notify_new_booking} onChange={(v) => setTg({ ...tg, notify_new_booking: v })} label="New booking alerts" />
                    <Toggle checked={tg.notify_payments} onChange={(v) => setTg({ ...tg, notify_payments: v })} label="Payment approval alerts" />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={saveTelegram} disabled={!!tgBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white disabled:opacity-60">{tgBusy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</button>
                    <button type="button" onClick={() => telegramAction('webhook')} disabled={!!tgBusy || !tg.has_bot_token} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 disabled:opacity-60">Connect webhook</button>
                    <button type="button" onClick={() => telegramAction('test')} disabled={!!tgBusy || !tg.has_bot_token || !(tg.admin_chat_ids || []).length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 disabled:opacity-60">Send test</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-950">Webhook status</p>
                    <div className="mt-2"><StatusPill status={tg.webhook_status === 'connected' ? 'ok' : tg.webhook_status === 'webhook_error' ? 'error' : 'muted'} label={(tg.webhook_status || 'not_configured').replace(/_/g, ' ')} /></div>
                    {tg.bot_username && <p className="mt-2 break-all text-xs text-slate-500">@{tg.bot_username}</p>}
                  </div>
                  <button type="button" onClick={() => setShowGuide(!showGuide)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-bold text-slate-700">Setup guide</button>
                  {showGuide && (
                    <ol className="list-decimal space-y-2 rounded-xl border border-slate-200 bg-white p-4 pl-8 text-sm leading-relaxed text-slate-600">
                      <li>Create a bot with BotFather and paste the token here.</li>
                      <li>Open the bot in Telegram and press Start.</li>
                      <li>Send /id to the bot, add the returned chat ID, save, connect webhook, then send a test.</li>
                    </ol>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {methodDraft && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-0 sm:items-center sm:justify-center sm:p-4" onClick={() => setMethodDraft(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-950">{methodDraft.id ? 'Edit payment method' : 'Add payment method'}</h3>
              <button type="button" onClick={() => setMethodDraft(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nickname">
                <input value={methodDraft.nickname} onChange={(e) => setMethodDraft({ ...methodDraft, nickname: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
              </Field>
              <Field label="UPI ID">
                <input value={methodDraft.upi_id} onChange={(e) => setMethodDraft({ ...methodDraft, upi_id: e.target.value })} placeholder="vivek2k@upi" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
              </Field>
              <Field label="Payee name">
                <input value={methodDraft.payee_name} onChange={(e) => setMethodDraft({ ...methodDraft, payee_name: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
              </Field>
              <Field label="QR image" hint="PNG, JPG, JPEG, or WebP. Max 5MB.">
                <div className="flex items-center gap-3">
                  <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" /> Choose file
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setMethodDraft({ ...methodDraft, qr_image: file, qr_preview: URL.createObjectURL(file), remove_qr: false });
                    }} />
                  </label>
                  {methodDraft.qr_preview && <button type="button" onClick={() => setMethodDraft({ ...methodDraft, qr_preview: '', qr_image: null, remove_qr: true })} className="text-sm font-semibold text-red-600">Remove QR</button>}
                </div>
              </Field>
              {methodDraft.qr_preview && <div className="sm:col-span-2"><img src={methodDraft.qr_preview} alt="Payment method QR preview" className="h-32 w-32 rounded-xl border border-slate-200 object-contain p-2" /></div>}
              <div className="sm:col-span-2">
                <Field label="Instructions">
                  <textarea rows={3} value={methodDraft.instructions} onChange={(e) => setMethodDraft({ ...methodDraft, instructions: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100" />
                </Field>
              </div>
              <Toggle checked={methodDraft.is_enabled} onChange={(v) => setMethodDraft({ ...methodDraft, is_enabled: v, is_default: v ? methodDraft.is_default : false })} label="Enabled" />
              <Toggle checked={methodDraft.is_default} onChange={(v) => setMethodDraft({ ...methodDraft, is_default: v, is_enabled: v ? true : methodDraft.is_enabled })} label="Default method" />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setMethodDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={submitMethod} disabled={!!methodBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-sm font-bold text-white disabled:opacity-60">{methodBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save method</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed right-4 top-20 z-[60] flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-xl ${toast.type === 'success' ? 'border-emerald-200' : toast.type === 'error' ? 'border-red-200' : 'border-blue-200'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" /> : toast.type === 'error' ? <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" /> : <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />}
          <p className="text-sm font-semibold text-slate-800">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
