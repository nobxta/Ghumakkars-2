'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { TRIP_FIELDS, canGenerate, type ProjectRow, type TripDetails, type TripFieldKey } from '@/lib/ai-itinerary/types';
import { Drawer, smallPrimary } from './ui';

type Draft = Partial<Record<TripFieldKey, any>>;

/**
 * Inspect and correct the structured trip state. Anything edited here is
 * "locked": the AI can no longer silently overwrite it.
 */
export default function TripDetailsDrawer({
  open, onClose, project, onPatch,
}: {
  open: boolean; onClose: () => void; project: ProjectRow; onPatch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const td = project.trip_details || {};
  const locked = project.locked_fields || [];

  useEffect(() => { if (open) setDraft({}); }, [open, project.id]);

  const val = (k: TripFieldKey) => (k in draft ? draft[k] : (td as any)[k]);
  const dirty = Object.keys(draft).length > 0;
  const groups = useMemo(() => {
    const g = new Map<string, typeof TRIP_FIELDS>();
    for (const f of TRIP_FIELDS) {
      const has = val(f.key) != null && val(f.key) !== '' && !(Array.isArray(val(f.key)) && !val(f.key).length);
      if (!showEmpty && !has && !(f.key in draft)) continue;
      if (!g.has(f.group)) g.set(f.group, []);
      g.get(f.group)!.push(f);
    }
    return Array.from(g.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [td, draft, showEmpty]);

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (k === 'durationDays' || k === 'durationNights') body[k] = v === '' ? null : Number(v);
      else body[k] = v === '' ? null : v;
    }
    const ok = await onPatch({ tripDetails: body, lock: true }, 'Trip details saved');
    setSaving(false);
    if (ok) setDraft({});
  };

  const missing = project.missing_fields || [];
  const ready = canGenerate({ ...td, ...draft } as TripDetails);
  const filled = Object.keys(td).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Trip details"
      subtitle={<>{filled} field{filled === 1 ? '' : 's'} captured · {ready ? 'enough to generate' : 'needs a destination and a duration or day plan'}</>}
      width="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11.5px] leading-snug text-slate-500">{dirty ? 'Unsaved changes — saved fields get locked.' : 'Edited fields are locked so the AI won’t overwrite them.'}</p>
          <button type="button" onClick={save} disabled={!dirty || saving} className={smallPrimary}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      {missing.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <p className="text-[12px] font-bold text-amber-900">Still open</p>
          <ul className="mt-1 space-y-0.5 text-[12.5px] text-amber-900">
            {missing.map((m) => <li key={m.field}>{m.essential ? '• ' : '◦ '}{m.question}</li>)}
          </ul>
        </div>
      )}
      {!groups.length && <p className="py-6 text-center text-sm text-slate-500">Nothing captured yet — tell the assistant about the trip, or add details here.</p>}
      <div className="space-y-5">
        {groups.map(([group, fields]) => (
          <section key={group}>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group}</h4>
            <div className="space-y-2.5">
              {fields.map((f) => {
                const isLocked = locked.includes(f.key);
                const v = val(f.key);
                const changed = f.key in draft;
                return (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor={`td-${f.key}`} className="text-[12.5px] font-semibold text-slate-700">
                        {f.label} {changed && <span className="ml-1 text-[10.5px] font-semibold text-amber-600">edited</span>}
                      </label>
                      {isLocked && (
                        <button type="button" onClick={() => onPatch({ unlock: f.key })} title="Unlock — let the AI update this field" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-500 hover:bg-slate-100">
                          <Lock className="h-3 w-3" /> Confirmed <Unlock className="ml-0.5 h-3 w-3 opacity-60" />
                        </button>
                      )}
                    </div>
                    {f.kind === 'days' ? (
                      <DayPlans value={v || []} onChange={(nv) => setDraft((d) => ({ ...d, dayPlans: nv }))} />
                    ) : f.kind === 'long' ? (
                      <textarea id={`td-${f.key}`} rows={2} value={v ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
                    ) : (
                      <input id={`td-${f.key}`} type={f.kind === 'number' ? 'number' : 'text'} min={0} value={v ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <button type="button" onClick={() => setShowEmpty((s) => !s)} className="mt-5 text-[12.5px] font-semibold text-purple-700 hover:underline">
        {showEmpty ? 'Hide empty fields' : 'Show all fields'}
      </button>
    </Drawer>
  );
}

function DayPlans({ value, onChange }: { value: { day: number; notes: string }[]; onChange: (v: { day: number; notes: string }[]) => void }) {
  const list = [...value].sort((a, b) => a.day - b.day);
  return (
    <div className="space-y-1.5">
      {list.map((p, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <input type="number" min={1} value={p.day} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) || 1 } : x)))} className="h-9 w-14 rounded-lg border border-slate-200 px-2 text-[13px] outline-none focus:border-purple-400" aria-label="Day number" />
          <textarea rows={1} value={p.notes} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} className="min-h-[36px] flex-1 resize-y rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-purple-400" aria-label={`Day ${p.day} notes`} />
          <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="mt-1.5 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove day ${p.day}`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, { day: (list[list.length - 1]?.day || 0) + 1, notes: '' }])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-purple-700 hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add day
      </button>
    </div>
  );
}
