'use client';

/**
 * Dependency-free SVG chart kit for the admin Analytics page.
 * Conventions: one y-axis per chart, thin marks, 2px lines, 2px surface gaps
 * between fills, recessive grid, hover tooltip on every plot. Categorical hues
 * are assigned in fixed slot order (validated palette) and follow the entity.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
export const MUTED = '#c9c8c2';
const SURFACE = '#ffffff';
const GRID = '#eeede9';
const AXIS_TEXT = '#8a8983';

// ───────────────────────── utils ─────────────────────────
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Pick ~N evenly spaced indexes to label on a crowded x-axis. */
function labelEvery(n: number, width: number, px = 64) {
  const fit = Math.max(2, Math.floor(width / px));
  return Math.max(1, Math.ceil(n / fit));
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x + 12, 4), Math.max(4, width - 196));
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[150px] max-w-[220px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-[0_8px_28px_-6px_rgba(15,23,42,0.25)] backdrop-blur-sm"
      style={{ left, top: Math.max(0, y - 8) }}
    >
      {children}
    </div>
  );
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed
    ? <span className="inline-block h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: color }} />
    : <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; value?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <Swatch color={it.color} dashed={it.dashed} />
          {it.label}
          {it.value && <span className="font-semibold text-slate-900 tabular-nums">{it.value}</span>}
        </span>
      ))}
    </div>
  );
}

export function Empty({ height = 200, text = 'No data in this range' }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-400" style={{ height }}>
      {text}
    </div>
  );
}

// ───────────────────────── Time series (line / area) ─────────────────────────
export type LineSeries = { name: string; color: string; values: number[]; dashed?: boolean; area?: boolean };

