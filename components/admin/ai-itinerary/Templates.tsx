'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dices, Eye, LayoutTemplate, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { COVERS, FONT_PAIRS, MOODS, PALETTES, describeDesign, newSeed, resolveDesign, type DesignPrefs, type Mood } from '@/lib/ai-itinerary/design';
import type { ThemeOptions } from '@/lib/ai-itinerary/types';
import { BASE, api, fmtDate } from './api';
import { useStudio } from './StudioApp';
import { ConfirmDialog, EmptyState, iconBtn, smallPrimary, smallSecondary } from './ui';
import { DesignSwatch } from './DesignDrawer';
import PdfViewer from './PdfViewer';

interface Template { id: string; name: string; description: string | null; theme: string; theme_options: ThemeOptions; updated_at: string }

function summary(d?: DesignPrefs) {
  if (!d) return 'Designer’s choice';
  return [
    d.mood && MOODS.find((m) => m.key === d.mood)?.label,
    d.fonts && FONT_PAIRS.find((f) => f.key === d.fonts)?.name,
    d.palette && (d.palette === 'extracted' ? 'Photo colours' : PALETTES.find((p) => p.key === d.palette)?.name),
    d.cover && COVERS.find((c) => c.key === d.cover)?.label,
  ].filter(Boolean).join(' · ') || 'Designer’s choice';
}

