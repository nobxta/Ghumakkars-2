'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

/*
 * Charts for the Instagram section.
 * - Drawn at the container's real pixel width with a fixed pixel height, so a chart never
 *   grows taller on wide screens and its text stays 11px everywhere.
 * - One accent (Instagram magenta) for data; slate for axes and grid.
 */

export const ACCENT = '#d62976';
/** Single-hue ramp for parts of a whole (strong → light). */
export const RAMP = ['#a3195b', '#d62976', '#ec6fa6', '#f7bcd7'];

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
};
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

/** Round-ish tick values covering [min, max]. */
function ticks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const PAD = { l: 40, r: 8, t: 8, b: 22 };
const AXIS = { fontSize: 11, className: 'fill-slate-400' };

/** Measures the element's width; charts render once it is known. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Tip({ x, w, children }: { x: number; w: number; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
      style={{ left: x, transform: `translateX(${x > w * 0.65 ? 'calc(-100% - 10px)' : '10px'})` }}>
      {children}
    </div>
  );
}

export interface LinePoint { t: number; v: number; manual?: boolean }

/**
 * Follower count over time. Y-axis is zoomed to the data (not from 0) —
 * follower changes are small relative to the total, so a 0-based axis is flat.
 */
export function FollowerLine({ points, height = 220 }: { points: LinePoint[]; height?: number }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length === 0 || W === 0) return null;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    const pad = Math.max(1, (hi - lo) * 0.12);
    const yt = ticks(lo - pad, hi + pad);
    lo = yt[0]; hi = yt[yt.length - 1];
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const L = 52;
    const x = (t: number) => (t1 === t0 ? (L + W - PAD.r) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
    const xs = points.map((p) => x(p.t));
    const ys = points.map((p) => y(p.v));
    const d = xs.map((px, i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${ys[i].toFixed(1)}`).join('');
    const area = `${d}L${xs[xs.length - 1].toFixed(1)},${height - PAD.b}L${xs[0].toFixed(1)},${height - PAD.b}Z`;
    const span = t1 - t0;
    const xl: { x: number; label: string }[] = [];
    const n = Math.min(Math.max(2, Math.floor(W / 120)), points.length);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? t0 : t0 + (span * i) / (n - 1);
      const dt = new Date(t);
      xl.push({ x: x(t), label: span > 300 * 86_400_000 ? dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : span < 2 * 86_400_000 ? dt.toLocaleTimeString('en-IN', { hour: 'numeric' }) : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) });
    }
    // Small steps on big numbers (17,150 vs 17,200) would all round to "17K" — show them in full.
    const fine = yt.length > 1 && yt[1] - yt[0] < 1000 && hi >= 1000;
    return { yt, y, xs, ys, d, area, xl, fine };
  }, [points, height, W]);

  const onMove = (e: React.MouseEvent) => {
    if (!geo) return;
    const r = ref.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    geo.xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(geo.xs[best] - px)) best = i; });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const prev = hover != null && hover > 0 ? points[hover - 1] : null;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {points.length === 0 ? <Empty height={height} /> : geo && (
        <svg width={W} height={height} className="block touch-none select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Followers over time">
          <defs>
            <linearGradient id="ig-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.12" />
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.yt.map((v) => (
            <g key={v}>
              <line x1={52} x2={W - PAD.r} y1={geo.y(v)} y2={geo.y(v)} stroke="#F1F5F9" />
              <text x={44} y={geo.y(v) + 4} textAnchor="end" {...AXIS}>{geo.fine ? fmt(v) : compact(v)}</text>
            </g>
          ))}
          {geo.xl.map((l, i) => (
            <text key={i} x={l.x} y={height - 4} textAnchor={i === 0 ? 'start' : i === geo.xl.length - 1 ? 'end' : 'middle'} {...AXIS}>{l.label}</text>
          ))}
          <path d={geo.area} fill="url(#ig-area)" />
          <path d={geo.d} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.length <= 40 && points.map((p, i) => (
            <circle key={i} cx={geo.xs[i]} cy={geo.ys[i]} r={p.manual ? 3 : 2} fill={p.manual ? '#fff' : ACCENT} stroke={ACCENT} strokeWidth={p.manual ? 1.5 : 0} />
          ))}
          {hover != null && (
            <g>
              <line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={PAD.t} y2={height - PAD.b} stroke="#CBD5E1" strokeDasharray="3 3" />
              <circle cx={geo.xs[hover]} cy={geo.ys[hover]} r="4.5" fill={ACCENT} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {geo && hp && hover != null && (
        <Tip x={geo.xs[hover]} w={W}>
          <p className="text-slate-500">{new Date(hp.t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{hp.manual ? ' · manual' : ''}</p>
          <p className="text-sm font-semibold tabular-nums text-slate-900">{fmt(hp.v)}</p>
          {prev && <p className={`tabular-nums ${hp.v - prev.v > 0 ? 'text-emerald-600' : hp.v - prev.v < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{signed(hp.v - prev.v)} since previous</p>}
        </Tip>
      )}
    </div>
  );
}

export interface NetBar { key: string; label: string; net: number | null; close: number }

/**
 * Bars from zero. `signedColors` colours gains green and losses red (net change);
 * otherwise every bar is the accent (counts like views or messages).
 */
