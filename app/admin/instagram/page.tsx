'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, Terminal, ShieldCheck, LayoutDashboard, Grid3x3, Users, Send, Bot, Settings2, Webhook } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import OverviewTab from '@/components/admin/instagram/OverviewTab';
import PostsTab from '@/components/admin/instagram/PostsTab';
import FollowersTab from '@/components/admin/instagram/FollowersTab';
import InboxTab from '@/components/admin/instagram/InboxTab';
import AutomationTab from '@/components/admin/instagram/AutomationTab';
import { fmt } from '@/components/admin/instagram/charts';
import { Avatar, Button, Dot, Panel, PanelHeader, StoryRing, cx } from '@/components/admin/instagram/shared';
import type { InboxData, MediaData, OverviewData, ReplyTemplate, AutomationSettings } from '@/components/admin/instagram/types';

const TABS = [
  { k: 'overview', l: 'Overview', Icon: LayoutDashboard },
  { k: 'posts', l: 'Posts', Icon: Grid3x3 },
  { k: 'followers', l: 'Followers', Icon: Users },
  { k: 'inbox', l: 'Inbox', Icon: Send },
  { k: 'automation', l: 'Auto reply', Icon: Bot },
  { k: 'settings', l: 'Settings', Icon: Settings2 },
] as const;
type Tab = (typeof TABS)[number]['k'];

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

