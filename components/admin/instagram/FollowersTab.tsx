'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Instagram, RefreshCw, Plus, Loader2, AlertTriangle, PauseCircle, PlayCircle, Trash2, CheckCircle2,
  XCircle, Clock, ShieldAlert, TrendingUp, TrendingDown, Minus, PencilLine, Terminal,
} from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, Sparkline, timeAgo } from '@/components/admin/dashboard/utils';
import { FollowerLine, NetBars, fmt, signed } from './charts';
import { Banner, Button, Panel, PanelHeader, Segmented, cx } from './shared';

/* ── types ── */
interface Growth { value: number | null; partial: boolean }
interface Account {
  id: string; username: string; display_name: string | null; profile_picture_url: string | null;
  is_active: boolean; check_interval_hours: number; followers_count: number | null; follows_count: number | null; media_count: number | null;
  last_checked_at: string | null; last_success_at: string | null; next_check_at: string; consecutive_failures: number; last_error: string | null;
  growth: { today: Growth; day: Growth; week: Growth; month: Growth }; spark: number[]; tracking_since: string | null;
}
interface LogRow { id: number; account_id: string | null; username: string; status: string; trigger: string; followers_count: number | null; error_code: string | null; message: string | null; duration_ms: number | null; created_at: string }
interface State { rate_limited_until: string | null; token_error: string | null; last_run_at: string | null; last_run_summary: any; lock_until: string | null }
interface Overview { configured: boolean; state: State | null; accounts: Account[]; log: LogRow[]; failures24h: number }
interface Bucket { key: string; close: number; net: number | null }
interface History { snapshots: { followers_count: number; captured_at: string; source: string }[]; daily: Bucket[]; weekly: Bucket[]; monthly: Bucket[]; log: LogRow[] }

const RANGES = [{ k: '7', l: '7D' }, { k: '30', l: '30D' }, { k: '90', l: '90D' }, { k: '365', l: '1Y' }, { k: 'all', l: 'All' }];
const INTERVALS = [1, 3, 6, 12, 24];

const STATUS: Record<string, { label: string; cls: string; Icon: any }> = {
  success: { label: 'Success', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 ring-rose-200', Icon: XCircle },
  rate_limited: { label: 'Rate limited', cls: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: Clock },
  not_found: { label: 'Not found', cls: 'bg-slate-100 text-slate-600 ring-slate-200', Icon: XCircle },
  auth_error: { label: 'Token error', cls: 'bg-rose-50 text-rose-700 ring-rose-200', Icon: ShieldAlert },
};

const fmtBucket = (key: string, unit: 'day' | 'week' | 'month') => {
  if (unit === 'month') return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  const d = new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return unit === 'week' ? `Wk ${d}` : d;
};
const until = (iso?: string | null) => {
  if (!iso) return '';
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (m <= 0) return 'now';
  return m < 60 ? `in ${m}m` : m < 1440 ? `in ${Math.round(m / 60)}h` : `in ${Math.round(m / 1440)}d`;
};

/* ── small pieces ── */
function GrowthChip({ g, label }: { g: Growth; label: string }) {
  const v = g.value;
  const tone = v == null ? 'text-slate-400' : v > 0 ? 'text-emerald-600' : v < 0 ? 'text-rose-600' : 'text-slate-500';
  const Icon = v == null || v === 0 ? Minus : v > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      {label && <p className="text-xs text-slate-500">{label}</p>}
      <p className={`flex items-center gap-1 text-base font-semibold tabular-nums ${tone}`} title={g.partial ? 'Since tracking started (less history than the full period)' : undefined}>
        <Icon className="h-3 w-3 shrink-0" />{v == null ? '—' : signed(v)}{g.partial && <span className="text-[10px] font-normal text-slate-400">*</span>}
      </p>
    </div>
  );
}

