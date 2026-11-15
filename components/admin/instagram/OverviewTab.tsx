'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Play, Eye, UserRound, MousePointerClick, Heart } from 'lucide-react';
import { Skeleton } from '@/components/admin/dashboard/utils';
import { ACCENT, Columns, HBars, NetBars, SplitBar, compact, fmt } from './charts';
import { Delta, Dot, Panel, PanelHeader, Segmented, cx } from './shared';
import { isReel, mediaThumb, type InboxData, type MediaData, type OverviewData } from './types';

/*
 * Layout (desktop): one screen answers "how are we doing" without scrolling past a chart.
 *   Row 1  Performance — 4 headline numbers, then what people did (mix) and how far they went (reach → clicks)
 *   Row 2  New followers chart (2/3)       | Today in the inbox (1/3)
 *   Row 3  Audience: locations · age · gender (2/3) | Top reels (1/3)
 */

const RANGES = [{ k: 'day', l: 'Today' }, { k: 'week', l: '7 days' }, { k: 'month', l: '30 days' }];
const PREV_LABEL: Record<string, string> = { day: 'yesterday', week: 'the previous 7 days', month: 'the previous 30 days' };

const PRIMARY = [
  { k: 'views', label: 'Views', icon: <Play /> },
  { k: 'reach', label: 'Accounts reached', icon: <Eye /> },
  { k: 'profile_views', label: 'Profile visits', icon: <UserRound /> },
  { k: 'website_clicks', label: 'Link clicks', icon: <MousePointerClick /> },
];
const GENDER: Record<string, string> = { M: 'Men', F: 'Women', U: 'Not specified' };
const pct = (a?: number, b?: number) => (a != null && b ? (a / b) * 100 : null);
const pctText = (v: number | null) => (v == null ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);

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
  const bestDay = followerBars.reduce<(typeof followerBars)[number] | null>((b, d) => (!b || (d.net ?? 0) > (b.net ?? 0) ? d : b), null);

  const cur = overview?.totals[range] || {};
  const prev = overview?.previous?.[range] || {};
  const er = (t: Record<string, number>) => pct(t.total_interactions, t.reach);

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700">{error}</p>}

      {/* Row 1 — Performance */}
      <Panel>
        <PanelHeader title="Performance" description={`Compared with ${PREV_LABEL[range]}`} right={<Segmented options={RANGES} value={range} onChange={(v) => setRange(v as any)} />} />
        {!overview ? <div className="p-5"><Skeleton className="h-[260px] rounded-lg" /></div> : (
          <>
            <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 lg:grid-cols-4 [&>*]:bg-white">
              {PRIMARY.map((m) => (
                <div key={m.k} className="min-w-0 px-4 py-4 sm:px-5" title={cur[m.k] != null ? fmt(cur[m.k]) : undefined}>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><span className="text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{m.icon}</span>{m.label}</p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <p className="text-[26px] font-semibold leading-8 tabular-nums tracking-tight text-slate-900">{cur[m.k] == null ? '—' : compact(cur[m.k])}</p>
                    <Delta cur={cur[m.k]} prev={prev[m.k]} />
                  </div>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-400">{prev[m.k] != null ? `${compact(prev[m.k])} before` : ' '}</p>
                </div>
              ))}
            </div>
            <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-slate-900">What people did</p>
                  <p className="text-xs text-slate-500">
                    <b className="font-semibold tabular-nums text-slate-900">{compact(cur.total_interactions || 0)}</b> interactions ·{' '}
                    <b className="font-semibold tabular-nums text-slate-900">{pctText(er(cur))}</b> engagement <Delta cur={er(cur)} prev={er(prev)} />
                  </p>
                </div>
                <SplitBar parts={[
                  { label: 'Likes', value: cur.likes || 0, note: <Delta cur={cur.likes} prev={prev.likes} /> },
                  { label: 'Comments', value: cur.comments || 0, note: <Delta cur={cur.comments} prev={prev.comments} /> },
                  { label: 'Shares', value: cur.shares || 0, note: <Delta cur={cur.shares} prev={prev.shares} /> },
                  { label: 'Saves', value: cur.saves || 0, note: <Delta cur={cur.saves} prev={prev.saves} /> },
                ]} />
              </div>
              <div className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-slate-900">From reach to clicks</p>
                  <p className="text-xs text-slate-500">share of accounts reached</p>
                </div>
                <Funnel steps={[
                  { label: 'Reached', value: cur.reach },
                  { label: 'Engaged', value: cur.accounts_engaged },
                  { label: 'Visited profile', value: cur.profile_views },
                  { label: 'Clicked link', value: cur.website_clicks },
                ]} />
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* Row 2 — growth + today */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader title="New followers per day" description="Follows counted by Instagram · last 30 days"
            right={newFollowers != null && (
              <div className="flex items-center gap-5 text-right">
                <Mini label="Total" value={`+${fmt(newFollowers)}`} strong />
                <Mini label="Per day" value={fmt(avgPerDay || 0)} />
                {bestDay && <Mini label="Best day" value={bestDay.label} className="hidden sm:block" />}
              </div>
            )} />
          <div className="px-3 pb-3 pt-4 sm:px-4">
            {overview ? <NetBars bars={followerBars} height={210} valueLabel="new" closeLabel="so far this period" emptyText="Instagram has no follower data for this period yet." /> : <Skeleton className="h-[210px]" />}
          </div>
        </Panel>
        <TodayCard inbox={inbox} overview={overview} onTab={onTab} />
      </div>

      {/* Row 3 — audience + top reels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Audience overview={overview} className="lg:col-span-2" />
        <TopReels media={media} onTab={onTab} />
      </div>

      {overview && (
        <a href={`https://www.instagram.com/${overview.profile.username}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
          Data from Instagram · refreshed every 10 minutes <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Mini({ label, value, strong, className }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cx('text-[13px] font-semibold tabular-nums', strong ? 'text-emerald-600' : 'text-slate-900')}>{value}</p>
    </div>
  );
}

/** Each step as a bar sized against the first; conversion to the right. */
function Funnel({ steps }: { steps: { label: string; value?: number }[] }) {
  const base = steps[0].value || 0;
  return (
    <ul className="space-y-2">
      {steps.map((s, i) => {
        const share = base && s.value != null ? s.value / base : 0;
        return (
          <li key={s.label} className="grid grid-cols-[100px_minmax(0,1fr)_84px] items-center gap-3 text-xs">
            <span className="truncate text-slate-600">{s.label}</span>
            <div className="h-6 rounded-md bg-slate-50">
              <div className="flex h-full items-center rounded-md px-2 text-[11px] font-semibold tabular-nums text-white"
                style={{ width: `${Math.max(share * 100, 1.5)}%`, background: i === 0 ? ACCENT : i === 1 ? '#e04d8f' : i === 2 ? '#ec6fa6' : '#f2a7c8', minWidth: 6 }}>
                {share > 0.18 && compact(s.value || 0)}
              </div>
            </div>
            <span className="text-right tabular-nums">
              {share <= 0.18 && <span className="mr-1 font-semibold text-slate-900">{s.value == null ? '—' : compact(s.value)}</span>}
              <span className="text-slate-400">{i === 0 ? '' : pctText(share * 100)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TodayCard({ inbox, overview, onTab }: { inbox: InboxData | null; overview: OverviewData | null; onTab: (t: string) => void }) {
  const t = inbox?.today;
  const a = inbox?.automation;
  const autoOn = !!a && (a.dm_enabled || a.comment_enabled);
  const waiting = t ? (t.people - t.peopleReplied) + (t.comments - t.commentsReplied) : 0;
  const lastFollowers = overview?.followers.length ? overview.followers[overview.followers.length - 1].value : null;

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={<span className="flex items-center gap-2">Today<span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#d62976]" /></span></span>}
        description="Inbox activity since midnight" />
      {!t ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : (
        <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
          <Progress label="Chats answered" done={t.peopleReplied} total={t.people} sub={`${fmt(t.dmsIn)} messages`} />
          <Progress label="Comments answered" done={t.commentsReplied} total={t.comments} sub={`${fmt(t.comments)} comments`} />
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3.5">
            <div>
              <p className="text-xs text-slate-500">Auto replies</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{fmt(t.autoDm + t.autoComment + t.privateReplies)}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Dot tone={autoOn ? 'green' : 'gray'} />{autoOn ? 'On' : 'Off'}{t.failed ? <span className="text-rose-600"> · {t.failed} failed</span> : ''}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">New followers</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{lastFollowers == null ? '—' : `+${fmt(lastFollowers)}`}</p>
              <p className="text-[11px] text-slate-500">latest full day</p>
            </div>
          </div>
          <button onClick={() => onTab('inbox')}
            className={cx('mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors',
              waiting > 0 ? 'bg-[#0095f6] text-white hover:bg-[#1877f2]' : 'border border-slate-200 text-slate-700 hover:bg-slate-50')}>
            {waiting > 0 ? `Answer ${waiting} waiting` : 'Open inbox'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Panel>
  );
}

function Progress({ label, done, total, sub }: { label: string; done: number; total: number; sub: string }) {
  const share = total ? done / total : 1;
  const left = total - done;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500"><b className="font-semibold text-slate-900">{done}</b>/{total}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cx('h-full rounded-full', left > 0 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{sub}{left > 0 ? <span className="text-amber-600"> · {left} waiting</span> : total ? ' · all answered' : ''}</p>
    </div>
  );
}

function Audience({ overview, className }: { overview: OverviewData | null; className?: string }) {
  const [where, setWhere] = useState<'city' | 'country'>('city');
  const d = overview?.demographics;
  const age = useMemo(() => [...(d?.age || [])].sort((a, b) => a.label.localeCompare(b.label)), [d]);
  const gender = useMemo(() => {
    const order = ['F', 'M', 'U'];
    return [...(d?.gender || [])].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)).map((g) => ({ label: GENDER[g.label] || g.label, value: g.value }));
  }, [d]);

  return (
    <Panel className={cx('min-w-0', className)}>
      <PanelHeader title="Audience" description="Who follows you" />
      {!overview ? <div className="p-5"><Skeleton className="h-[220px]" /></div> : (
        <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-900">Top locations</p>
              <Segmented size="xs" value={where} onChange={(v) => setWhere(v as any)} options={[{ k: 'city', l: 'Cities' }, { k: 'country', l: 'Countries' }]} />
            </div>
            <HBars rows={d?.[where]} limit={6} />
          </div>
          <div className="space-y-5 px-4 py-4 sm:px-5">
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-900">Age</p>
              <Columns rows={age} height={96} />
            </div>
            <div>
              <p className="mb-2.5 text-[13px] font-semibold text-slate-900">Gender</p>
              {gender.length ? <SplitBar size="sm" parts={gender} /> : <p className="text-xs text-slate-400">Not available</p>}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function TopReels({ media, onTab }: { media: MediaData | null; onTab: (t: string) => void }) {
  const top = useMemo(() => [...(media?.media || [])].filter(isReel).sort((a, b) => (b.insights.views || 0) - (a.insights.views || 0)).slice(0, 5), [media]);
  const max = Math.max(1, ...top.map((m) => m.insights.views || 0));
  return (
    <Panel className="min-w-0 overflow-hidden">
      <PanelHeader title="Top reels" description="By views, latest posts"
        right={<button onClick={() => onTab('posts')} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900">All posts <ArrowRight className="h-3 w-3" /></button>} />
      {!media ? <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : top.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-slate-500">No reels among your latest posts.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {top.map((m, i) => (
            <li key={m.id}>
              <a href={m.permalink} target="_blank" rel="noreferrer" className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 sm:px-5">
                <span className="w-3 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaThumb(m)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-12 w-9 shrink-0 rounded-md bg-slate-100 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-700 group-hover:text-slate-900">{(m.caption || 'Untitled reel').split('\n')[0]}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${((m.insights.views || 0) / max) * 100}%`, background: i === 0 ? ACCENT : '#f2a7c8' }} /></div>
                    <span className="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-slate-400"><Heart className="h-3 w-3" />{compact(m.like_count || 0)}</span>
                  </div>
                </div>
                <div className="w-12 shrink-0 text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-slate-900">{compact(m.insights.views || 0)}</p>
                  <p className="text-[11px] text-slate-400">views</p>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function SectionTitle({ title, description, right }: { title: string; description?: string; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {right}
    </div>
  );
}