export default function InstagramPage() {
  const { toast } = useAdminLive();
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [media, setMedia] = useState<MediaData | null>(null);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [auto, setAuto] = useState<{ settings: AutomationSettings | null; templates: ReplyTemplate[]; webhook?: { configured: boolean }; mutes?: { recipient_id: string; username: string | null; until: string }[] }>({ settings: null, templates: [] });
  const [errors, setErrors] = useState({ overview: '', media: '' });
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // The tab lives in the URL (?tab=) so reloads and shared links land in the same place.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (t && TABS.some((x) => x.k === t)) setTab(t);
  }, []);
  const go = useCallback((t: string) => {
    setTab(t as Tab);
    const u = new URL(window.location.href);
    u.searchParams.set('tab', t);
    window.history.replaceState(null, '', u.toString());
  }, []);

  const loadInsights = useCallback(async (force = false) => {
    const q = force ? '&refresh=1' : '';
    await Promise.all([
      getJson<OverviewData>(`/api/admin/instagram/insights?part=overview${q}`).then((d) => { setOverview(d); setErrors((e) => ({ ...e, overview: '' })); })
        .catch((e) => setErrors((x) => ({ ...x, overview: e.message }))),
      getJson<MediaData>(`/api/admin/instagram/insights?part=media${q}`).then((d) => { setMedia(d); setErrors((e) => ({ ...e, media: '' })); })
        .catch((e) => setErrors((x) => ({ ...x, media: e.message }))),
    ]);
  }, []);
  const loadInbox = useCallback(() => getJson<InboxData>('/api/admin/instagram/inbox').then(setInbox).catch(() => {}), []);
  const loadAuto = useCallback(() => getJson<{ settings: AutomationSettings; templates: ReplyTemplate[]; webhook: { configured: boolean }; mutes: { recipient_id: string; username: string | null; until: string }[] }>('/api/admin/instagram/automation').then(setAuto).catch(() => {}), []);

  useEffect(() => { loadInsights(); loadInbox(); loadAuto(); }, [loadInsights, loadInbox, loadAuto]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') { loadInbox(); loadAuto(); } }, 30_000);
    return () => clearInterval(t);
  }, [loadInbox, loadAuto]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadInsights(true), loadInbox(), loadAuto()]);
    setRefreshing(false);
  };

  const sync = async (resume = false) => {
    setSyncing(true);
    try {
      const j = await getJson<{ summary: any }>('/api/admin/instagram/automation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume }) });
      const s = j.summary;
      const sent = s.dmReplies + s.commentReplies + s.privateReplies;
      toast(sent ? `Sent ${sent} auto repl${sent === 1 ? 'y' : 'ies'}` : 'Inbox is up to date', s.error ? 'error' : 'success', s.error ? { sub: s.error } : undefined);
    } catch (e: any) { toast(e.message, 'error'); } finally { setSyncing(false); loadInbox(); loadAuto(); }
  };

  const p = overview?.profile;
  const a = auto.settings;
  const waiting = inbox ? inbox.conversations.filter((c) => c.last.direction === 'in' && Date.now() - new Date(c.last.created_at).getTime() < 86_400_000).length : 0;
  const autoOn = !!a && (a.dm_enabled || a.comment_enabled);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      {/* Compact profile bar + section tabs in one card: ~130px instead of a 300px hero on every tab. */}
      <header className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
          <StoryRing><Avatar src={p?.profile_picture_url} name={p?.username} size={52} /></StoryRing>
          <div className="min-w-0 flex-1">
            {p ? (
              <>
                <div className="flex min-w-0 items-baseline gap-2">
                  <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">{p.username}</h1>
                  {p.name && <span className="hidden truncate text-[13px] text-slate-500 md:inline">{p.name}</span>}
                </div>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-slate-500">
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.followers_count)}</b> followers</li>
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.media_count)}</b> posts</li>
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.follows_count)}</b> following</li>
                  {p.website && <li className="hidden lg:block"><a href={p.website} target="_blank" rel="noreferrer" className="font-medium text-[#00376b] hover:underline">{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></li>}
                </ul>
              </>
            ) : errors.overview ? (
              <p className="text-sm text-rose-600">{errors.overview}</p>
            ) : (
              <div className="space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-64 max-w-full" /></div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {overview && <span className="hidden text-xs text-slate-400 xl:inline">Updated {timeAgo(overview.fetchedAt)}</span>}
            {p && (
              <a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
                <span className="hidden sm:inline">Open in Instagram</span><span className="sm:hidden">Open</span> <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
            <Button onClick={refresh} loading={refreshing} icon={<RefreshCw className="h-3.5 w-3.5" />} aria-label="Refresh data">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <nav className="gk-no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-100 px-2 sm:px-3" aria-label="Instagram sections">
          {TABS.map((t) => {
            const on = tab === t.k;
            return (
              <button key={t.k} onClick={() => go(t.k)} aria-current={on ? 'page' : undefined}
                className={cx('relative flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] font-medium transition-colors',
                  on ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900')}>
                <t.Icon className={cx('h-4 w-4', on ? 'text-[#d62976]' : 'text-slate-400')} />
                {t.l}
                {t.k === 'inbox' && waiting > 0 && <span className="min-w-[18px] rounded-full bg-[#d62976] px-1.5 text-center text-[11px] font-semibold tabular-nums leading-[18px] text-white">{waiting}</span>}
                {t.k === 'automation' && a && <Dot tone={autoOn ? 'green' : 'gray'} />}
                {on && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-slate-900" />}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab overview={overview} media={media} inbox={inbox} error={errors.overview} onTab={go} />}
        {tab === 'posts' && <PostsTab media={media} error={errors.media} />}
        {tab === 'followers' && <FollowersTab />}
        {tab === 'inbox' && <InboxTab inbox={inbox} media={media} templates={auto.templates} onChanged={loadInbox} onSync={() => sync()} syncing={syncing} />}
        {tab === 'automation' && <AutomationTab settings={auto.settings} mutes={auto.mutes} inbox={inbox} media={media?.media || []} profile={p ? { username: p.username, picture: p.profile_picture_url } : undefined} onChanged={() => { loadAuto(); loadInbox(); }} onSync={sync} syncing={syncing} />}
        {tab === 'settings' && <SettingsTab overview={overview} settings={a} webhookConfigured={!!auto.webhook?.configured} />}
      </div>
    </div>
  );
}

function SettingsTab({ overview, settings, webhookConfigured }: { overview: OverviewData | null; settings: AutomationSettings | null; webhookConfigured: boolean }) {
  const cron = '* * * * * cd /path/to/app && npx tsx scripts/instagram-cron.ts >> logs/instagram.log 2>&1';
  const synced = settings?.last_sync_at ? Date.now() - new Date(settings.last_sync_at).getTime() < 10 * 60_000 : false;
  const site = (settings?.site_url || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const hookUrl = `${site}/api/webhooks/instagram`;
  const hookLive = !!settings?.webhook_last_at && Date.now() - new Date(settings.webhook_last_at).getTime() < 7 * 86_400_000;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="lg:col-span-2">
        <PanelHeader icon={<Webhook />} gradient title="Message webhook" description="Required for auto replies to DMs — Instagram only lets an app answer messages it received through its webhook"
          right={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"><Dot tone={hookLive ? 'green' : webhookConfigured ? 'amber' : 'red'} />{hookLive ? `Receiving · last event ${timeAgo(settings!.webhook_last_at)}` : webhookConfigured ? 'Waiting for the first event' : 'Not set up'}</span>} />
        <ol className="grid gap-4 px-5 py-4 text-[13px] text-slate-600 md:grid-cols-3">
          <li>
            <p className="font-semibold text-slate-900">1 · Add two secrets in Coolify</p>
            <p className="mt-1 text-xs leading-relaxed">Environment Variables → add <code className="rounded bg-slate-100 px-1 font-mono">INSTAGRAM_APP_SECRET</code> (Meta App → App settings → Basic → App secret) and <code className="rounded bg-slate-100 px-1 font-mono">INSTAGRAM_WEBHOOK_VERIFY_TOKEN</code> (any long random text). Redeploy.</p>
            <p className={cx('mt-2 inline-flex items-center gap-1.5 text-xs font-medium', webhookConfigured ? 'text-emerald-600' : 'text-amber-600')}><Dot tone={webhookConfigured ? 'green' : 'amber'} />{webhookConfigured ? 'Found on this server' : 'Not set on this server yet'}</p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">2 · Connect it in Meta</p>
            <p className="mt-1 text-xs leading-relaxed">developers.facebook.com → your app → Webhooks → <b>Instagram</b> → Subscribe to this object. Callback URL:</p>
            <code className="mt-1.5 block break-all rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200">{hookUrl}</code>
            <p className="mt-1 text-xs">Verify token: the same text as step 1.</p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">3 · Turn on the fields</p>
            <p className="mt-1 text-xs leading-relaxed">In the Instagram webhook fields, subscribe to <b>messages</b> and <b>comments</b>. Then make sure the app is connected to @{overview?.profile.username || 'your account'} (Instagram settings → Messages → Connected tools → <b>Allow access to messages</b> on).</p>
            <p className="mt-2 text-xs text-slate-500">Then send your business account a DM — the status above turns green.</p>
          </li>
        </ol>
      </Panel>
      <Panel>
        <PanelHeader icon={<ShieldCheck />} tone="green" title="Connection" description="Official Instagram Graph API" />
        <dl className="divide-y divide-slate-100 text-[13px]">
          <Row k="Account">{overview ? `@${overview.profile.username}` : '—'}</Row>
          <Row k="Instagram user ID"><code className="font-mono text-xs">{overview?.profile.id || '—'}</code></Row>
          <Row k="Access token"><span className="inline-flex items-center gap-1.5"><Dot tone={overview ? 'green' : 'gray'} />{overview ? 'Working' : 'Checking…'}</span></Row>
          <Row k="Data refreshed">{overview ? timeAgo(overview.fetchedAt) : '—'}</Row>
          <Row k="Inbox sync"><span className="inline-flex items-center gap-1.5"><Dot tone={synced ? 'green' : 'amber'} />{settings?.last_sync_at ? timeAgo(settings.last_sync_at) : 'Never'}</span></Row>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader icon={<Terminal />} tone="indigo" title="Background job" description="Syncs messages, sends auto replies and checks followers" />
        <div className="space-y-4 px-5 py-4 text-[13px] text-slate-600">
          <div>
            <p className="font-medium text-slate-900">Coolify</p>
            <p className="mt-0.5 text-xs text-slate-500">Your app → Scheduled Tasks → Add. Frequency <code className="font-mono">* * * * *</code>, command:</p>
            <code className="mt-2 block rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">npm run ig:cron</code>
          </div>
          <div>
            <p className="font-medium text-slate-900">Any other server</p>
            <p className="mt-0.5 text-xs text-slate-500">Add to <code className="font-mono">crontab -e</code>:</p>
            <code className="mt-2 block break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-slate-200">{cron}</code>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-3"><dt className="text-slate-500">{k}</dt><dd className="min-w-0 truncate text-right text-slate-900">{children}</dd></div>;
}