function Avatar({ a, size = 'h-10 w-10' }: { a: Account; size?: string }) {
  return a.profile_picture_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.profile_picture_url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white`} referrerPolicy="no-referrer" />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 via-pink-100 to-purple-100 text-pink-600`}>
      <Instagram className="h-1/2 w-1/2" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || STATUS.failed;
  return <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${s.cls}`}><s.Icon className="h-3 w-3" />{s.label}</span>;
}

function GrowthCell({ label, g }: { label: string; g: Growth }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1.5"><GrowthChip g={g} label="" /></div>
    </div>
  );
}

/* ── page ── */
export default function FollowersTab() {
  const { toast } = useAdminLive();
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState('30');
  const [unit, setUnit] = useState<'day' | 'week' | 'month'>('day');
  const [history, setHistory] = useState<History | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualVal, setManualVal] = useState('');
  const [manualAt, setManualAt] = useState('');
  const [histVersion, setHistVersion] = useState(0);
  const [chart, setChart] = useState<'total' | 'net'>('total');
  const [logAll, setLogAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/instagram', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Could not load');
      setData(j);
      setLoadError('');
      setSelectedId((cur) => (cur && j.accounts.some((a: Account) => a.id === cur) ? cur : j.accounts[0]?.id ?? null));
    } catch (e: any) {
      setLoadError(e.message || 'Could not load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Cron runs in the background — refresh every minute while the tab is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) { setHistory(null); return; }
    const ctrl = new AbortController();
    setHistLoading(true);
    fetch(`/api/admin/instagram/${selectedId}?range=${range}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (!j.error) setHistory(j); })
      .catch(() => {})
      .finally(() => setHistLoading(false));
    return () => ctrl.abort();
  }, [selectedId, range, histVersion]);

  const selected = data?.accounts.find((a) => a.id === selectedId) || null;
  const refreshAll = async () => { await load(); setHistVersion((v) => v + 1); };

  const runCheck = async (accountId?: string, resume = false) => {
    setBusy(accountId ? `check:${accountId}` : 'check:all');
    try {
      const res = await fetch('/api/admin/instagram/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, resume }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Check failed');
      const r = j.run;
      if (r.failed && !r.success) toast(r.results?.[0]?.message || 'Check failed', 'error', { sub: r.stoppedBy === 'rate_limited' ? 'Tracking paused automatically' : undefined });
      else toast(r.checked === 1 && r.results?.[0]?.followers != null ? `@${r.results[0].username}: ${fmt(r.results[0].followers)} followers` : `Checked ${r.checked} account${r.checked === 1 ? '' : 's'}`, r.failed ? 'info' : 'success', r.failed ? { sub: `${r.failed} failed` } : undefined);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
      refreshAll();
    }
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.trim()) return;
    setBusy('add');
    try {
      const res = await fetch('/api/admin/instagram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUser }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not add');
      const r = j.run?.results?.[0];
      if (r?.status === 'success') toast(`Tracking @${j.username}`, 'success', { sub: `${fmt(r.followers)} followers` });
      else toast(`Added @${j.username}, but the first check failed`, 'error', { sub: r?.message || j.run?.reason });
      setNewUser('');
      setSelectedId(j.id);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
      load();
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, msg: string) => {
    setBusy(`patch:${id}`);
    try {
      const res = await fetch(`/api/admin/instagram/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Update failed');
      toast(msg, 'success');
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); load(); }
  };

  const remove = async (a: Account) => {
    if (!window.confirm(`Stop tracking @${a.username} and delete all of its history? This cannot be undone.`)) return;
    setBusy(`del:${a.id}`);
    try {
      const res = await fetch(`/api/admin/instagram/${a.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed');
      toast(`Removed @${a.username}`, 'success');
      setSelectedId(null);
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(null); load(); }
  };

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy('manual');
    try {
      const res = await fetch(`/api/admin/instagram/${selected.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ followers: manualVal.replace(/[,\s]/g, ''), at: manualAt ? new Date(manualAt).toISOString() : undefined }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save');
      toast('Snapshot saved', 'success');
      setManualOpen(false); setManualVal(''); setManualAt('');
    } catch (err: any) { toast(err.message, 'error'); } finally { setBusy(null); refreshAll(); }
  };

  const linePoints = useMemo(() => (history?.snapshots || []).map((s) => ({ t: new Date(s.captured_at).getTime(), v: s.followers_count, manual: s.source === 'manual' })), [history]);
  const bars = useMemo(() => {
    const src = unit === 'day' ? history?.daily : unit === 'week' ? history?.weekly : history?.monthly;
    return (src || []).map((b) => ({ ...b, label: fmtBucket(b.key, unit) }));
  }, [history, unit]);

  const state = data?.state;
  const paused = state?.rate_limited_until && new Date(state.rate_limited_until).getTime() > Date.now();
  const lastRun = state?.last_run_at;
  const cronStale = lastRun ? Date.now() - new Date(lastRun).getTime() > 8 * 3600_000 : true;
  const failedForSelected = history?.log.filter((l) => l.status !== 'success') || [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-slate-900">Follower tracker</h2>
          <p className="text-xs text-slate-500">
            Track your account or any public Business/Creator account
            {lastRun && <> · last run {timeAgo(lastRun)}</>}
          </p>
        </div>
        <form onSubmit={addAccount} className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
            <input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="username or profile link" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20" />
          </div>
          <Button type="submit" variant="primary" disabled={!newUser.trim()} loading={busy === 'add'} icon={<Plus className="h-4 w-4" />}>Track</Button>
          <Button type="button" onClick={() => runCheck()} disabled={!!busy || !data?.accounts.length} title="Check every active account now"
            icon={<RefreshCw className={cx('h-3.5 w-3.5', busy === 'check:all' && 'animate-spin')} />}><span className="hidden sm:inline">Check all</span></Button>
        </form>
      </div>

      {/* Health banners */}
      {data && !data.configured && (
        <Banner tone="rose" icon={<ShieldAlert className="h-4 w-4" />} title="Instagram token not configured">
          Set <code>INSTAGRAM_ACCESS_TOKEN</code> and <code>INSTAGRAM_USER_ID</code> in the server&apos;s <code>.env.local</code>, then restart.
        </Banner>
      )}
      {state?.token_error && data?.configured && (
        <Banner tone="rose" icon={<ShieldAlert className="h-4 w-4" />} title="Instagram rejected the access token — tracking is stopped">
          {state.token_error}. Generate a new long-lived token, update <code>INSTAGRAM_ACCESS_TOKEN</code>, restart, then press <b>Check all</b>.
        </Banner>
      )}
      {paused && (
        <Banner tone="amber" icon={<PauseCircle className="h-4 w-4" />} title={`Paused after Instagram's rate limit — resumes ${until(state!.rate_limited_until)}`}
          action={<button onClick={() => runCheck(undefined, true)} disabled={!!busy} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100">Resume now</button>}>
          Checks back off automatically so the API isn&apos;t blocked. No data is lost — the next run catches up.
        </Banner>
      )}
      {data && data.accounts.length > 0 && cronStale && !paused && (
        <Banner tone="slate" icon={<Terminal className="h-4 w-4" />} title={lastRun ? `No tracker run for ${timeAgo(lastRun).replace(' ago', '')}` : 'The cron job has not run yet'}>
          On the VPS, add to <code>crontab -e</code>: <code className="break-all">* * * * * cd /path/to/app &amp;&amp; npx tsx scripts/instagram-cron.ts &gt;&gt; logs/instagram.log 2&gt;&amp;1</code>
        </Banner>
      )}
      {loadError && <Banner tone="rose" icon={<AlertTriangle className="h-4 w-4" />} title="Could not load tracker data">{loadError}</Banner>}

      {!data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : data.accounts.length === 0 ? (
        <Panel className="px-6 py-14 text-center">
          <Instagram className="mx-auto mb-3 h-10 w-10 text-pink-400" />
          <p className="text-sm font-semibold text-slate-800">Track your first account</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">Enter a public Business or Creator username above — your own (@ghumakkars_in) or a competitor&apos;s. Personal accounts can&apos;t be read by the API.</p>
        </Panel>
      ) : (
        <>
          {/* Account cards — only when there is more than one account to pick from */}
          {data.accounts.length > 1 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.accounts.map((a) => {
              const on = a.id === selectedId;
              return (
                <button key={a.id} onClick={() => setSelectedId(a.id)} className={`group rounded-xl border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors ${on ? 'border-[#d62976] ring-2 ring-pink-100' : 'border-slate-200 hover:border-slate-300'} ${a.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-2.5">
                    <Avatar a={a} size="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-900">@{a.username}</p>
                      <p className="truncate text-[11px] text-slate-500">{a.display_name || (a.is_active ? `Every ${a.check_interval_hours}h` : 'Paused')}</p>
                    </div>
                    {a.consecutive_failures > 0 ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-label="Last check failed" /> : !a.is_active ? <PauseCircle className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{a.followers_count == null ? '—' : fmt(a.followers_count)}</p>
                      <p className={`text-[11px] font-medium tabular-nums ${(a.growth.week.value ?? 0) > 0 ? 'text-emerald-600' : (a.growth.week.value ?? 0) < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {a.growth.week.value == null ? 'no history yet' : `${signed(a.growth.week.value)} this week`}
                      </p>
                    </div>
                    {a.spark.length > 1 && <div className="w-20"><Sparkline values={a.spark} color={(a.growth.week.value ?? 0) < 0 ? '#F43F5E' : '#d62976'} /></div>}
                  </div>
                </button>
              );
            })}
          </div>}

          {selected && (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              {/* One panel: numbers on top, one chart below that switches between total and net change */}
              <Panel className="min-w-0 overflow-hidden">
                <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-5 [&>*]:bg-white">
                  <div className="col-span-2 px-4 py-3.5 sm:col-span-1 sm:px-5">
                    <p className="text-xs font-medium text-slate-500">Followers</p>
                    <p className="mt-1 text-[22px] font-semibold leading-7 tabular-nums tracking-tight text-slate-900">{selected.followers_count == null ? '—' : fmt(selected.followers_count)}</p>
                    <p className="truncate text-[11px] text-slate-400">{selected.media_count != null ? `${fmt(selected.media_count)} posts` : ' '}</p>
                  </div>
                  <GrowthCell label="Today" g={selected.growth.today} />
                  <GrowthCell label="Last 24h" g={selected.growth.day} />
                  <GrowthCell label="Last 7 days" g={selected.growth.week} />
                  <GrowthCell label="Last 30 days" g={selected.growth.month} />
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 sm:px-5">
                  <Segmented value={chart} onChange={(v) => setChart(v as any)} options={[{ k: 'total', l: 'Total followers' }, { k: 'net', l: 'Net change' }]} />
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {chart === 'net' && <Segmented size="xs" options={[{ k: 'day', l: 'Daily' }, { k: 'week', l: 'Weekly' }, { k: 'month', l: 'Monthly' }]} value={unit} onChange={(v) => setUnit(v as any)} />}
                    <Segmented size="xs" options={RANGES} value={range} onChange={setRange} />
                  </div>
                </div>
                <div className={cx('px-3 pb-3 pt-3 transition-opacity sm:px-4', histLoading && 'opacity-50')}>
                  {chart === 'total' ? <FollowerLine points={linePoints} height={260} /> : <NetBars bars={bars} height={260} signedColors />}
                </div>
                {(selected.growth.week.partial || selected.growth.month.partial) && (
                  <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:px-5">* since tracking started {selected.tracking_since ? timeAgo(selected.tracking_since) : ''} — full-period numbers appear once enough history exists.</p>
                )}
              </Panel>

              {/* Side: the account's controls and health */}
              <div className="space-y-4">
                <Panel className="overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                    <Avatar a={selected} size="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <a href={`https://www.instagram.com/${selected.username}/`} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-semibold text-slate-900 hover:underline">@{selected.username}</a>
                      <p className="truncate text-[11px] text-slate-500">
                        {selected.last_success_at ? `Checked ${timeAgo(selected.last_success_at)}` : 'Never checked'} · {selected.is_active ? `next ${until(selected.next_check_at)}` : 'paused'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 px-4 py-3.5">
                    <Button variant="primary" className="w-full" onClick={() => runCheck(selected.id)} disabled={!!busy && busy !== `check:${selected.id}`} loading={busy === `check:${selected.id}`} icon={<RefreshCw className="h-3.5 w-3.5" />}>Check now</Button>
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">Check every</span>
                      <select value={selected.check_interval_hours} disabled={!!busy}
                        onChange={(e) => patch(selected.id, { check_interval_hours: Number(e.target.value) }, `@${selected.username} will be checked every ${e.target.value}h`)}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800">
                        {Array.from(new Set([...INTERVALS, selected.check_interval_hours])).sort((x, y) => x - y).map((h) => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={() => patch(selected.id, { is_active: !selected.is_active }, selected.is_active ? `Paused @${selected.username}` : `Resumed @${selected.username}`)} disabled={!!busy}
                        icon={selected.is_active ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}>{selected.is_active ? 'Pause' : 'Resume'}</Button>
                      <Button size="sm" onClick={() => setManualOpen((o) => !o)} icon={<PencilLine className="h-3.5 w-3.5" />}>Add count</Button>
                    </div>
                    {manualOpen && (
                      <form onSubmit={saveManual} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 animate-slide-down">
                        <p className="text-[11px] text-slate-500">Record a known count, e.g. to back-fill history from before tracking.</p>
                        <input value={manualVal} onChange={(e) => setManualVal(e.target.value)} inputMode="numeric" placeholder="Followers" className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px]" />
                        <input type="datetime-local" value={manualAt} onChange={(e) => setManualAt(e.target.value)} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700" title="Leave empty for now" />
                        <Button type="submit" size="sm" variant="primary" className="w-full" disabled={!manualVal.trim()} loading={busy === 'manual'}>Save snapshot</Button>
                      </form>
                    )}
                    <button onClick={() => remove(selected)} disabled={!!busy} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600">
                      <Trash2 className="h-3 w-3" /> Stop tracking &amp; delete history
                    </button>
                  </div>
                </Panel>

                <Panel className="overflow-hidden">
                  <PanelHeader title="Failed attempts" right={<span className="text-[11px] text-slate-400">{failedForSelected.length} recent</span>} />
                  {selected.last_error && selected.consecutive_failures > 0 && (
                    <p className="border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-[11px] text-amber-800">
                      {selected.consecutive_failures} in a row · retrying {until(selected.next_check_at)}<br />{selected.last_error}
                    </p>
                  )}
                  {failedForSelected.length === 0 ? (
                    <p className="flex items-center justify-center gap-1.5 px-4 py-5 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />No failed checks recently</p>
                  ) : (
                    <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                      {failedForSelected.slice(0, 10).map((l) => (
                        <li key={l.id} className="px-4 py-2">
                          <div className="flex items-center justify-between gap-2"><StatusPill status={l.status} /><span className="text-[10px] text-slate-400">{timeAgo(l.created_at)}</span></div>
                          {l.message && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{l.message}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {/* Recent activity (all accounts) */}
          <Panel className="overflow-hidden">
            <PanelHeader title="Recent tracking activity"
              right={<span className={`text-[11px] ${data.failures24h ? 'font-medium text-rose-600' : 'text-slate-400'}`}>{data.failures24h} failed in 24h</span>} />
            {data.log.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">No checks yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr><th className="px-4 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Account</th><th className="px-3 py-2 font-medium">Result</th><th className="px-3 py-2 text-right font-medium">Followers</th><th className="hidden px-3 py-2 font-medium md:table-cell">Details</th><th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Source</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.log.slice(0, logAll ? 25 : 6).map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2 text-slate-500" title={new Date(l.created_at).toLocaleString('en-IN')}>{timeAgo(l.created_at)}</td>
                        <td className="whitespace-nowrap px-3 py-2"><button onClick={() => l.account_id && setSelectedId(l.account_id)} className="font-medium text-slate-800 hover:underline">@{l.username}</button></td>
                        <td className="px-3 py-2"><StatusPill status={l.status} /></td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{l.followers_count == null ? '—' : fmt(l.followers_count)}</td>
                        <td className="hidden max-w-xs truncate px-3 py-2 text-slate-500 md:table-cell" title={l.message || ''}>{l.message || (l.duration_ms != null ? `${l.duration_ms} ms` : '')}</td>
                        <td className="hidden whitespace-nowrap px-4 py-2 text-right capitalize text-slate-400 sm:table-cell">{l.trigger === 'cron' ? 'Scheduled' : 'Manual'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.log.length > 6 && (
                  <button onClick={() => setLogAll((v) => !v)} className="w-full border-t border-slate-100 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                    {logAll ? 'Show less' : `Show ${Math.min(25, data.log.length) - 6} more`}
                  </button>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