export function NetBars({ bars, height = 180, closeLabel = 'total', emptyText = 'Net change appears after two days of data.', signedColors = false, valueLabel }: {
  bars: NetBar[]; height?: number; closeLabel?: string; emptyText?: string; signedColors?: boolean; valueLabel?: string;
  /** @deprecated kept for older callers */ gradient?: boolean; color?: string;
}) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const data = bars.filter((b) => b.net != null) as (NetBar & { net: number })[];

  const max = Math.max(1, ...data.map((b) => b.net));
  const min = Math.min(0, ...data.map((b) => b.net));
  const yt = ticks(min, max, 3);
  const lo = Math.min(yt[0], 0), hi = Math.max(yt[yt.length - 1], 0);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
  const slot = data.length ? (W - PAD.l - PAD.r) / data.length : 0;
  const bw = Math.max(2, Math.min(28, slot * 0.68));
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(W / 70))));
  const hb = hover != null ? data[hover] : null;
  const fill = (v: number) => (signedColors ? (v >= 0 ? '#10B981' : '#F43F5E') : ACCENT);

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {data.length === 0 ? <Empty height={height} text={emptyText} /> : W > 0 && (
        <svg width={W} height={height} className="block select-none" onMouseLeave={() => setHover(null)} role="img" aria-label="Bar chart">
          {yt.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#CBD5E1' : '#F1F5F9'} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{signedColors && v > 0 ? '+' : ''}{compact(v)}</text>
            </g>
          ))}
          {data.map((b, i) => {
            const cx = PAD.l + slot * i + slot / 2;
            const top = y(Math.max(0, b.net));
            const h = Math.max(1, Math.abs(y(b.net) - y(0)));
            return (
              <g key={b.key} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={height - PAD.t - PAD.b} fill={hover === i ? '#F8FAFC' : 'transparent'} />
                <path d={barPath(cx - bw / 2, top, bw, h, Math.min(3, bw / 2, h), b.net >= 0)} fill={fill(b.net)} opacity={hover == null || hover === i ? 1 : 0.45} />
                {i % every === 0 && <text x={cx} y={height - 4} textAnchor="middle" {...AXIS}>{b.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hb && hover != null && (
        <Tip x={PAD.l + slot * hover + slot / 2} w={W}>
          <p className="text-slate-500">{hb.label}</p>
          <p className={`text-sm font-semibold tabular-nums ${!signedColors ? 'text-slate-900' : hb.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {signedColors ? signed(hb.net) : fmt(hb.net)}{valueLabel && <span className="ml-1 text-[11px] font-normal text-slate-500">{valueLabel}</span>}
          </p>
          <p className="tabular-nums text-slate-500">{fmt(hb.close)} {closeLabel}</p>
        </Tip>
      )}
    </div>
  );
}

/** Bar with rounded corners only at the data end (top for gains, bottom for losses). */
function barPath(x: number, y: number, w: number, h: number, r: number, up: boolean) {
  if (h <= r || r <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return up
    ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
    : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
}

/** Horizontal bars with label + value, e.g. top cities. */
export function HBars({ rows, limit = 6, format = 'percent' }: { rows?: { label: string; value: number }[]; limit?: number; format?: 'percent' | 'number' }) {
  const list = (rows || []).slice(0, limit);
  const total = (rows || []).reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...list.map((r) => r.value));
  if (!list.length) return <p className="py-6 text-center text-xs text-slate-400">Not available</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((r, i) => (
        <li key={r.label} className="text-xs">
          <div className="mb-1 flex justify-between gap-3">
            <span className={i === 0 ? 'truncate font-medium text-slate-900' : 'truncate text-slate-600'}>{r.label.split(',')[0]}</span>
            <span className="tabular-nums text-slate-500">{format === 'percent' && total ? `${((r.value / total) * 100).toFixed(r.value / total < 0.1 ? 1 : 0)}%` : fmt(r.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: i === 0 ? ACCENT : '#f2a7c8' }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns (CSS) for small categorical sets like age groups. */
export function Columns({ rows, height = 120 }: { rows: { label: string; value: number }[]; height?: number }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-xs text-slate-400">Not available</p>;
  return (
    <div className="flex items-end gap-2" style={{ height: height + 34 }}>
      {rows.map((r) => {
        const top = r.value === max;
        return (
          <div key={r.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className={top ? 'text-[11px] font-semibold tabular-nums text-slate-900' : 'text-[11px] tabular-nums text-slate-500'}>{total ? Math.round((r.value / total) * 100) : 0}%</span>
            <div className="w-full max-w-[44px] rounded-t-md" style={{ height: Math.max(3, (r.value / max) * height), background: top ? ACCENT : '#f2a7c8' }} title={`${r.label}: ${fmt(r.value)}`} />
            <span className="truncate text-[11px] text-slate-500">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One bar split into parts of a whole, with a legend. */
export function SplitBar({ parts, size = 'md' }: { parts: { label: string; value: number; note?: React.ReactNode }[]; size?: 'sm' | 'md' }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className={`flex overflow-hidden rounded-full bg-slate-100 ${size === 'sm' ? 'h-2' : 'h-2.5'}`}>
        {total > 0 && parts.map((p, i) => <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: RAMP[i % RAMP.length] }} className="h-full border-r-2 border-white last:border-r-0" title={`${p.label}: ${fmt(p.value)}`} />)}
      </div>
      <ul className={`mt-3 grid gap-x-4 gap-y-2 ${parts.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {parts.map((p, i) => (
          <li key={p.label} className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-500"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: RAMP[i % RAMP.length] }} />{p.label}</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-sm font-semibold tabular-nums text-slate-900">
              {compact(p.value)}<span className="text-[11px] font-normal text-slate-400">{total ? Math.round((p.value / total) * 100) : 0}%</span>
            </p>
            {p.note && <div className="mt-0.5">{p.note}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ height, text = 'No data yet — the first check fills this in.' }: { height: number; text?: string }) {
  return <div className="flex items-center justify-center text-xs text-slate-400" style={{ height }}>{text}</div>;
}

export { fmt, signed, compact };
