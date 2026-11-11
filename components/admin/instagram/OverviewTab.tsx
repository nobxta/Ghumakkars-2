'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, MessageCircle, MessagesSquare, Bot, UserPlus, Play, Eye, UserRound, MousePointerClick, TrendingUp, Film, MapPin, Heart, CheckCheck } from 'lucide-react';
import { Skeleton } from '@/components/admin/dashboard/utils';
import { NetBars, compact, fmt } from './charts';
import { Delta, Panel, PanelHeader, Segmented, Stat, StatRow, IG_GRADIENT, cx, type Tone } from './shared';
import { isReel, mediaThumb, type InboxData, type MediaData, type OverviewData } from './types';

const RANGES = [{ k: 'day', l: 'Today' }, { k: 'week', l: '7 days' }, { k: 'month', l: '30 days' }];
const PREV_LABEL: Record<string, string> = { day: 'yesterday', week: 'previous 7 days', month: 'previous 30 days' };

/** Reach-side metrics lead; engagement detail follows. */
const PRIMARY: { k: string; label: string; icon: React.ReactNode; tone: Tone }[] = [
  { k: 'views', label: 'Views', icon: <Play />, tone: 'pink' },
  { k: 'reach', label: 'Accounts reached', icon: <Eye />, tone: 'purple' },
  { k: 'profile_views', label: 'Profile visits', icon: <UserRound />, tone: 'orange' },
  { k: 'website_clicks', label: 'Link clicks', icon: <MousePointerClick />, tone: 'blue' },
];
const SECONDARY = [
  { k: 'accounts_engaged', label: 'Accounts engaged' },
  { k: 'total_interactions', label: 'Interactions' },
  { k: 'likes', label: 'Likes' },
  { k: 'comments', label: 'Comments' },
  { k: 'shares', label: 'Shares' },
  { k: 'saves', label: 'Saves' },
];
const GENDER: Record<string, string> = { M: 'Men', F: 'Women', U: 'Not specified' };