export function TimeChart({
  labels, longLabels, series, format, height = 260, yFormat,
}: {
  labels: string[]; longLabels?: string[]; series: LineSeries[]; format: (v: number) => string; height?: number; yFormat?: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const padL = 52; const padR = 12; const padT = 12; const padB = 28;
  const iw = Math.max(10, width - padL - padR);
  const ih = height - padT - padB;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - (v / top) * ih;
  const every = labelEvery(n, iw);
  const allZero = series.every((s) => s.values.every((v) => !v));

  const paths = useMemo(() => series.map((s) => {
    const pts = s.values.map((v, i) => [x(i), y(v)] as const);
    const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');
    const area = `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    return { line, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, width, height, top, n]);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(', ')}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`ag-${si}-${s.color.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular-nums">{(yFormat || format)(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (n - 1 - i >= every / 2 || i === n - 1) ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={AXIS_TEXT}>{l}</text>
          ) : null)}
          {!allZero && series.map((s, si) => s.area && <path key={`a${si}`} d={paths[si].area} fill={`url(#ag-${si}-${s.color.slice(1)})`} />)}
          {series.map((s, si) => (
            <path key={`l${si}`} d={paths[si].line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 5' : undefined} opacity={s.dashed ? 0.8 : 1} />
          ))}
          {n <= 40 && series.filter((s) => !s.dashed).map((s, si) => s.values.map((v, i) => (
            <circle key={`${si}-${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 0} fill={s.color} stroke={SURFACE} strokeWidth={2} />
          )))}
          {hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#94a3b8" strokeDasharray="3 3" />
              {series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(s.values[hover] || 0)} r={4.5} fill={s.dashed ? SURFACE : s.color} stroke={s.dashed ? s.color : SURFACE} strokeWidth={2} />)}
            </>
          )}
          <rect x={padL} y={padT} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }} />
        </svg>
      )}
      {hover != null && width > 0 && (
        <Tooltip x={x(hover)} y={padT} width={width}>
          <p className="mb-1.5 font-semibold text-slate-900">{(longLabels || labels)[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Swatch color={s.color} dashed={s.dashed} />{s.name}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{format(s.values[hover] || 0)}</span>
            </p>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

// ───────────────────────── Stacked / single column bars ─────────────────────────
export type BarStack = { name: string; color: string; values: number[] };

export function BarChart({
  labels, longLabels, stacks, format, height = 240, highlightMax = false,
}: {
  labels: string[]; longLabels?: string[]; stacks: BarStack[]; format: (v: number) => string; height?: number; highlightMax?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const padL = 52; const padR = 8; const padT = 10; const padB = 28;
  const iw = Math.max(10, width - padL - padR);
  const ih = height - padT - padB;
  const totals = labels.map((_, i) => stacks.reduce((s, st) => s + (st.values[i] || 0), 0));
  const ticks = niceTicks(Math.max(1, ...totals));
  const top = ticks[ticks.length - 1];
  const band = iw / Math.max(1, n);
  const bw = Math.max(2, Math.min(44, band * 0.62));
  const y = (v: number) => padT + ih - (v / top) * ih;
  const every = labelEvery(n, iw, 56);
  const maxIdx = totals.indexOf(Math.max(...totals));

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={stacks.map((s) => s.name).join(', ')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = padL + band * i + band / 2;
            let acc = 0;
            const segs = stacks.map((st) => {
              const v = st.values[i] || 0;
              const y0 = y(acc); acc += v; const y1 = y(acc);
              return { v, y0, y1, color: st.color };
            }).filter((s) => s.v > 0);
            const dim = hover != null && hover !== i;
            return (
              <g key={i} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity .15s' }}>
                {segs.map((s, si) => {
                  const h = Math.max(1, s.y0 - s.y1 - (si > 0 ? 2 : 0));
                  const isTop = si === segs.length - 1;
                  const r = isTop ? Math.min(4, bw / 2, h) : 0;
                  const x0 = cx - bw / 2; const yTop = s.y1; const yBot = yTop + h;
                  const d = r > 0
                    ? `M${x0},${yBot}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + bw - r}Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r}V${yBot}Z`
                    : `M${x0},${yBot}V${yTop}H${x0 + bw}V${yBot}Z`;
                  return <path key={si} d={d} fill={s.color} />;
                })}
                {highlightMax && i === maxIdx && totals[i] > 0 && (
                  <text x={cx} y={y(totals[i]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">{format(totals[i])}</text>
                )}
                {(i % every === 0) && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>{l}</text>
                )}
                <rect x={padL + band * i} y={padT} width={band} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && width > 0 && (
        <Tooltip x={padL + band * hover + band / 2} y={padT} width={width}>
          <p className="mb-1.5 font-semibold text-slate-900">{(longLabels || labels)[hover]}</p>
          {stacks.length > 1 && stacks.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Swatch color={s.color} />{s.name}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{format(s.values[hover] || 0)}</span>
            </p>
          ))}
          <p className={`flex items-center justify-between gap-3 ${stacks.length > 1 ? 'mt-1 border-t border-slate-100 pt-1' : ''} text-slate-600`}>
            <span>{stacks.length > 1 ? 'Total' : stacks[0]?.name}</span>
            <span className="font-bold text-slate-900 tabular-nums">{format(totals[hover])}</span>
          </p>
        </Tooltip>
      )}
    </div>
  );
}

// ───────────────────────── Donut ─────────────────────────
export function Donut({
  slices, format, centerLabel, size = 180, colors,
}: {
  slices: { key: string; label: string; value: number }[]; format: (v: number) => string; centerLabel: string; size?: number; colors?: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const pal = colors || SERIES;
  const r = size / 2; const inner = r * 0.64;
  const colorOf = (i: number, key: string) => (key === '__other' ? MUTED : pal[i % pal.length]);
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = total ? s.value / total : 0;
    const a1 = a0 + frac * Math.PI * 2;
    const gap = slices.length > 1 ? Math.min(0.02, frac * Math.PI) : 0;
    const s0 = a0 + gap / 2; const s1 = a1 - gap / 2;
    const large = s1 - s0 > Math.PI ? 1 : 0;
    const R = hover === i ? r : r - 3;
    const p = (rad: number, ang: number) => `${r + rad * Math.cos(ang)},${r + rad * Math.sin(ang)}`;
    const d = frac >= 0.9999
      ? `M${p(R, 0)}A${R},${R} 0 1 1 ${p(R, Math.PI)}A${R},${R} 0 1 1 ${p(R, 0)}M${p(inner, 0)}A${inner},${inner} 0 1 0 ${p(inner, Math.PI)}A${inner},${inner} 0 1 0 ${p(inner, 0)}Z`
      : `M${p(R, s0)}A${R},${R} 0 ${large} 1 ${p(R, s1)}L${p(inner, s1)}A${inner},${inner} 0 ${large} 0 ${p(inner, s0)}Z`;
    a0 = a1;
    return { d, color: colorOf(i, s.key), frac };
  });
  const active = hover != null ? slices[hover] : null;

  if (!total) return <Empty height={size} />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={centerLabel} fillRule="evenodd">
          {arcs.map((a, i) => (
            <path key={i} d={a.d} fill={a.color} opacity={hover != null && hover !== i ? 0.4 : 1} style={{ transition: 'opacity .15s' }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{active ? active.label : centerLabel}</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{format(active ? active.value : total)}</span>
          {active && <span className="text-[11px] font-semibold text-slate-500">{((active.value / total) * 100).toFixed(1)}%</span>}
        </div>
      </div>
      <ul className="min-w-[170px] flex-1 space-y-1.5 text-xs">
        {slices.map((s, i) => (
          <li key={s.key} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors ${hover === i ? 'bg-slate-100' : ''}`}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="inline-flex min-w-0 items-center gap-2 text-slate-600"><Swatch color={colorOf(i, s.key)} /><span className="truncate">{s.label}</span></span>
            <span className="shrink-0 tabular-nums"><span className="font-semibold text-slate-900">{format(s.value)}</span><span className="ml-1.5 text-slate-400">{((s.value / total) * 100).toFixed(0)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── Horizontal bar list (ranking) ─────────────────────────
export function HBarList({
  rows, format, color = SERIES[0], max: maxRows = 8, onSelect, subFormat,
}: {
  rows: { key: string; label: string; value: number; extra?: number }[]; format: (v: number) => string; color?: string; max?: number;
  onSelect?: (key: string) => void; subFormat?: (r: { value: number; extra?: number }) => string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, maxRows);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty height={160} />;
  return (
    <div>
      <ul className="space-y-2">
        {shown.map((r, i) => {
          const Inner = (
            <>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-slate-700"><span className="mr-1.5 text-slate-400 tabular-nums">{i + 1}.</span>{r.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900">{format(r.value)}</span>
                  {subFormat && <span className="ml-1.5 text-slate-400">{subFormat(r)}</span>}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
              </div>
            </>
          );
          return (
            <li key={r.key}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(r.key)} className="block w-full rounded-lg px-1 py-0.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">{Inner}</button>
                : <div className="px-1 py-0.5">{Inner}</div>}
            </li>
          );
        })}
      </ul>
      {rows.length > maxRows && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-semibold text-purple-700 hover:text-purple-800">
          {all ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

// ───────────────────────── Heatmap (day × hour) ─────────────────────────
export function Heatmap({ grid, rowLabels, colLabel, unit }: { grid: number[][]; rowLabels: string[]; colLabel: (c: number) => string; unit: string }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const max = Math.max(0, ...grid.flat());
  const shade = (v: number) => (v <= 0 ? '#f4f4f1' : SEQ[Math.min(SEQ.length - 1, 2 + Math.floor((v / max) * (SEQ.length - 3)))]);
  const cols = grid[0]?.length || 0;
  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `34px repeat(${cols}, minmax(0, 1fr))` }}>
            {grid.map((row, ri) => (
              <div key={ri} className="contents">
                <div className="flex items-center text-[11px] font-medium text-slate-400">{rowLabels[ri]}</div>
                {row.map((v, ci) => (
                  <div key={ci}
                    className={`aspect-square rounded-[4px] transition-transform ${hover && hover[0] === ri && hover[1] === ci ? 'scale-125 ring-2 ring-slate-900/70 z-10' : ''}`}
                    style={{ background: shade(v) }}
                    onPointerEnter={() => setHover([ri, ci])} onPointerLeave={() => setHover(null)}
                    title={`${rowLabels[ri]} ${colLabel(ci)} — ${v} ${unit}`} />
                ))}
              </div>
            ))}
            <div />
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="pt-1 text-center text-[10px] text-slate-400">{c % 3 === 0 ? colLabel(c) : ''}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="min-h-[16px]">{hover ? <><b className="text-slate-900">{grid[hover[0]][hover[1]]}</b> {unit} · {rowLabels[hover[0]]} {colLabel(hover[1])}–{colLabel((hover[1] + 1) % 24)}</> : 'Hover a cell for detail · times in IST'}</span>
        <span className="inline-flex items-center gap-1">Less
          {[0, 3, 6, 9, 12].map((i) => <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: i === 0 ? '#f4f4f1' : SEQ[i] }} />)}
          More</span>
      </div>
    </div>
  );
}

// ───────────────────────── Funnel ─────────────────────────
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value || 0;
  const ramp = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#86b6ef'];
  if (!first) return <Empty height={220} text="No sign-ups in this range" />;
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const w = first ? Math.max(2, (s.value / first) * 100) : 0;
        const prev = i > 0 ? steps[i - 1].value : 0;
        const conv = i > 0 && prev > 0 ? s.value / prev : null;
        return (
          <li key={s.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 sm:grid-cols-[130px_1fr_auto]">
            <span className="text-xs font-medium text-slate-600">{s.label}</span>
            <div className="relative h-8 overflow-hidden rounded-lg bg-slate-100">
              <div className="flex h-full items-center rounded-lg px-2.5 text-xs font-bold text-white transition-[width] duration-700 ease-out" style={{ width: `${w}%`, background: ramp[i % ramp.length] }}>
                {w > 14 && <span className="tabular-nums drop-shadow-sm">{s.value.toLocaleString('en-IN')}</span>}
              </div>
              {w <= 14 && <span className="absolute left-[calc(var(--w)+8px)] top-1/2 -translate-y-1/2 text-xs font-bold text-slate-700 tabular-nums" style={{ ['--w' as string]: `${w}%` }}>{s.value.toLocaleString('en-IN')}</span>}
            </div>
            <span className="w-16 text-right text-[11px] tabular-nums">
              <span className="block font-semibold text-slate-900">{((s.value / first) * 100).toFixed(1)}%</span>
              {conv != null && <span className={conv >= 0.5 ? 'text-emerald-700' : 'text-slate-400'}>↳ {(conv * 100).toFixed(0)}%</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────── Sparkline ─────────────────────────
export function Sparkline({ values, color = SERIES[0], height = 36 }: { values: number[]; color?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = values.length;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [n <= 1 ? width / 2 : (i / (n - 1)) * width, height - 3 - (v / max) * (height - 6)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const id = `sp-${color.slice(1)}`;
  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && n > 1 && (
        <svg width={width} height={height} aria-hidden>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={pts[n - 1][0]} cy={pts[n - 1][1]} r={2.5} fill={color} />
        </svg>
      )}
    </div>
  );
}

// ───────────────────────── Ring gauge ─────────────────────────
export function Gauge({ value, label, color = SERIES[2], size = 92 }: { value: number; label: string; color?: string; size?: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = size / 2 - 7; const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f3" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray .8s ease-out' }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-slate-900 tabular-nums">{Math.round(v * 100)}%</span>
      </div>
      <span className="text-center text-[11px] font-medium text-slate-500">{label}</span>
    </div>
  );
}
