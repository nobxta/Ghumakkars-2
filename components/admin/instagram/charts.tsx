'use client';

import { useMemo, useRef, useState } from 'react';

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

const W = 720;
const PAD = { l: 48, r: 12, t: 10, b: 24 };

export interface LinePoint { t: number; v: number; manual?: boolean }

/**
 * Follower count over time. Y-axis is zoomed to the data (not from 0) —
 * follower changes are small relative to the total, so a 0-based axis is flat.
 */
export function FollowerLine({ points, height = 220 }: { points: LinePoint[]; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    const pad = Math.max(1, (hi - lo) * 0.12);
    const yt = ticks(lo - pad, hi + pad);
    lo = yt[0]; hi = yt[yt.length - 1];
    const t0 = points[0].t, t1 = points[points.length - 1].t;
    const x = (t: number) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
    const xs = points.map((p) => x(p.t));
    const ys = points.map((p) => y(p.v));
    const d = xs.map((px, i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${ys[i].toFixed(1)}`).join('');
    const area = `${d}L${xs[xs.length - 1].toFixed(1)},${height - PAD.b}L${xs[0].toFixed(1)},${height - PAD.b}Z`;
    // ~5 x labels
    const span = t1 - t0;
    const xl: { x: number; label: string }[] = [];
    const n = Math.min(5, points.length);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? t0 : t0 + (span * i) / (n - 1);
      const dt = new Date(t);
      xl.push({ x: x(t), label: span > 300 * 86_400_000 ? dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : span < 2 * 86_400_000 ? dt.toLocaleTimeString('en-IN', { hour: 'numeric' }) : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) });
    }
    return { yt, y, xs, ys, d, area, xl };
  }, [points, height]);

  if (!geo) return <Empty height={height} />;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    geo.xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(geo.xs[best] - px)) best = i; });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const prev = hover != null && hover > 0 ? points[hover - 1] : null;

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} className="h-auto w-full touch-none select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Followers over time">
        <defs>
          <linearGradient id="ig-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d62976" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#d62976" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ig-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#fa7e1e" />
            <stop offset="50%" stopColor="#d62976" />
            <stop offset="100%" stopColor="#962fbf" />
          </linearGradient>
        </defs>
        {geo.yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(v)} y2={geo.y(v)} stroke="#F1F5F9" />
            <text x={PAD.l - 6} y={geo.y(v) + 3} textAnchor="end" className="fill-slate-400" fontSize="10">{compact(v)}</text>
          </g>
        ))}
        {geo.xl.map((l, i) => (
          <text key={i} x={l.x} y={height - 6} textAnchor={i === 0 ? 'start' : i === geo.xl.length - 1 ? 'end' : 'middle'} className="fill-slate-400" fontSize="10">{l.label}</text>
        ))}
        <path d={geo.area} fill="url(#ig-area)" />
        <path d={geo.d} fill="none" stroke="url(#ig-stroke)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 40 && points.map((p, i) => (
          <circle key={i} cx={geo.xs[i]} cy={geo.ys[i]} r={p.manual ? 3 : 2} fill={p.manual ? '#fff' : '#d62976'} stroke="#d62976" strokeWidth={p.manual ? 1.5 : 0} />
        ))}
        {hover != null && (
          <g>
            <line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={PAD.t} y2={height - PAD.b} stroke="#94A3B8" strokeWidth="1" />
            <circle cx={geo.xs[hover]} cy={geo.ys[hover]} r="4.5" fill="#d62976" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
          style={{ left: `${(geo.xs[hover] / W) * 100}%`, transform: `translateX(${geo.xs[hover] > W * 0.7 ? '-105%' : '8px'})` }}
        >
          <p className="font-medium text-slate-500">{new Date(hp.t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{hp.manual ? ' · manual' : ''}</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{fmt(hp.v)}</p>
          {prev && <p className={`tabular-nums ${hp.v - prev.v > 0 ? 'text-emerald-600' : hp.v - prev.v < 0 ? 'text-rose-600' : 'text-slate-400'}`}>{signed(hp.v - prev.v)} since previous</p>}
        </div>
      )}
    </div>
  );
}

export interface NetBar { key: string; label: string; net: number | null; close: number }

/** Net follower change per bucket — bars go up (gain) or down (loss) from zero. */
export function NetBars({ bars, height = 160, closeLabel = 'total', emptyText = 'Net change appears after two days of data.', color, gradient }: { bars: NetBar[]; height?: number; closeLabel?: string; emptyText?: string; color?: string; gradient?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = bars.filter((b) => b.net != null) as (NetBar & { net: number })[];
  if (data.length === 0) return <Empty height={height} text={emptyText} />;

  const max = Math.max(1, ...data.map((b) => b.net));
  const min = Math.min(0, ...data.map((b) => b.net));
  const yt = ticks(min, max, 3);
  const lo = Math.min(yt[0], 0), hi = Math.max(yt[yt.length - 1], 0);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
  const slot = (W - PAD.l - PAD.r) / data.length;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const every = Math.ceil(data.length / 8);
  const hb = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full select-none" onMouseLeave={() => setHover(null)} role="img" aria-label="Net follower change">
        <defs>
          <linearGradient id="ig-bar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d62976" />
            <stop offset="100%" stopColor="#fa7e1e" />
          </linearGradient>
        </defs>
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#CBD5E1' : '#F1F5F9'} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-400" fontSize="10">{v > 0 ? '+' : ''}{compact(v)}</text>
          </g>
        ))}
        {data.map((b, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const top = y(Math.max(0, b.net));
          const h = Math.max(1, Math.abs(y(b.net) - y(0)));
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)}>
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={height - PAD.t - PAD.b} fill="transparent" />
              <path d={barPath(cx - bw / 2, top, bw, h, Math.min(4, bw / 2, h), b.net >= 0)} fill={gradient ? 'url(#ig-bar)' : color || (b.net >= 0 ? '#10B981' : '#F43F5E')} opacity={hover == null || hover === i ? 1 : 0.4} />
              {i % every === 0 && <text x={cx} y={height - 6} textAnchor="middle" className="fill-slate-400" fontSize="10">{b.label}</text>}
            </g>
          );
        })}
      </svg>
      {hb && hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
          style={{ left: `${((PAD.l + slot * hover + slot / 2) / W) * 100}%`, transform: `translateX(${hover > data.length * 0.7 ? '-105%' : '8px'})` }}
        >
          <p className="font-medium text-slate-500">{hb.label}</p>
          <p className={`text-sm font-bold tabular-nums ${color || gradient ? 'text-slate-900' : hb.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{color || gradient ? fmt(hb.net) : signed(hb.net)}</p>
          <p className="tabular-nums text-slate-500">{fmt(hb.close)} {closeLabel}</p>
        </div>
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

function Empty({ height, text = 'No data yet — the first check fills this in.' }: { height: number; text?: string }) {
  return <div className="flex items-center justify-center text-xs text-slate-400" style={{ height }}>{text}</div>;
}

export { fmt, signed, compact };
