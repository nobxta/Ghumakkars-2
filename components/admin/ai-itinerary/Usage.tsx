'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { BarChart, HBarList, TimeChart, Empty, SERIES } from '@/components/admin/analytics/charts';
import { fmtTokens } from '@/lib/ai-itinerary/types';
import { api, fmtDate } from './api';
import { useStudio } from './StudioApp';
import { iconBtn } from './ui';

interface UsageData {
  days: number;
  totals: { requests: number; success: number; failed: number; unreported: number; input: number; output: number; cached: number | null; cachedReportedRequests: number; raw: number; weighted: number; avgLatencyMs: number | null };
  periods: { today: number; week: number; month: number };
  byDay: { date: string; weighted: number; raw: number; requests: number; failed: number }[];
  byModel: { model: string; modelId: string; weighted: number; raw: number; requests: number; failed: number }[];
  topProjects: { id: string; title: string; weighted: number; raw: number; requests: number }[];
  avgPerItinerary: number | null;
  generatedCount: number;
  recent: { id: string; kind: string; model_key: string | null; model_id: string; success: boolean; usage_reported: boolean; input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null; weighted_tokens: number | null; latency_ms: number | null; error_code: string | null; error_message: string | null; created_at: string; project_title: string | null; project_id: string | null }[];
  balance: { allowance: number; usedSinceSet: number; estimatedRemaining: number; allowanceSetAt: string | null; providerConfirmed: number | null };
}

const nf = (n: number) => Math.round(n).toLocaleString('en-IN');

