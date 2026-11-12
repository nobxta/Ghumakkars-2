'use client';

/** ₹12,34,567 — full amount (Indian grouping). */
export const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/** ₹1.42L / ₹62K / ₹1.2Cr — compact amount for tiles. Full value goes in `title`. */
export const inrShort = (n: number) => {
  const v = Math.round(n || 0);
  const a = Math.abs(v);
  const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  if (a >= 1e7) return `₹${trim((v / 1e7).toFixed(a >= 1e8 ? 0 : 2))}Cr`;
  if (a >= 1e5) return `₹${trim((v / 1e5).toFixed(a >= 1e6 ? 1 : 2))}L`;
  if (a >= 1e4) return `₹${trim((v / 1e3).toFixed(1))}K`;
  return inr(v);
};

export const fmtDay = (d?: string | null, withWeekday = false) =>
  d
    ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', {
        ...(withWeekday ? { weekday: 'short' } : {}),
        day: 'numeric',
        month: 'short',
      })
    : '—';

export const timeAgo = (iso?: string | null) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

export const daysLabel = (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n}d`);

/** Card shell — the one surface style used across the dashboard. */
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-xl border border-slate-200/80 bg-white ${className}`}>{children}</section>;
}

export function CardHeader({
  icon,
  title,
  right,
  className = '',
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 ${className}`}>
      {icon && <span className="text-slate-400">{icon}</span>}
      <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** ▲ 12% / ▼ 4% vs the previous period. `invert` for metrics where down is good. */
export function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev && !cur) return <span className="text-[11px] text-slate-400">No change</span>;
  if (!prev) return <span className="text-[11px] font-medium text-emerald-600">New this period</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="text-[11px] text-slate-400">Same as before</span>;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-[11px] font-medium ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%<span className="font-normal text-slate-400"> vs prev</span>
    </span>
  );
}

/** Tiny area sparkline. Renders nothing for fewer than 2 points. */
export function Sparkline({ values, color = '#7C3AED', height = 28 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />;
  const max = Math.max(...values, 1);
  const w = 100;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const id = `sg${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${w},${height}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`sk sk-soft rounded-md ${className}`} />;
}
