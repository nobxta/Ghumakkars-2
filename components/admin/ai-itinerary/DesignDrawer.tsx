'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Dices, Loader2, RotateCcw } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import {
  COVERS, DAY_STYLES, FONT_PAIRS, MOODS, MOTIFS, PALETTES, describeDesign, newSeed, resolveDesign,
  type DesignPrefs, type DesignSpec,
} from '@/lib/ai-itinerary/design';
import { SECTION_LABELS, type ProjectRow, type ReferenceRow, type SectionKey, type ThemeOptions } from '@/lib/ai-itinerary/types';
import { api } from './api';
import { Drawer, smallPrimary, smallSecondary } from './ui';

/** Mini visual of a resolved design (palette + cover composition). */
export function DesignSwatch({ spec, active }: { spec: DesignSpec; active?: boolean }) {
  const p = spec.palette;
  const c = spec.cover;
  const photo = `linear-gradient(160deg, ${p.primary}AA, ${p.dark})`;
  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-lg border ${active ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200'}`} style={{ background: p.paper }} aria-hidden>
      {c === 'hero' && <div className="absolute inset-0" style={{ background: photo }} />}
      {c === 'split' && <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: photo }} />}
      {c === 'arch' && <div className="absolute inset-0" style={{ background: p.tint }}><div className="absolute left-[22%] right-[22%] top-[14%] h-[42%] rounded-t-full" style={{ background: photo }} /></div>}
      {c === 'collage' && <div className="absolute inset-x-0 top-0 grid h-1/2 grid-cols-[62%_38%] gap-px"><div style={{ background: photo }} /><div className="grid grid-rows-2 gap-px"><div style={{ background: p.primary }} /><div style={{ background: p.accent }} /></div></div>}
      {c === 'band' && <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: p.primary }} />}
      {c === 'frame' && <div className="absolute inset-[7%] border" style={{ borderColor: p.primary }} />}
      {c === 'type' && <div className="absolute right-[8%] top-[12%] text-[28px] font-black leading-none" style={{ color: p.tint }}>03</div>}
      {c === 'diagonal' && <div className="absolute inset-x-0 top-0 h-[56%]" style={{ background: p.dark, clipPath: 'polygon(0 0,100% 0,100% 78%,0 100%)' }} />}
      <div className="absolute bottom-[12%] left-[10%] right-[12%] space-y-1">
        <div className="h-1.5 w-4/5 rounded-full" style={{ background: c === 'hero' ? '#fff' : p.ink, opacity: 0.85 }} />
        <div className="h-1 w-1/2 rounded-full" style={{ background: p.accent }} />
      </div>
      {active && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-white"><Check className="h-3 w-3" /></span>}
    </div>
  );
}

