'use client';

import { ChevronLeft, Info, ImageIcon, Phone, Video } from 'lucide-react';
import { Avatar, StoryRing, cx } from './shared';
import type { RuleReply, TripCardPreview } from './types';
import { renderText } from '@/lib/instagram-tracker/rules-core';

const SAMPLE_USER = 'traveller.riya';
// Same filling as the real send; {a|b} options always show the first one so the preview doesn't flicker.
const fillVars = (s: string, trip?: string | null) => renderText(s, { username: SAMPLE_USER, name: 'Riya Sharma', trip }, () => 0);
const BUBBLE_OUT = 'bg-[linear-gradient(135deg,#8a3ffc_0%,#5b5bf7_55%,#0095f6_100%)] text-white';

/** Phone-shaped preview of how a reply lands in Instagram. */
export default function ReplyPreview({
  channel, incoming, reply, publicReply, trips, tripName, profile,
}: {
  channel: 'dm' | 'comment';
  incoming: string;
  reply: RuleReply | null;          // the DM that gets sent
  publicReply?: RuleReply | null;   // comment rules: the public reply
  trips: TripCardPreview[] | null;
  /** {trip} for this preview message (from the server's trip choice) */
  tripName?: string | null;
  profile?: { username?: string; picture?: string | null };
}) {
  const me = profile?.username || 'your_account';

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="overflow-hidden rounded-[34px] border-[6px] border-slate-900 bg-white shadow-xl shadow-slate-900/10">
        {/* status bar */}
        <div className="flex items-center justify-between bg-white px-5 pt-2 text-[10px] font-semibold text-slate-900">
          <span>9:41</span><span className="h-4 w-16 rounded-full bg-slate-900" /><span>5G</span>
        </div>

        {channel === 'comment' ? (
          <div className="h-[520px] overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
              <ChevronLeft className="h-5 w-5" /><p className="flex-1 text-center text-sm font-semibold">Comments</p><span className="w-5" />
            </div>
            <div className="space-y-4 px-3 py-3">
              <div className="flex gap-2.5">
                <Avatar name={SAMPLE_USER} size={30} />
                <div className="min-w-0 text-[13px]">
                  <p><b className="font-semibold">{SAMPLE_USER}</b> <span className="text-slate-400">2m</span></p>
                  <p className="text-slate-900">{incoming || 'Price?'}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Reply</p>
                </div>
              </div>
              {publicReply ? (
                <div className="ml-10 flex gap-2.5">
                  <Avatar src={profile?.picture} name={me} size={24} />
                  <div className="min-w-0 text-[13px]">
                    <p><b className="font-semibold">{me}</b> <span className="text-slate-400">now</span></p>
                    <p className="whitespace-pre-wrap break-words text-slate-900">{fillVars(publicReply.text) || <span className="text-slate-300">Your public reply…</span>}</p>
                  </div>
                </div>
              ) : <p className="ml-10 text-[11px] text-slate-400">No public reply</p>}
            </div>
            {reply && (
              <div className="border-t border-dashed border-slate-200 bg-slate-50/60 px-3 pb-4 pt-3">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">…and in their DMs</p>
                <DmMessage reply={reply} trips={trips} tripName={tripName} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[520px] flex-col">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2">
              <ChevronLeft className="h-5 w-5" />
              <StoryRing><Avatar src={profile?.picture} name={me} size={26} /></StoryRing>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold">{me}</p>
                <p className="text-[10px] text-slate-400">Business account</p>
              </div>
              <Phone className="h-4 w-4" /><Video className="h-4 w-4" /><Info className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              <p className="pb-1 text-center text-[10px] text-slate-400">Today 9:41</p>
              <div className="flex items-end gap-2">
                <Avatar name={SAMPLE_USER} size={22} />
                <div className="max-w-[75%] rounded-3xl rounded-bl-md bg-[#efefef] px-3.5 py-2 text-[13px]">{incoming || 'Hi!'}</div>
              </div>
              {reply ? <DmMessage reply={reply} trips={trips} tripName={tripName} /> : <p className="py-8 text-center text-xs text-slate-400">Add a reply to preview it</p>}
            </div>
            {reply?.format === 'text' && reply.quick_replies.length > 0 && !reply.buttons.length && (
              <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
                {reply.quick_replies.map((q, i) => (
                  <span key={i} className="shrink-0 rounded-full border border-[#0095f6] px-3 py-1 text-xs font-medium text-[#0095f6]">{q.slice(0, 20)}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2">
              <div className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-400">Message…</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Our text bubble, with optional quick-reply chips under it. */
function Bubble({ text, quick }: { text: string; quick?: string[] }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className={cx('max-w-[78%] whitespace-pre-wrap break-words rounded-3xl rounded-br-md px-3.5 py-2 text-[13px]', BUBBLE_OUT)}>{text}</div>
      {!!quick?.length && (
        <div className="flex max-w-full flex-wrap justify-end gap-1">
          {quick.map((q) => <span key={q} className="rounded-full border border-[#0095f6] px-2.5 py-1 text-[11px] font-medium text-[#0095f6]">{q}</span>)}
        </div>
      )}
    </div>
  );
}

function DmMessage({ reply, trips, tripName }: { reply: RuleReply; trips: TripCardPreview[] | null; tripName?: string | null }) {
  const fill = (s: string) => fillVars(s, tripName);
  const text = fill(reply.text || '');
  const before = reply.options?.before_text ? fill(reply.options.before_text) : '';
  const after = reply.options?.after_text ? fill(reply.options.after_text) : '';
  const extra = reply.options?.trip_extra_button?.title ? reply.options.trip_extra_button.title : null;
  const buttons = (reply.buttons || []).filter((b) => b.title);

  if (reply.format === 'trips') {
    return (
      <div className="space-y-2">
        {text && <Bubble text={text} />}
        {trips && trips.length === 0 && <p className="text-center text-[11px] text-slate-400">No trip cards for this message</p>}
        <div className="gk-scroll-subtle -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1">
          {(trips ? trips : [null, null]).map((t, i) => (
            <div key={i} className="w-[210px] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex h-28 items-center justify-center bg-slate-100">
                {t?.image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.image} alt="" className="h-full w-full object-cover" />
                  : <ImageIcon className="h-6 w-6 text-slate-300" />}
              </div>
              <div className="px-3 py-2">
                <p className="line-clamp-1 text-[13px] font-semibold">{t?.title || 'Trip title'}</p>
                <p className="line-clamp-1 text-[11px] text-slate-500">{t?.subtitle || 'From ₹…'}</p>
              </div>
              <div className="border-t border-slate-100 py-2 text-center text-[13px] font-semibold text-[#0095f6]">{reply.options?.trip_button || 'View trip'}</div>
              {extra && <div className="border-t border-slate-100 py-2 text-center text-[13px] font-semibold text-[#0095f6]">{extra}</div>}
            </div>
          ))}
        </div>
        {after && <Bubble text={after} quick={reply.options?.after_quick} />}
      </div>
    );
  }

  if (reply.format === 'card') {
    return (
      <div className="space-y-2">
      {before && <Bubble text={before} />}
      <div className="flex justify-end">
        <div className="w-[230px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex h-32 items-center justify-center bg-slate-100">
            {reply.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={reply.image_url} alt="" className="h-full w-full object-cover" />
              : <ImageIcon className="h-6 w-6 text-slate-300" />}
          </div>
          <div className="px-3 py-2">
            <p className="line-clamp-2 text-[13px] font-semibold">{fill(reply.title || '') || 'Card title'}</p>
            {text && <p className="line-clamp-2 text-[11px] text-slate-500">{text}</p>}
          </div>
          {buttons.map((b, i) => <div key={i} className="border-t border-slate-100 py-2 text-center text-[13px] font-semibold text-[#0095f6]">{b.title}</div>)}
        </div>
      </div>
      {after && <Bubble text={after} quick={reply.options?.after_quick} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className={cx('max-w-[78%] whitespace-pre-wrap break-words px-3.5 py-2 text-[13px]', BUBBLE_OUT, buttons.length ? 'rounded-3xl rounded-br-md' : 'rounded-3xl rounded-br-md')}>
        {text || <span className="text-white/60">Your message…</span>}
      </div>
      {buttons.length > 0 && (
        <div className="w-[78%] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {buttons.map((b, i) => <div key={i} className={cx('py-2 text-center text-[13px] font-semibold text-slate-900', i && 'border-t border-slate-100')}>{b.title}</div>)}
        </div>
      )}
    </div>
  );
}
