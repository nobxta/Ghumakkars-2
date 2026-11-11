'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, Rows3, Play, Heart, MessageCircle, ArrowUpRight, ChevronDown, ChevronUp, Clapperboard, Copy, Send, Bookmark, Eye } from 'lucide-react';
import { Skeleton } from '@/components/admin/dashboard/utils';
import { compact, fmt } from './charts';
import { Panel, Segmented, Stat, StatRow, IG_GRADIENT, cx } from './shared';
import { isReel, mediaThumb, type IgMediaItem, type MediaData } from './types';

type SortKey = 'date' | 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saved' | 'er';

const val = (m: IgMediaItem, k: SortKey): number => {
  switch (k) {
    case 'date': return new Date(m.timestamp).getTime();
    case 'likes': return m.like_count || 0;
    case 'comments': return m.comments_count || 0;
    case 'er': return m.insights.reach ? (m.insights.total_interactions || 0) / m.insights.reach : 0;
    default: return m.insights[k] || 0;
  }
};
const typeLabel = (m: IgMediaItem) => (isReel(m) ? 'Reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Photo');
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const SORTS: { k: SortKey; l: string }[] = [
  { k: 'date', l: 'Newest' }, { k: 'views', l: 'Most views' }, { k: 'reach', l: 'Most reach' }, { k: 'likes', l: 'Most likes' },
  { k: 'comments', l: 'Most comments' }, { k: 'shares', l: 'Most shares' }, { k: 'saved', l: 'Most saves' }, { k: 'er', l: 'Best engagement' },
];

