'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, Terminal, ShieldCheck, LayoutDashboard, Grid3x3, Users, Send, Bot, Settings2 } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Skeleton, timeAgo } from '@/components/admin/dashboard/utils';
import OverviewTab from '@/components/admin/instagram/OverviewTab';
import PostsTab from '@/components/admin/instagram/PostsTab';
import FollowersTab from '@/components/admin/instagram/FollowersTab';
import InboxTab from '@/components/admin/instagram/InboxTab';
import AutomationTab from '@/components/admin/instagram/AutomationTab';
import { fmt } from '@/components/admin/instagram/charts';
import { Avatar, Button, Dot, Panel, PanelHeader, StoryRing, IG_GRADIENT, cx } from '@/components/admin/instagram/shared';
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
  const [auto, setAuto] = useState<{ settings: AutomationSettings | null; templates: ReplyTemplate[] }>({ settings: null, templates: [] });
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
  const loadAuto = useCallback(() => getJson<{ settings: AutomationSettings; templates: ReplyTemplate[] }>('/api/admin/instagram/automation').then(setAuto).catch(() => {}), []);

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
    <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-5 sm:px-6">
      {/* Profile — Instagram layout: story ring, counts, bio */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8 sm:py-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-pink-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -top-20 right-40 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-purple-300/25 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <StoryRing><Avatar src={p?.profile_picture_url} name={p?.username} size={92} /></StoryRing>
          <div className="min-w-0 flex-1">
            {p ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">{p.username}</h1>
                  <a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-900 hover:bg-slate-200/80">
                    View profile <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                  <Button variant="soft" onClick={refresh} loading={refreshing} icon={<RefreshCw className="h-3.5 w-3.5" />} aria-label="Refresh data">
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </div>
                <ul className="mt-3 flex gap-6 text-[15px] text-slate-700">
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.media_count)}</b> posts</li>
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.followers_count)}</b> followers</li>
                  <li><b className="font-semibold tabular-nums text-slate-900">{fmt(p.follows_count)}</b> following</li>
                </ul>
                <p className="mt-3 text-[13px] font-semibold text-slate-900">{p.name}</p>
                {p.biography && <p className="mt-0.5 max-w-xl whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{p.biography}</p>}
                {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[13px] font-semibold text-[#00376b] hover:underline">{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}
              </>
            ) : errors.overview ? (
              <p className="text-sm text-rose-600">{errors.overview}</p>
            ) : (
              <div className="space-y-3"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-72" /><Skeleton className="h-12 w-96 max-w-full" /></div>
            )}
          </div>
          {overview && <span className="absolute right-0 top-0 hidden text-[11px] text-slate-400 lg:block">Updated {timeAgo(overview.fetchedAt)}</span>}
        </div>
      </header>

      {/* Sections — Instagram-style icon tabs with a gradient marker */}
      <nav className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Instagram sections">
        {TABS.map((t) => {
          const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => go(t.k)} aria-current={on ? 'page' : undefined}
              className={cx('relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-colors',
                on ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:bg-white/60 hover:text-slate-900')}>
              <t.Icon className={cx('h-4 w-4', on && 'text-pink-600')} />
              {t.l}
              {t.k === 'inbox' && waiting > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-[18px] text-white', IG_GRADIENT)}>{waiting}</span>}
              {t.k === 'automation' && a && <Dot tone={autoOn ? 'green' : 'gray'} />}
              {on && <span className={cx('absolute inset-x-3.5 -bottom-px h-[2px] rounded-full', IG_GRADIENT)} />}
            </button>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab overview={overview} media={media} inbox={inbox} error={errors.overview} onTab={go} />}
        {tab === 'posts' && <PostsTab media={media} error={errors.media} />}
        {tab === 'followers' && <FollowersTab />}
        {tab === 'inbox' && <InboxTab inbox={inbox} media={media} templates={auto.templates} onChanged={loadInbox} onSync={() => sync()} syncing={syncing} />}
        {tab === 'automation' && <AutomationTab settings={auto.settings} templates={auto.templates} inbox={inbox} onChanged={loadAuto} onSync={sync} syncing={syncing} />}
        {tab === 'settings' && <SettingsTab overview={overview} settings={a} />}
      </div>
    </div>
  );
}

function SettingsTab({ overview, settings }: { overview: OverviewData | null; settings: AutomationSettings | null }) {
  const cron = '* * * * * cd /path/to/app && npx tsx scripts/instagram-cron.ts >> logs/instagram.log 2>&1';
  const synced = settings?.last_sync_at ? Date.now() - new Date(settings.last_sync_at).getTime() < 10 * 60_000 : false;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
