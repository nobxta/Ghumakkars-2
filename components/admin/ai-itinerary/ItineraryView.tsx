'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ActivityStatus, Itinerary, ItineraryDay, ProjectRow } from '@/lib/ai-itinerary/types';
import { resolveDesign } from '@/lib/ai-itinerary/design';
import { smallPrimary, smallSecondary } from './ui';

const inp = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100';
const area = 'w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] leading-relaxed text-slate-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100';

/** Structured live preview of the itinerary JSON, with an inline editor. */
export default function ItineraryView({
  project, onSave, onDirtyChange,
}: {
  project: ProjectRow; onSave: (it: Itinerary) => Promise<boolean>; onDirtyChange: (d: boolean) => void;
}) {
  const it = project.itinerary!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Itinerary>(it);
  const [saving, setSaving] = useState(false);
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(it);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const spec = resolveDesign(project.theme_options?.design, { photoCount: 0, dayCount: it.days.length, legacyTheme: project.id });
  const accent = project.theme_options?.primary || spec.palette.primary;

  if (!editing) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-2 backdrop-blur">
          <p className="text-[12px] text-slate-500">Structured content — the source of the PDF.</p>
          <button type="button" className={smallSecondary} onClick={() => { setDraft(it); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /> Edit</button>
        </div>
        <article className="px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>{it.destination}</p>
          <h2 className="mt-1 text-xl font-bold leading-tight text-slate-950">{it.title}</h2>
          {it.subtitle && <p className="mt-1 text-[13.5px] text-slate-500">{it.subtitle}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[it.durationLabel, it.dates, it.startLocation && `From ${it.startLocation}`, it.travellers && `${it.travellers} travellers`, it.audience].filter(Boolean).map((c) => (
              <span key={c as string} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700">{c}</span>
            ))}
          </div>
          {it.overview && <p className="mt-4 text-[13.5px] leading-relaxed text-slate-700">{it.overview}</p>}
          {it.highlights.length > 0 && <Block title="Highlights" accent={accent}><List items={it.highlights} /></Block>}
          <Block title="Day by day" accent={accent}>
            <ol className="space-y-4">
              {it.days.map((d) => (
                <li key={d.day} className="flex gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ background: accent }}>
                    <span className="text-[8px] font-bold leading-none opacity-80">DAY</span>
                    <span className="text-[14px] font-bold leading-none">{d.day}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-slate-900">{d.title}</p>
                    {(d.route || d.date) && <p className="text-[12px] font-semibold" style={{ color: accent }}>{[d.date, d.route].filter(Boolean).join(' · ')}</p>}
                    {d.summary && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{d.summary}</p>}
                    <ul className="mt-1.5 space-y-1">
                      {d.activities.map((a, i) => (
                        <li key={i} className="text-[13px] leading-snug text-slate-700">
                          {a.time && <span className="mr-1.5 font-semibold text-slate-500">{a.time}</span>}
                          <span className="font-semibold text-slate-800">{a.title}</span>
                          {a.status !== 'included' && <span className={`ml-1.5 rounded px-1 text-[10px] font-bold uppercase ${a.status === 'optional' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>}
                          {a.description && <span className="block text-[12.5px] text-slate-500">{a.description}</span>}
                        </li>
                      ))}
                    </ul>
                    {(d.meals?.length || d.stay || d.transport) && (
                      <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1 text-[12px] text-slate-600">
                        {[d.meals?.length ? `Meals: ${d.meals.join(', ')}` : '', d.stay ? `Stay: ${d.stay}` : '', d.transport ? `Travel: ${d.transport}` : ''].filter(Boolean).join('  ·  ')}
                      </p>
                    )}
                    {d.notes && <p className="mt-1 text-[12px] italic text-slate-500">{d.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Block>
          {it.stays.length > 0 && (
            <Block title="Accommodation" accent={accent}>
              <ul className="space-y-1.5 text-[13px] text-slate-700">
                {it.stays.map((s, i) => (
                  <li key={i}><b>{s.location}</b>{s.name ? ` — ${s.name}` : ''}{s.category ? ` (${s.category})` : ''}{s.nights ? ` · ${s.nights} nights` : ''} {s.confirmed ? <span className="ml-1 text-[11px] font-bold text-emerald-700">CONFIRMED</span> : <span className="ml-1 text-[11px] text-slate-400">or similar</span>}</li>
                ))}
              </ul>
            </Block>
          )}
          {it.transport.length > 0 && <Block title="Transport" accent={accent}><List items={it.transport.map((x) => `${x.mode}${x.details ? ` — ${x.details}` : ''}${x.confirmed ? ' (confirmed)' : ''}`)} /></Block>}
          {(it.inclusions.length > 0 || it.exclusions.length > 0) && (
            <Block title="Inclusions & exclusions" accent={accent}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-1 text-[12px] font-bold text-emerald-700">Included</p><List items={it.inclusions} /></div>
                <div><p className="mb-1 text-[12px] font-bold text-red-700">Not included</p><List items={it.exclusions} /></div>
              </div>
            </Block>
          )}
          {(it.pricing.length > 0 || it.pricingNote) && (
            <Block title="Pricing" accent={accent}>
              <ul className="space-y-1 text-[13px] text-slate-700">{it.pricing.map((p, i) => <li key={i} className="flex justify-between gap-3"><span>{p.label}{p.basis ? ` (${p.basis})` : ''}{p.note ? <span className="block text-[12px] text-slate-500">{p.note}</span> : null}</span><b>{p.amount != null ? `₹${p.amount.toLocaleString('en-IN')}` : 'On request'}</b></li>)}</ul>
              {it.pricingNote && <p className="mt-1.5 text-[12px] italic text-slate-500">{it.pricingNote}</p>}
            </Block>
          )}
          {it.paymentTerms.length > 0 && <Block title="Payment terms" accent={accent}><List items={it.paymentTerms} /></Block>}
          {it.cancellationPolicy.length > 0 && <Block title="Cancellation policy" accent={accent}><List items={it.cancellationPolicy} /></Block>}
          {it.importantNotes.length > 0 && <Block title="Important notes" accent={accent}><List items={it.importantNotes} /></Block>}
          {it.thingsToCarry.length > 0 && <Block title="Things to carry" accent={accent}><List items={it.thingsToCarry} /></Block>}
          {it.assumptions.length > 0 && (
            <Block title="Assumptions & suggestions" accent={accent}>
              <p className="mb-1 text-[12px] text-slate-500">Not confirmed — review before sharing.</p>
              <List items={it.assumptions} />
            </Block>
          )}
        </article>
      </div>
    );
  }

  /* ── editor ── */
  const set = <K extends keyof Itinerary>(k: K, v: Itinerary[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setDay = (i: number, patch: Partial<ItineraryDay>) => set('days', draft.days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const moveDay = (i: number, dir: -1 | 1) => {
    const days = [...draft.days];
    const j = i + dir;
    if (j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    set('days', days.map((d, k) => ({ ...d, day: k + 1 })));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2">
        <p className="text-[12px] font-semibold text-slate-600">{dirty ? <span className="text-amber-700">Unsaved changes</span> : 'Editing'}</p>
        <div className="flex gap-1.5">
          <button type="button" className={smallSecondary} onClick={() => { setEditing(false); setDraft(it); }}><X className="h-3.5 w-3.5" /> Cancel</button>
          <button type="button" className={smallPrimary} disabled={!dirty || saving} onClick={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) setEditing(false); }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save draft
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Group title="Basics">
          <div className="grid gap-2 sm:grid-cols-2">
            <L label="Title"><input className={inp} value={draft.title} onChange={(e) => set('title', e.target.value)} /></L>
            <L label="Destination"><input className={inp} value={draft.destination} onChange={(e) => set('destination', e.target.value)} /></L>
            <L label="Subtitle"><input className={inp} value={draft.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></L>
            <L label="Duration"><input className={inp} value={draft.durationLabel || ''} onChange={(e) => set('durationLabel', e.target.value)} /></L>
            <L label="Dates"><input className={inp} value={draft.dates || ''} onChange={(e) => set('dates', e.target.value)} /></L>
            <L label="Travellers"><input className={inp} value={draft.travellers || ''} onChange={(e) => set('travellers', e.target.value)} /></L>
            <L label="Starts from"><input className={inp} value={draft.startLocation || ''} onChange={(e) => set('startLocation', e.target.value)} /></L>
            <L label="Ends at"><input className={inp} value={draft.endLocation || ''} onChange={(e) => set('endLocation', e.target.value)} /></L>
            <L label="Pickup"><input className={inp} value={draft.pickup || ''} onChange={(e) => set('pickup', e.target.value)} /></L>
            <L label="Drop"><input className={inp} value={draft.drop || ''} onChange={(e) => set('drop', e.target.value)} /></L>
          </div>
          <L label="Overview"><textarea rows={3} className={area} value={draft.overview || ''} onChange={(e) => set('overview', e.target.value)} /></L>
          <Lines label="Highlights" value={draft.highlights} onChange={(v) => set('highlights', v)} />
        </Group>

        <Group title="Days">
          {draft.days.map((d, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[12px] font-bold text-purple-700">Day {d.day}</span>
                <input className={`${inp} flex-1`} value={d.title} onChange={(e) => setDay(i, { title: e.target.value })} aria-label="Day title" />
                <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => moveDay(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => moveDay(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => set('days', draft.days.filter((_, j) => j !== i).map((x, k) => ({ ...x, day: k + 1 })))} aria-label="Remove day"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <L label="Route"><input className={inp} value={d.route || ''} onChange={(e) => setDay(i, { route: e.target.value })} /></L>
                <L label="Date"><input className={inp} value={d.date || ''} onChange={(e) => setDay(i, { date: e.target.value })} /></L>
                <L label="Stay"><input className={inp} value={d.stay || ''} onChange={(e) => setDay(i, { stay: e.target.value })} /></L>
                <L label="Meals (comma separated)"><input className={inp} value={(d.meals || []).join(', ')} onChange={(e) => setDay(i, { meals: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></L>
              </div>
              <L label="Summary"><textarea rows={2} className={area} value={d.summary || ''} onChange={(e) => setDay(i, { summary: e.target.value })} /></L>
              <p className="mb-1 mt-2 text-[11.5px] font-semibold text-slate-500">Activities</p>
              <div className="space-y-1.5">
                {d.activities.map((a, k) => (
                  <div key={k} className="flex flex-wrap items-start gap-1.5">
                    <input className={`${inp} w-24`} placeholder="Time" value={a.time || ''} onChange={(e) => setDay(i, { activities: d.activities.map((x, z) => (z === k ? { ...x, time: e.target.value } : x)) })} aria-label="Time" />
                    <input className={`${inp} min-w-[140px] flex-1`} placeholder="Activity" value={a.title} onChange={(e) => setDay(i, { activities: d.activities.map((x, z) => (z === k ? { ...x, title: e.target.value } : x)) })} aria-label="Activity" />
                    <select className={`${inp} w-28`} value={a.status} onChange={(e) => setDay(i, { activities: d.activities.map((x, z) => (z === k ? { ...x, status: e.target.value as ActivityStatus } : x)) })} aria-label="Status">
                      <option value="included">Included</option><option value="optional">Optional</option><option value="suggested">Suggested</option>
                    </select>
                    <button type="button" className="mt-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDay(i, { activities: d.activities.filter((_, z) => z !== k) })} aria-label="Remove activity"><Trash2 className="h-3.5 w-3.5" /></button>
                    <input className={`${inp} basis-full`} placeholder="Description (optional)" value={a.description || ''} onChange={(e) => setDay(i, { activities: d.activities.map((x, z) => (z === k ? { ...x, description: e.target.value } : x)) })} aria-label="Description" />
                  </div>
                ))}
                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-purple-700 hover:underline" onClick={() => setDay(i, { activities: [...d.activities, { title: '', status: 'included' }] })}><Plus className="h-3.5 w-3.5" /> Add activity</button>
              </div>
            </div>
          ))}
          <button type="button" className={smallSecondary} onClick={() => set('days', [...draft.days, { day: draft.days.length + 1, title: `Day ${draft.days.length + 1}`, activities: [] }])}><Plus className="h-3.5 w-3.5" /> Add day</button>
        </Group>

        <Group title="Package">
          <Lines label="Inclusions" value={draft.inclusions} onChange={(v) => set('inclusions', v)} />
          <Lines label="Exclusions" value={draft.exclusions} onChange={(v) => set('exclusions', v)} />
          <p className="text-[11.5px] font-semibold text-slate-500">Pricing</p>
          {draft.pricing.map((p, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              <input className={`${inp} min-w-[140px] flex-1`} placeholder="Label" value={p.label} onChange={(e) => set('pricing', draft.pricing.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className={`${inp} w-28`} placeholder="Amount ₹" inputMode="numeric" value={p.amount ?? ''} onChange={(e) => set('pricing', draft.pricing.map((x, j) => (j === i ? { ...x, amount: e.target.value === '' ? undefined : Number(e.target.value.replace(/[^\d.]/g, '')) } : x)))} />
              <input className={`${inp} w-28`} placeholder="Basis" value={p.basis || ''} onChange={(e) => set('pricing', draft.pricing.map((x, j) => (j === i ? { ...x, basis: e.target.value } : x)))} />
              <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => set('pricing', draft.pricing.filter((_, j) => j !== i))} aria-label="Remove price"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-purple-700 hover:underline" onClick={() => set('pricing', [...draft.pricing, { label: 'Per person' }])}><Plus className="h-3.5 w-3.5" /> Add price row</button>
          <L label="Pricing note"><input className={inp} value={draft.pricingNote || ''} onChange={(e) => set('pricingNote', e.target.value)} /></L>
        </Group>

        <Group title="Policies & notes">
          <Lines label="Payment terms" value={draft.paymentTerms} onChange={(v) => set('paymentTerms', v)} />
          <Lines label="Cancellation policy" value={draft.cancellationPolicy} onChange={(v) => set('cancellationPolicy', v)} />
          <Lines label="Important notes" value={draft.importantNotes} onChange={(v) => set('importantNotes', v)} />
          <Lines label="Things to carry" value={draft.thingsToCarry} onChange={(v) => set('thingsToCarry', v)} />
          <Lines label="Assumptions" value={draft.assumptions} onChange={(v) => set('assumptions', v)} />
        </Group>
      </div>
    </div>
  );
}

function Block({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-2 text-[14px] font-bold text-slate-900"><span className="h-3.5 w-1 rounded-full" style={{ background: accent }} />{title}</h3>
      {children}
    </section>
  );
}
function List({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-0.5 pl-5 text-[13px] leading-relaxed text-slate-700 marker:text-slate-300">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</h4>{children}</section>;
}
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[11.5px] font-semibold text-slate-500">{label}</span>{children}</label>;
}
function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <L label={`${label} (one per line)`}>
      <textarea rows={Math.min(8, Math.max(2, value.length + 1))} className={area} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)); }} />
    </L>
  );
}