export default function PostsTab({ media, error }: { media: MediaData | null; error: string }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const all = media?.media || [];
  const list = useMemo(() => {
    const f = filter === 'reels' ? all.filter(isReel) : filter === 'posts' ? all.filter((m) => !isReel(m)) : all;
    return [...f].sort((a, b) => val(b, sort) - val(a, sort));
  }, [all, filter, sort]);

  const avg = useMemo(() => {
    if (!list.length) return null;
    const mean = (fn: (m: IgMediaItem) => number) => list.reduce((s, m) => s + fn(m), 0) / list.length;
    return { views: mean((m) => m.insights.views || 0), reach: mean((m) => m.insights.reach || 0), likes: mean((m) => m.like_count || 0), er: mean((m) => val(m, 'er')) * 100 };
  }, [list]);

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-[13px] text-rose-700">{error}</p>;
  if (!media) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      {avg && (
        <StatRow cols="lg:grid-cols-4">
          <Stat icon={<Play />} tone="pink" label={`Average views · ${list.length} ${filter === 'reels' ? 'reels' : 'posts'}`} value={compact(avg.views)} />
          <Stat icon={<Eye />} tone="purple" label="Average reach" value={compact(avg.reach)} />
          <Stat icon={<Heart />} tone="rose" label="Average likes" value={compact(avg.likes)} />
          <Stat icon={<MessageCircle />} tone="orange" label="Average engagement" value={`${avg.er.toFixed(1)}%`} sub="interactions ÷ reach" />
        </StatRow>
      )}

      {/* Filters left · ordering and view right */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented options={[{ k: 'all', l: 'All' }, { k: 'reels', l: 'Reels' }, { k: 'posts', l: 'Photos & carousels' }]} value={filter} onChange={setFilter} />
        <div className="ml-auto flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Sort posts</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
              {SORTS.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </label>
          <Segmented options={[{ k: 'grid', l: <LayoutGrid className="h-3.5 w-3.5" aria-label="Grid" /> }, { k: 'table', l: <Rows3 className="h-3.5 w-3.5" aria-label="Table" /> }]} value={view} onChange={(v) => setView(v as any)} />
        </div>
      </div>

      {view === 'grid' ? (
        <Panel className="p-1.5">
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 xl:grid-cols-6">
            {list.map((m) => {
              const er = val(m, 'er') * 100;
              const TypeIcon = isReel(m) ? Clapperboard : m.media_type === 'CAROUSEL_ALBUM' ? Copy : null;
              return (
                <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaThumb(m)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {TypeIcon && <TypeIcon className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />}
                  {m.insights.views != null && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-opacity group-hover:opacity-0">
                      <Play className="h-3.5 w-3.5" fill="currentColor" />{compact(m.insights.views)}
                    </span>
                  )}
                  {/* Instagram hover: likes and comments front and centre */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="flex items-center gap-4 text-sm font-bold text-white">
                      <span className="flex items-center gap-1.5"><Heart className="h-[18px] w-[18px]" fill="currentColor" />{compact(m.like_count || 0)}</span>
                      <span className="flex items-center gap-1.5"><MessageCircle className="h-[18px] w-[18px]" fill="currentColor" />{compact(m.comments_count || 0)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-medium text-white/85">
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" fill="currentColor" />{compact(m.insights.views || 0)}</span>
                      <span className="flex items-center gap-1"><Send className="h-3 w-3" />{compact(m.insights.shares || 0)}</span>
                      <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" fill="currentColor" />{compact(m.insights.saved || 0)}</span>
                    </div>
                    <span className={cx('mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white', er >= 5 ? IG_GRADIENT : 'bg-white/20')}>{er.toFixed(1)}% engagement</span>
                    <span className="absolute bottom-2 text-[10px] text-white/70">{day(m.timestamp)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Post</th>
                  <Th k="date" sort={sort} setSort={setSort}>Date</Th>
                  <Th k="views" sort={sort} setSort={setSort}>Views</Th>
                  <Th k="reach" sort={sort} setSort={setSort}>Reach</Th>
                  <Th k="likes" sort={sort} setSort={setSort}>Likes</Th>
                  <Th k="comments" sort={sort} setSort={setSort}>Comments</Th>
                  <Th k="shares" sort={sort} setSort={setSort}>Shares</Th>
                  <Th k="saved" sort={sort} setSort={setSort}>Saves</Th>
                  <Th k="er" sort={sort} setSort={setSort} last>Engagement</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {list.map((m) => (
                  <tr key={m.id} className="group hover:bg-slate-50/70">
                    <td className="px-5 py-2.5">
                      <a href={m.permalink} target="_blank" rel="noreferrer" className="flex max-w-[320px] items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaThumb(m)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-11 w-9 shrink-0 rounded bg-slate-100 object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate text-slate-900 group-hover:underline">{(m.caption || 'No caption').split('\n')[0]}</span>
                          <span className="text-xs text-slate-400">{typeLabel(m)}</span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-500">{day(m.timestamp)}</td>
                    <Td on={sort === 'views'}>{fmt(m.insights.views || 0)}</Td>
                    <Td on={sort === 'reach'}>{fmt(m.insights.reach || 0)}</Td>
                    <Td on={sort === 'likes'}>{fmt(m.like_count || 0)}</Td>
                    <Td on={sort === 'comments'}>{fmt(m.comments_count || 0)}</Td>
                    <Td on={sort === 'shares'}>{fmt(m.insights.shares || 0)}</Td>
                    <Td on={sort === 'saved'}>{fmt(m.insights.saved || 0)}</Td>
                    <td className={cx('px-5 py-2.5 text-right', sort === 'er' ? 'font-semibold text-slate-900' : 'text-slate-600')}>{(val(m, 'er') * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <p className="text-center text-xs text-slate-400">Your latest {all.length} posts · updated {new Date(media.fetchedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
    </div>
  );
}

function Th({ k, sort, setSort, children, last }: { k: SortKey; sort: SortKey; setSort: (k: SortKey) => void; children: React.ReactNode; last?: boolean }) {
  return (
    <th className={cx('py-3 text-right font-medium', last ? 'px-5' : 'px-3')}>
      <button onClick={() => setSort(k)} className={cx('inline-flex items-center gap-0.5 hover:text-slate-900', sort === k && 'text-slate-900')}>
        {children}{sort === k ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 opacity-0" />}
      </button>
    </th>
  );
}

function Td({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <td className={cx('px-3 py-2.5 text-right', on ? 'font-semibold text-slate-900' : 'text-slate-600')}>{children}</td>;
}