export default function OverviewTab({ overview, media, inbox, error, onTab }: {
  overview: OverviewData | null; media: MediaData | null; inbox: InboxData | null; error: string; onTab: (t: string) => void;
}) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week');

  const followerBars = useMemo(() => {
    let run = 0;
    return (overview?.followers || []).map((d) => {
      run += d.value;
      return { key: d.date, label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), net: d.value, close: run };
    });
  }, [overview]);
  const newFollowers = followerBars.length ? followerBars[followerBars.length - 1].close : null;
  const avgPerDay = followerBars.length ? Math.round((newFollowers || 0) / followerBars.length) : null;

  const topReels = useMemo(() => [...(media?.media || [])].filter(isReel).sort((a, b) => (b.insights.views || 0) - (a.insights.views || 0)).slice(0, 5), [media]);

  const cur = overview?.totals[range] || {};
  const prev = overview?.previous?.[range] || {};
  const er = (t: Record<string, number>) => (t.reach ? ((t.total_interactions || 0) / t.reach) * 100 : null);
  const t = inbox?.today;

  return (
    <div className="space-y-8">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700">{error}</p>}

      {/* Today — what needs attention */}
      <section>
        <SectionTitle title="Today" icon={<span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" /></span>} right={<button onClick={() => onTab('inbox')} className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900">Go to inbox <ArrowRight className="h-3.5 w-3.5" /></button>} />
        <StatRow>
          <Stat icon={<MessagesSquare />} tone="purple" label="New messages" value={t ? fmt(t.dmsIn) : '—'} sub={t ? `from ${t.people} ${t.people === 1 ? 'person' : 'people'}` : undefined} />
          <Stat icon={<CheckCheck />} tone="blue" label="Chats answered" value={t ? <>{t.peopleReplied}<span className="text-slate-400">/{t.people}</span></> : '—'}
            sub={t && t.people > t.peopleReplied ? <span className="text-amber-600">{t.people - t.peopleReplied} waiting</span> : t ? 'all caught up' : undefined} />
          <Stat icon={<MessageCircle />} tone="orange" label="New comments" value={t ? fmt(t.comments) : '—'} sub="on recent posts" />
          <Stat icon={<CheckCheck />} tone="amber" label="Comments answered" value={t ? <>{t.commentsReplied}<span className="text-slate-400">/{t.comments}</span></> : '—'}
            sub={t && t.comments > t.commentsReplied ? <span className="text-amber-600">{t.comments - t.commentsReplied} waiting</span> : t ? 'all caught up' : undefined} />
          <Stat icon={<Bot />} tone="pink" label="Auto replies sent" value={t ? fmt(t.autoDm + t.autoComment + t.privateReplies) : '—'}
            sub={inbox?.automation ? (inbox.automation.dm_enabled || inbox.automation.comment_enabled ? 'auto reply is on' : 'auto reply is off') : undefined} />
          <Stat icon={<UserPlus />} tone="green" label="New followers" value={overview?.followers.length ? `+${fmt(overview.followers[overview.followers.length - 1].value)}` : '—'} sub="latest full day" />
        </StatRow>
      </section>

      {/* Performance */}
      <section>
        <SectionTitle title="Performance" icon={<TrendingUp className="h-4 w-4" />} description={`Compared with the ${PREV_LABEL[range]}`} right={<Segmented options={RANGES} value={range} onChange={(v) => setRange(v as any)} />} />
        {!overview ? <Skeleton className="h-56 rounded-xl" /> : (
          <Panel>
            <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 lg:grid-cols-4 [&>*]:bg-white [&>*]:px-5 [&>*]:py-5">
              {PRIMARY.map((m) => (
                <Stat key={m.k} size="lg" icon={m.icon} tone={m.tone} label={m.label} value={cur[m.k] == null ? '—' : compact(cur[m.k])} title={cur[m.k] != null ? fmt(cur[m.k]) : undefined}
                  delta={<Delta cur={cur[m.k]} prev={prev[m.k]} />} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-4 lg:grid-cols-7">
              {SECONDARY.map((m) => (
                <Stat key={m.k} size="sm" label={m.label} value={cur[m.k] == null ? '—' : compact(cur[m.k])} title={cur[m.k] != null ? fmt(cur[m.k]) : undefined}
                  delta={<Delta cur={cur[m.k]} prev={prev[m.k]} />} />
              ))}
              <Stat size="sm" label="Engagement rate" value={er(cur) == null ? '—' : `${er(cur)!.toFixed(1)}%`} title="Interactions ÷ accounts reached"
                delta={<Delta cur={er(cur)} prev={er(prev)} />} />
            </div>
          </Panel>
        )}
      </section>

      {/* Growth + best content */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="min-w-0">
          <PanelHeader icon={<TrendingUp />} gradient title="New followers per day" description="New follows counted by Instagram, last 30 days"
            right={newFollowers != null && (
              <div className="text-right">
                <p className="text-base font-bold tabular-nums text-emerald-600">+{fmt(newFollowers)}</p>
                <p className="text-[11px] text-slate-500">{avgPerDay} a day on average</p>
              </div>
            )} />
          <div className="px-3 pb-3 pt-4">
            {overview ? <NetBars bars={followerBars} gradient closeLabel="so far this period" emptyText="Instagram has no follower data for this period yet." /> : <Skeleton className="h-40" />}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader icon={<Film />} tone="pink" title="Top reels" description="By views, from your latest posts"
            right={<button onClick={() => onTab('posts')} className="text-[13px] font-medium text-slate-600 hover:text-slate-900">See all</button>} />
          {!media ? <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : topReels.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-slate-500">No reels among your latest posts.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {topReels.map((m, i) => (
                <li key={m.id}>
                  <a href={m.permalink} target="_blank" rel="noreferrer" className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                    <span className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaThumb(m)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-14 w-11 rounded-lg bg-slate-100 object-cover" />
                      <span className={cx('absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white', i === 0 ? IG_GRADIENT : 'bg-slate-800')}>{i + 1}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-slate-700 group-hover:text-slate-900">{(m.caption || 'Untitled reel').split('\n')[0]}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">{new Date(m.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<span className="inline-flex items-center gap-0.5"><Heart className="h-3 w-3 text-pink-500" fill="currentColor" />{compact(m.like_count || 0)}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center justify-end gap-1 text-[13px] font-bold tabular-nums text-slate-900"><Play className="h-3 w-3 text-pink-500" fill="currentColor" />{compact(m.insights.views || 0)}</p>
                      <p className="text-[11px] text-slate-400">views</p>
                    </div>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </section>

      {/* Audience */}
      <section>
        <SectionTitle title="Audience" description="Who follows you" icon={<MapPin className="h-4 w-4" />} />
        {!overview ? <Skeleton className="h-48 rounded-xl" /> : (
          <Panel className="grid gap-px overflow-hidden bg-slate-100 sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-white">
            <Breakdown title="Cities" rows={overview.demographics.city} />
            <Breakdown title="Countries" rows={overview.demographics.country} />
            <Breakdown title="Age" rows={[...(overview.demographics.age || [])].sort((a, b) => a.label.localeCompare(b.label))} />
            <Breakdown title="Gender" rows={(overview.demographics.gender || []).map((g) => ({ ...g, label: GENDER[g.label] || g.label }))} />
          </Panel>
        )}
      </section>

      {overview && (
        <a href={`https://www.instagram.com/${overview.profile.username}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
          Data from Instagram · refreshed every 10 minutes <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export function SectionTitle({ title, description, right, icon }: { title: string; description?: string; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">{icon && <span className="text-pink-600">{icon}</span>}{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {right}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows?: { label: string; value: number }[] }) {
  const list = (rows || []).slice(0, 5);
  const total = (rows || []).reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...list.map((r) => r.value));
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="mb-3 text-[13px] font-medium text-slate-900">{title}</p>
      {list.length === 0 ? <p className="text-xs text-slate-400">Not available</p> : (
        <ul className="space-y-2.5">
          {list.map((r, i) => (
            <li key={r.label} className="text-xs">
              <div className="mb-1 flex justify-between gap-3">
                <span className={cx('truncate', i === 0 ? 'font-medium text-slate-900' : 'text-slate-600')}>{r.label.split(',')[0]}</span>
                <span className="tabular-nums text-slate-500">{total ? `${Math.round((r.value / total) * 100)}%` : fmt(r.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100"><div className={cx('h-full rounded-full', i === 0 ? IG_GRADIENT : 'bg-pink-200')} style={{ width: `${(r.value / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