export default function Usage() {
  const { openProject, settings, goTab } = useStudio();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<UsageData>(`/usage?days=${days}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [days]);
  useEffect(() => { setData(null); load(); }, [load]);

  const modelName = (k: string) => settings?.settings.pricing.models.find((m) => m.key === k)?.displayName || k;

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button className="font-semibold underline" onClick={load}>Retry</button></p>;
  if (!data) return <div className="space-y-3" aria-busy="true"><div className="sk sk-soft h-24 rounded-2xl" /><div className="sk sk-soft h-72 rounded-2xl" /></div>;

  const t = data.totals;
  const b = data.balance;
  const pct = b.allowance > 0 ? Math.max(0, Math.min(100, (b.usedSinceSet / b.allowance) * 100)) : 0;
  const labels = data.byDay.map((d) => new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`h-8 rounded-[10px] px-3 text-[13px] font-semibold ${days === d ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}>{d} days</button>
          ))}
        </div>
        <button type="button" className={iconBtn} onClick={load} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* Compact summary */}
      <section className="grid divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <Stat label="Weighted tokens" value={fmtTokens(t.weighted)} sub={`Today ${fmtTokens(data.periods.today)} · 7d ${fmtTokens(data.periods.week)} · 30d ${fmtTokens(data.periods.month)}`} hint="Locally calculated: (fresh input + cached × cached-rate + output) × model multiplier × priority." />
        <Stat label="Raw tokens (from API)" value={fmtTokens(t.raw)} sub={`${fmtTokens(t.input)} in · ${fmtTokens(t.output)} out · ${t.cached == null ? 'cached: not reported' : `${fmtTokens(t.cached)} cached`}`} hint="Exactly what the provider returned in each response's usage field." />
        <Stat label="Requests" value={nf(t.requests)} sub={`${nf(t.success)} ok · ${nf(t.failed)} failed${t.unreported ? ` · ${t.unreported} without usage` : ''}${t.avgLatencyMs ? ` · avg ${(t.avgLatencyMs / 1000).toFixed(1)}s` : ''}`} />
        <Stat label="Avg per generated itinerary" value={data.avgPerItinerary == null ? '—' : fmtTokens(data.avgPerItinerary)} sub={`Weighted, across ${data.generatedCount} itinerar${data.generatedCount === 1 ? 'y' : 'ies'} with a PDF`} />
      </section>

      {/* Balance — clearly labelled as an estimate */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-slate-900">Estimated remaining allowance</p>
            <p className="text-[12px] text-slate-500">Local estimate: configured allowance minus weighted usage recorded since {b.allowanceSetAt ? fmtDate(b.allowanceSetAt) : 'the first request'}.</p>
          </div>
          <button type="button" onClick={() => goTab('settings', { s: 'ai' })} className="text-[12.5px] font-semibold text-purple-700 hover:underline">Adjust allowance</button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Allowance used">
          <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-purple-600'}`} style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-3 grid gap-3 text-[12.5px] sm:grid-cols-4">
          <div><dt className="text-slate-500">Configured allowance</dt><dd className="font-semibold tabular-nums text-slate-900">{nf(b.allowance)}</dd></div>
          <div><dt className="text-slate-500">Weighted used (local)</dt><dd className="font-semibold tabular-nums text-slate-900">{nf(b.usedSinceSet)}</dd></div>
          <div><dt className="text-slate-500">Estimated remaining</dt><dd className={`font-semibold tabular-nums ${b.estimatedRemaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>{nf(b.estimatedRemaining)}</dd></div>
          <div><dt className="text-slate-500">Provider-confirmed balance</dt><dd className="flex items-center gap-1 font-semibold text-slate-500"><Info className="h-3.5 w-3.5" />Unavailable</dd></div>
        </dl>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-slate-900">Weighted tokens over time</p>
          {data.byDay.some((d) => d.weighted > 0)
            ? <TimeChart labels={labels} series={[{ name: 'Weighted', color: SERIES[6], values: data.byDay.map((d) => d.weighted), area: true }]} format={(v) => fmtTokens(v)} yFormat={(v) => fmtTokens(v)} height={230} />
            : <Empty height={230} text="No usage in this range" />}
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-slate-900">By model</p>
          {data.byModel.length ? (
            <HBarList rows={data.byModel.map((m) => ({ key: m.model, label: modelName(m.model), value: m.weighted, extra: m.requests }))} format={(v) => fmtTokens(v)} subFormat={(r) => `${r.extra} requests`} color={SERIES[6]} />
          ) : <Empty height={200} text="No requests yet" />}
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-slate-900">Requests per day</p>
          {data.byDay.some((d) => d.requests > 0)
            ? <BarChart labels={labels} stacks={[{ name: 'Succeeded', color: SERIES[2], values: data.byDay.map((d) => d.requests - d.failed) }, { name: 'Failed', color: SERIES[7], values: data.byDay.map((d) => d.failed) }]} format={(v) => nf(v)} height={200} />
            : <Empty height={200} text="No requests in this range" />}
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <p className="mb-2 text-[13px] font-bold text-slate-900">Most expensive itineraries</p>
          {data.topProjects.length ? (
            <HBarList rows={data.topProjects.map((p) => ({ key: p.id, label: p.title, value: p.weighted, extra: p.requests }))} format={(v) => fmtTokens(v)} subFormat={(r) => `${r.extra} requests`} color={SERIES[0]} onSelect={(id) => openProject(id)} />
          ) : <Empty height={200} text="No itinerary usage yet" />}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <p className="px-4 pb-2 pt-4 text-[13px] font-bold text-slate-900">Recent API requests</p>
        {!data.recent.length ? <Empty height={120} text="No requests yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead className="border-y border-slate-100 bg-slate-50/50 text-[10.5px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-2 font-semibold">Time</th><th className="px-2 font-semibold">Itinerary</th><th className="px-2 font-semibold">Kind</th><th className="px-2 font-semibold">Model</th><th className="px-2 text-right font-semibold">In</th><th className="px-2 text-right font-semibold">Out</th><th className="px-2 text-right font-semibold">Cached</th><th className="px-2 text-right font-semibold">Weighted</th><th className="px-2 text-right font-semibold">Time</th><th className="px-4 font-semibold">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{fmtDate(r.created_at, true)}</td>
                    <td className="max-w-[200px] truncate px-2">{r.project_id ? <button className="truncate text-slate-700 hover:text-purple-700" onClick={() => openProject(r.project_id!)}>{r.project_title || '—'}</button> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-2 capitalize text-slate-600">{r.kind}</td>
                    <td className="px-2 font-mono text-[11.5px] text-slate-600">{r.model_id}</td>
                    <td className="px-2 text-right tabular-nums">{r.usage_reported ? nf(r.input_tokens || 0) : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{r.usage_reported ? nf(r.output_tokens || 0) : '—'}</td>
                    <td className="px-2 text-right tabular-nums text-slate-500">{r.cached_tokens == null ? 'n/a' : nf(r.cached_tokens)}</td>
                    <td className="px-2 text-right font-semibold tabular-nums">{r.weighted_tokens == null ? '—' : nf(Number(r.weighted_tokens))}</td>
                    <td className="px-2 text-right tabular-nums text-slate-500">{r.latency_ms ? `${(r.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="px-4">
                      {r.success
                        ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />OK{!r.usage_reported && <span className="text-slate-400"> · no usage</span>}</span>
                        : <span className="inline-flex max-w-[220px] items-center gap-1 truncate text-red-600" title={r.error_message || ''}><XCircle className="h-3.5 w-3.5 flex-shrink-0" />{r.error_code || 'error'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <div className="px-4 py-3.5" title={hint}>
      <p className="flex items-center gap-1 text-[12px] font-medium text-slate-500">{label}{hint && <Info className="h-3 w-3 text-slate-300" />}</p>
      <p className="mt-0.5 text-[22px] font-bold tabular-nums leading-tight text-slate-950">{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}