const chip = (on: boolean) => `h-8 rounded-lg border px-2.5 text-[12.5px] font-semibold transition ${on ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`;

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-semibold">
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`h-7 flex-1 rounded-md px-2 transition ${value === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Design controls. Applying re-renders the PDF from the same content — no AI tokens. */
export default function DesignDrawer({
  open, onClose, project, references, onApply,
}: {
  open: boolean; onClose: () => void; project: ProjectRow; references: ReferenceRow[];
  onApply: (opts: ThemeOptions) => Promise<void>;
}) {
  const { toast } = useAdminLive();
  const [o, setO] = useState<ThemeOptions>(project.theme_options || {});
  const [busy, setBusy] = useState(false);
  const [tplName, setTplName] = useState('');
  useEffect(() => { if (open) setO(project.theme_options || {}); }, [open, project.theme_options]);

  const photos = references.filter((r) => r.kind === 'image' && r.status === 'ready' && r.image_role !== 'exclude');
  const colourSource = [...references].reverse().find((r) => r.meta?.palette && (r.purpose === 'design' || r.kind === 'image'));
  const d: DesignPrefs = o.design || {};
  const spec = useMemo(() => resolveDesign(d, { photoCount: photos.length, dayCount: project.itinerary?.days.length || 3, legacyTheme: project.id }), [d, photos.length, project.itinerary?.days.length, project.id]);
  const setD = (patch: Partial<DesignPrefs>) => setO((x) => ({ ...x, design: { ...(x.design || {}), ...patch } }));
  const set = (patch: Partial<ThemeOptions>) => setO((x) => ({ ...x, ...patch }));
  const sections = o.sections || {};

  const saveTemplate = async () => {
    if (!tplName.trim()) return;
    try {
      await api('/templates', { method: 'POST', json: { name: tplName, theme: project.theme || 'signature', themeOptions: o } });
      toast('Design saved to Templates');
      setTplName('');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const apply = async (next: ThemeOptions) => { setBusy(true); await onApply(next); setBusy(false); };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Design"
      subtitle="Every PDF gets its own layout. Changes re-render from the same content — no AI tokens."
      width="sm:max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={smallSecondary} onClick={() => setO((x) => ({ ...x, design: { seed: x.design?.seed } }))}><RotateCcw className="h-3.5 w-3.5" /> Let the designer choose</button>
          <button type="button" className={smallPrimary} disabled={busy} onClick={() => apply(o)}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {project.itinerary ? 'Apply & re-render' : 'Save'}
          </button>
        </div>
      }
    >
      {/* Current design + one-click shuffle */}
      <div className="flex gap-4 rounded-2xl border border-slate-200 p-3">
        <div className="w-24 flex-shrink-0"><DesignSwatch spec={spec} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900">Current design</p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{describeDesign(spec)}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-400">Day pages: {Array.from(new Set(spec.dayStyles)).map((x) => DAY_STYLES.find((s) => s.key === x)?.label).join(', ')} · {photos.length} photo{photos.length === 1 ? '' : 's'}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => { const next = { ...o, design: { ...d, seed: newSeed(), cover: undefined, motif: undefined, dayStyle: undefined } }; setO(next); if (project.itinerary) apply(next); }}
            className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[12.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Dices className="h-3.5 w-3.5" />} Shuffle design
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <Row label="Mood">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(!d.mood)} onClick={() => setD({ mood: undefined })}>Auto</button>
            {MOODS.map((m) => <button key={m.key} type="button" title={m.hint} className={chip(d.mood === m.key)} onClick={() => setD({ mood: m.key, fonts: undefined, palette: d.palette === 'extracted' ? 'extracted' : undefined })}>{m.label}</button>)}
          </div>
        </Row>

        <Row label="Fonts">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className={`${chip(!d.fonts)} text-left`} onClick={() => setD({ fonts: undefined })}>Auto <span className="font-normal text-slate-400">({spec.fonts.name})</span></button>
            {FONT_PAIRS.map((f) => <button key={f.key} type="button" className={`${chip(d.fonts === f.key)} truncate text-left`} onClick={() => setD({ fonts: f.key })}>{f.name}</button>)}
          </div>
        </Row>

        <Row label="Colours">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            <button type="button" className={`${chip(!d.palette)} text-left`} onClick={() => setD({ palette: undefined })}>Auto</button>
            {colourSource?.meta?.palette && (
              <button type="button" className={`${chip(d.palette === 'extracted')} flex items-center gap-1.5 text-left`} onClick={() => setD({ palette: 'extracted', extracted: { ...colourSource.meta!.palette!, source: colourSource.filename } })} title={`From ${colourSource.filename}`}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: colourSource.meta.palette.primary }} />
                <span className="truncate">From your {colourSource.kind === 'image' ? 'photo' : 'reference'}</span>
              </button>
            )}
            {PALETTES.map((p) => (
              <button key={p.key} type="button" className={`${chip(d.palette === p.key)} flex items-center gap-1.5 text-left`} onClick={() => setD({ palette: p.key })}>
                <span className="flex"><span className="h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: p.primary }} /><span className="-ml-1 h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: p.accent }} /></span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
            <label className="flex items-center gap-1.5">Custom main colour
              <input type="color" value={o.primary || spec.palette.primary} onChange={(e) => set({ primary: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
            </label>
            {o.primary && <button type="button" className="font-semibold text-slate-400 hover:text-slate-700" onClick={() => set({ primary: undefined })}>Reset</button>}
          </div>
        </Row>

        <Row label="Cover" hint={photos.length ? undefined : 'Photo covers unlock when you attach photos (paperclip → Photos for the PDF).'}>
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" className={chip(!d.cover)} onClick={() => setD({ cover: undefined })}>Auto</button>
            {COVERS.map((c) => {
              const locked = c.needsPhoto && (photos.length === 0 || (c.key === 'collage' && photos.length < 3));
              return <button key={c.key} type="button" disabled={locked} className={`${chip(d.cover === c.key)} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setD({ cover: c.key })}>{c.label}</button>;
            })}
          </div>
        </Row>

        <Row label="Day pages">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(!d.dayStyle || d.dayStyle === 'mixed')} onClick={() => setD({ dayStyle: undefined })}>Mixed (varies by day)</button>
            {DAY_STYLES.map((s) => <button key={s.key} type="button" className={chip(d.dayStyle === s.key)} onClick={() => setD({ dayStyle: s.key })}>{s.label}</button>)}
          </div>
        </Row>

        <Row label="Decoration">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(!d.motif)} onClick={() => setD({ motif: undefined })}>Auto</button>
            {MOTIFS.map((m) => <button key={m.key} type="button" className={chip(d.motif === m.key)} onClick={() => setD({ motif: m.key })}>{m.label}</button>)}
          </div>
        </Row>

        <details className="group rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-slate-700">Page setup & sections</summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Row label="Cover page"><Seg value={o.cover || 'full'} options={[['full', 'Full'], ['compact', 'Header'], ['none', 'None']]} onChange={(v) => set({ cover: v })} /></Row>
              <Row label="Density"><Seg value={o.density || 'comfortable'} options={[['comfortable', 'Airy'], ['compact', 'Compact']]} onChange={(v) => set({ density: v })} /></Row>
              <Row label="Paper"><Seg value={o.paper || 'a4'} options={[['a4', 'A4'], ['letter', 'Letter']]} onChange={(v) => set({ paper: v })} /></Row>
              <Row label="Orientation"><Seg value={o.orientation || 'portrait'} options={[['portrait', 'Portrait'], ['landscape', 'Landscape']]} onChange={(v) => set({ orientation: v })} /></Row>
              <Row label="Logo"><Seg value={o.logo === 'none' ? 'none' : 'show'} options={[['show', 'Show'], ['none', 'Hide']]} onChange={(v) => set({ logo: v === 'none' ? 'none' : 'left' })} /></Row>
              <Row label="Photos"><Seg value={o.images || 'cover'} options={[['cover', 'Use'], ['none', 'None']]} onChange={(v) => set({ images: v })} /></Row>
              <Row label="Header"><Seg value={o.header === false ? 'off' : 'on'} options={[['on', 'Show'], ['off', 'Hide']]} onChange={(v) => set({ header: v === 'on' })} /></Row>
              <Row label="Footer"><Seg value={o.footer === false ? 'off' : 'on'} options={[['on', 'Show'], ['off', 'Hide']]} onChange={(v) => set({ footer: v === 'on' })} /></Row>
            </div>
            <Row label="Footer text" hint="Defaults to contact person · phone · website.">
              <input value={o.footerText || ''} maxLength={160} onChange={(e) => set({ footerText: e.target.value || undefined })} className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-purple-400" />
            </Row>
            <Row label="Sections">
              <div className="grid grid-cols-2 gap-1">
                {(Object.keys(SECTION_LABELS) as SectionKey[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" className="accent-purple-600" checked={sections[k] !== false} onChange={(e) => set({ sections: { ...sections, [k]: e.target.checked } })} />
                    {k === 'contact' ? 'Back cover with contact details' : SECTION_LABELS[k]}
                  </label>
                ))}
              </div>
            </Row>
          </div>
        </details>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-[12.5px] font-semibold text-slate-700">Save this design for reuse</p>
          <div className="mt-2 flex gap-2">
            <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Student trips — playful" maxLength={80} className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-purple-400" />
            <button type="button" className={smallSecondary} disabled={!tplName.trim()} onClick={saveTemplate}>Save</button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