export default function Templates() {
  const { settings, setSettings, openProject } = useStudio();
  const { toast } = useAdminLive();
  const [tpls, setTpls] = useState<Template[] | null>(null);
  const [preview, setPreview] = useState<{ title: string; src: string } | null>(null);
  const [del, setDel] = useState<Template | null>(null);
  const [rename, setRename] = useState<Template | null>(null);
  const [seeds, setSeeds] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try { setTpls((await api<{ templates: Template[] }>('/templates')).templates); }
    catch (e) { toast((e as Error).message, 'error'); setTpls([]); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const defaultMood = settings?.settings.pdf.defaultOptions?.design?.mood;
  const moodSpecs = useMemo(() => MOODS.map((m) => ({ m, spec: resolveDesign({ mood: m.key, seed: seeds[m.key] ?? 7 + m.key.length * 13 }, { photoCount: 0, dayCount: 4 }) })), [seeds]);

  const setDefault = async (mood: Mood | undefined) => {
    if (!settings) return;
    try {
      const s = settings.settings;
      const next = { ...s, pdf: { ...s.pdf, defaultOptions: { ...s.pdf.defaultOptions, design: { ...(s.pdf.defaultOptions.design || {}), mood } } } };
      setSettings(await api('/settings', { method: 'PUT', json: { settings: next } }));
      toast(mood ? `New itineraries start in the ${MOODS.find((m) => m.key === mood)?.label} mood` : 'New itineraries let the designer choose');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const startWith = async (themeOptions: ThemeOptions | null, templateId?: string) => {
    try {
      const r = await api<{ project: { id: string } }>('/projects', { method: 'POST', json: templateId ? { templateId } : { themeOptions } });
      openProject(r.project.id);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const previewSrc = (o: ThemeOptions) => `${BASE}/templates/preview?options=${encodeURIComponent(JSON.stringify(o))}`;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h2 className="text-[15px] font-bold text-slate-900">Design moods</h2>
          <p className="text-[13px] text-slate-500">There are no fixed themes — each itinerary gets its own layout. A mood steers the fonts, colours and compositions; the AI picks one that suits the trip unless you choose.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {moodSpecs.map(({ m, spec }) => (
            <li key={m.key} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3">
              <button type="button" className="mx-auto w-full max-w-[140px]" onClick={() => setPreview({ title: `${m.label} mood`, src: previewSrc({ design: { mood: m.key, seed: spec.seed } }) })} aria-label={`Preview ${m.label}`}>
                <DesignSwatch spec={spec} />
              </button>
              <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-bold text-slate-900">
                {m.label}
                {defaultMood === m.key && <span className="rounded bg-purple-50 px-1.5 text-[10px] font-bold text-purple-700">DEFAULT</span>}
              </p>
              <p className="mt-0.5 flex-1 text-[12px] leading-snug text-slate-500">{m.hint}</p>
              <p className="mt-1 truncate text-[11px] text-slate-400" title={describeDesign(spec)}>{spec.fonts.name}</p>
              <div className="mt-2.5 flex items-center gap-0.5">
                <button type="button" className={`${smallSecondary} flex-1 justify-center px-2`} onClick={() => startWith({ design: { mood: m.key } })}><Plus className="h-3.5 w-3.5" /> Use</button>
                <button type="button" className={iconBtn} title="Preview a sample layout" onClick={() => setPreview({ title: `${m.label} mood`, src: previewSrc({ design: { mood: m.key, seed: spec.seed } }) })}><Eye className="h-4 w-4" /></button>
                <button type="button" className={iconBtn} title="Show another variation" onClick={() => setSeeds((s) => ({ ...s, [m.key]: newSeed() }))}><Dices className="h-4 w-4" /></button>
                <button type="button" className={iconBtn} title={defaultMood === m.key ? 'Remove as default' : 'Default for new itineraries'} onClick={() => setDefault(defaultMood === m.key ? undefined : m.key)}><Star className={`h-4 w-4 ${defaultMood === m.key ? 'fill-amber-400 text-amber-500' : ''}`} /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[15px] font-bold text-slate-900">Saved designs</h2>
        <p className="mb-3 text-[13px] text-slate-500">Designs you liked — save one from any itinerary via Design → “Save this design for reuse”.</p>
        {tpls === null ? <div className="sk sk-soft h-20 rounded-2xl" /> : !tpls.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white"><EmptyState icon={LayoutTemplate} title="No saved designs yet" body="When a PDF looks just right, save its design and start new itineraries from it." /></div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tpls.map((t) => {
              const spec = resolveDesign(t.theme_options?.design, { photoCount: 1, dayCount: 4, legacyTheme: t.id });
              return (
                <li key={t.id} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
                  <div className="w-14 flex-shrink-0"><DesignSwatch spec={spec} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-slate-900">{t.name}</p>
                    <p className="truncate text-[12px] text-slate-500">{summary(t.theme_options?.design)}</p>
                    <p className="text-[11.5px] text-slate-400">Updated {fmtDate(t.updated_at)}</p>
                    <div className="mt-2 flex gap-1">
                      <button type="button" className={smallPrimary} onClick={() => startWith(null, t.id)}>Use</button>
                      <button type="button" className={iconBtn} title="Preview" onClick={() => setPreview({ title: t.name, src: previewSrc(t.theme_options) })}><Eye className="h-4 w-4" /></button>
                      <button type="button" className={iconBtn} title="Rename" onClick={() => setRename(t)}><Pencil className="h-4 w-4" /></button>
                      <button type="button" className={`${iconBtn} hover:bg-red-50 hover:text-red-600`} title="Delete" onClick={() => setDel(t)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {preview && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-2 sm:p-6" onMouseDown={() => setPreview(null)}>
          <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="flex-1 text-sm font-bold text-slate-900">{preview.title} <span className="font-normal text-slate-500">— sample layout with placeholder text</span></p>
              <button type="button" className={iconBtn} aria-label="Close" onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1"><PdfViewer url={preview.src} zoom="fit" /></div>
          </div>
        </div>
      )}
      <ConfirmDialog open={!!del} danger title="Delete saved design?" body={<>“{del?.name}” will be removed. Itineraries already using it keep their look.</>} confirmLabel="Delete"
        onConfirm={async () => { const t = del!; setDel(null); try { await api(`/templates/${t.id}`, { method: 'DELETE' }); toast('Deleted'); load(); } catch (e) { toast((e as Error).message, 'error'); } }}
        onClose={() => setDel(null)} />
      {rename && (
        <ConfirmDialog open title="Rename design" confirmLabel="Save"
          body={<input autoFocus value={rename.name} maxLength={80} onChange={(e) => setRename({ ...rename, name: e.target.value })} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-purple-500" />}
          onConfirm={async () => { const t = rename; setRename(null); try { await api(`/templates/${t.id}`, { method: 'PATCH', json: { name: t.name } }); load(); } catch (e) { toast((e as Error).message, 'error'); } }}
          onClose={() => setRename(null)} />
      )}
    </div>
  );
}
