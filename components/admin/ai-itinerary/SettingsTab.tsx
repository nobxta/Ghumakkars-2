'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, Bot, Brush, CheckCircle2, Cpu, FileText, KeyRound, Loader2, Plus, Radar, ShieldCheck, Trash2, Upload, Wrench, XCircle } from 'lucide-react';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';
import { Field, KeyValue, Pill, SaveBar, Section, Switch, btn, inputCls } from '@/components/admin/settings/ui';
import { DEFAULT_SETTINGS, fmtTokens, type ModelConfig, type StudioSettings } from '@/lib/ai-itinerary/types';
import { MOODS } from '@/lib/ai-itinerary/design';
import { api, fmtDate } from './api';
import { useStudio } from './StudioApp';
import { ConfirmDialog } from './ui';

type Sub = 'ai' | 'pdf' | 'references' | 'advanced';
const SUBS: { key: Sub; label: string; icon: React.ElementType }[] = [
  { key: 'ai', label: 'AI', icon: Bot },
  { key: 'pdf', label: 'Brand & PDF', icon: FileText },
  { key: 'references', label: 'References', icon: Brush },
  { key: 'advanced', label: 'Advanced', icon: Wrench },
];

export default function SettingsTab() {
  const { settings, setSettings, goTab } = useStudio();
  const params = useSearchParams();
  const sub = (SUBS.some((s) => s.key === params.get('s')) ? params.get('s') : 'ai') as Sub;
  const { toast } = useAdminLive();
  const [form, setForm] = useState<StudioSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings && !form) setForm(structuredClone(settings.settings)); }, [settings, form]);
  const dirty = useMemo(() => !!form && !!settings && JSON.stringify(form) !== JSON.stringify(settings.settings), [form, settings]);

  const save = async (override?: StudioSettings, extra: Record<string, unknown> = {}) => {
    const body = override || form;
    if (!body) return;
    setSaving(true);
    try {
      const r = await api('/settings', { method: 'PUT', json: { settings: { ...body, pricing: { ...body.pricing, ...extra } } } });
      setSettings(r);
      setForm(structuredClone(r.settings));
      toast('Settings saved');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  if (!form || !settings) return <div className="space-y-3" aria-busy="true"><div className="sk sk-soft h-40 rounded-2xl" /><div className="sk sk-soft h-40 rounded-2xl" /></div>;

  const up = <K extends keyof StudioSettings>(k: K, patch: Partial<StudioSettings[K]>) => setForm((f) => (f ? { ...f, [k]: { ...f[k], ...patch } } : f));

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start" aria-label="Settings sections">
        {SUBS.map((s) => (
          <button key={s.key} type="button" onClick={() => goTab('settings', { s: s.key })} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition ${sub === s.key ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}>
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 space-y-4">
        {sub === 'ai' && <AiSettings form={form} up={up} setForm={setForm} apiKey={settings.apiKey} onResetAllowance={() => save(form, { resetAllowance: true })} />}
        {sub === 'pdf' && <PdfSettings form={form} up={up} onSaved={(saved) => { setSettings({ ...settings, settings: saved }); setForm((f) => (f ? { ...f, pdf: { ...f.pdf, logoVersion: saved.pdf.logoVersion } } : f)); }} />}
        {sub === 'references' && <RefSettings form={form} up={up} />}
        {sub === 'advanced' && <Advanced form={form} up={up} onSaved={(s) => { setSettings(s); setForm(structuredClone(s.settings)); }} />}
        <SaveBar visible={dirty} saving={saving} onSave={() => save()} onDiscard={() => setForm(structuredClone(settings.settings))} />
      </div>
    </div>
  );
}

type UpFn = <K extends keyof StudioSettings>(k: K, patch: Partial<StudioSettings[K]>) => void;

function AiSettings({ form, up, setForm, apiKey, onResetAllowance }: { form: StudioSettings; up: UpFn; setForm: (f: StudioSettings) => void; apiKey: { configured: boolean; masked: string | null }; onResetAllowance: () => void }) {
  const ai = form.ai;
  const models = form.pricing.models;
  const setModel = (i: number, patch: Partial<ModelConfig>) => setForm({ ...form, pricing: { ...form.pricing, models: models.map((m, j) => (j === i ? { ...m, ...patch } : m)) } });
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <Section title="API connection" icon={KeyRound} description="Codex.sale is called from the server only. The key lives in the server environment and is never shown or sent to the browser.">
        <KeyValue items={[
          { label: 'API key (CODEX_API_KEY)', value: apiKey.configured ? <span className="font-mono">{apiKey.masked}</span> : <Pill tone="error">Not configured</Pill> },
          { label: 'Endpoint', value: <span className="font-mono text-[12px]">{form.advanced.baseUrl}/chat/completions</span> },
        ]} />
        {!apiKey.configured && <p className="mt-3 text-[12.5px] text-slate-500">Add <code className="rounded bg-slate-100 px-1">CODEX_API_KEY</code> to <code className="rounded bg-slate-100 px-1">.env.local</code> (and to Coolify for production), then restart the server.</p>}
      </Section>

      <Section title="Behaviour" icon={Bot}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default model" hint="Only verified, enabled models can be used.">
            <select className={inputCls} value={ai.defaultModel} onChange={(e) => up('ai', { defaultModel: e.target.value })}>
              {models.map((m) => <option key={m.key} value={m.key} disabled={!(m.enabled && m.verified)}>{m.displayName} ({m.multiplier}×){!m.verified ? ' — unverified' : !m.enabled ? ' — disabled' : ''}</option>)}
            </select>
          </Field>
          <Field label="Questions" hint="How eagerly the planner asks for missing details.">
            <select className={inputCls} value={ai.askQuestions} onChange={(e) => up('ai', { askQuestions: e.target.value as any })}>
              <option value="essential">Only essential details</option>
              <option value="helpful">Essential + helpful details</option>
              <option value="never">Never ask — use assumptions</option>
            </select>
          </Field>
          <Field label="Creativity (temperature)" hint="Leave empty to use the provider default — some models don’t accept it.">
            <input className={inputCls} type="number" step="0.1" min={0} max={2} value={ai.temperature ?? ''} placeholder="Provider default" onChange={(e) => up('ai', { temperature: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Max output tokens" hint="Upper limit per request. Long itineraries need 6–10k.">
            <input className={inputCls} type="number" min={1000} max={64000} step={500} value={ai.maxOutputTokens} onChange={(e) => up('ai', { maxOutputTokens: Number(e.target.value) })} />
          </Field>
          <Field label="Conversation messages sent" hint="Older context is carried by the structured trip state and a short summary.">
            <input className={inputCls} type="number" min={0} max={40} value={ai.historyMessages} onChange={(e) => up('ai', { historyMessages: Number(e.target.value) })} />
          </Field>
          <Field label="Retries on transient errors" hint="Rate limits, timeouts and 5xx only — never authentication errors.">
            <input className={inputCls} type="number" min={0} max={5} value={ai.retryLimit} onChange={(e) => up('ai', { retryLimit: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-2">
          <Switch checked={ai.autoGenerateWhenReady} onChange={(v) => up('ai', { autoGenerateWhenReady: v })} label="Generate automatically when everything essential is known" description="Off: the planner waits until you ask to generate." />
          <Switch checked={ai.jsonMode} onChange={(v) => up('ai', { jsonMode: v })} label="Request JSON mode" description="Sends response_format=json_object. Automatically dropped if the provider rejects it." />
        </div>
      </Section>

      <Section title="Usage safeguards" icon={ShieldCheck}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting allowance (weighted tokens)" hint="Local estimate only — the provider’s real balance can’t be read.">
            <input className={inputCls} type="number" min={0} step={100000} value={form.pricing.allowanceTokens} onChange={(e) => up('pricing', { allowanceTokens: Number(e.target.value) })} />
          </Field>
          <Field label="Confirm generations above (weighted)" hint="Shows an estimate and asks before large requests. 0 = never ask.">
            <input className={inputCls} type="number" min={0} step={1000} value={ai.warnAboveWeighted} onChange={(e) => up('ai', { warnAboveWeighted: Number(e.target.value) })} />
          </Field>
        </div>
        <p className="mt-2 text-[12px] text-slate-500">Counting usage since: <b>{form.pricing.allowanceSetAt ? fmtDate(form.pricing.allowanceSetAt, true) : 'the first request'}</b>. <button type="button" className="font-semibold text-purple-700 hover:underline" onClick={() => setConfirmReset(true)}>Reset counter to now</button> after a top-up.</p>
        <div className="mt-3"><Switch checked={ai.blockWhenInsufficient} onChange={(v) => up('ai', { blockWhenInsufficient: v })} label="Block requests that exceed the estimated remaining allowance" /></div>
      </Section>

      <Section title="Models & token rates" icon={Cpu} description="Display names are not API ids. A model becomes usable only after it’s verified (Settings → Advanced: test or model discovery). Rates are provider-supplied and editable." flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead className="border-y border-slate-100 bg-slate-50/50 text-[10.5px] uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-2 font-semibold">Display name</th><th className="px-2 font-semibold">API model id</th><th className="px-2 font-semibold">Multiplier</th><th className="px-2 font-semibold">Status</th><th className="px-2 font-semibold">Enabled</th><th className="px-2 font-semibold">Priority</th><th className="px-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m, i) => (
                <tr key={m.key}>
                  <td className="px-4 py-2"><input className="h-8 w-36 rounded-md border border-slate-200 px-2 outline-none focus:border-purple-400" value={m.displayName} onChange={(e) => setModel(i, { displayName: e.target.value })} /></td>
                  <td className="px-2"><input className="h-8 w-36 rounded-md border border-slate-200 px-2 font-mono text-[12px] outline-none focus:border-purple-400" value={m.apiId} onChange={(e) => setModel(i, { apiId: e.target.value.trim(), verified: false, enabled: false })} /></td>
                  <td className="px-2"><input className="h-8 w-20 rounded-md border border-slate-200 px-2 tabular-nums outline-none focus:border-purple-400" type="number" step="0.05" min={0} value={m.multiplier} onChange={(e) => setModel(i, { multiplier: Number(e.target.value) })} /></td>
                  <td className="px-2">{m.verified ? <Pill tone="ok">Verified</Pill> : <Pill tone="muted">Unverified</Pill>}</td>
                  <td className="px-2"><input type="checkbox" className="h-4 w-4 accent-purple-600" checked={m.enabled} disabled={!m.verified} onChange={(e) => setModel(i, { enabled: e.target.checked })} aria-label={`Enable ${m.displayName}`} /></td>
                  <td className="px-2"><input type="checkbox" className="h-4 w-4 accent-purple-600" checked={m.supportsPriority} onChange={(e) => setModel(i, { supportsPriority: e.target.checked })} aria-label="Supports priority" title="Only if the provider supports a priority tier" /></td>
                  <td className="px-2">{!['gpt-6-luna'].includes(m.key) && <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setForm({ ...form, pricing: { ...form.pricing, models: models.filter((_, j) => j !== i) } })} aria-label="Remove model"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3 text-[12.5px] sm:px-5">
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:underline" onClick={() => setForm({ ...form, pricing: { ...form.pricing, models: [...models, { key: `custom-${Date.now()}`, displayName: 'New model', apiId: 'model-id', multiplier: 1, verified: false, enabled: false, supportsPriority: false, recommended: '' }] } })}><Plus className="h-3.5 w-3.5" /> Add model</button>
          <label className="flex items-center gap-2 text-slate-600">Cached-input rate <input className="h-8 w-20 rounded-md border border-slate-200 px-2 tabular-nums" type="number" step="0.05" min={0} max={1} value={form.pricing.cachedInputMultiplier} onChange={(e) => up('pricing', { cachedInputMultiplier: Number(e.target.value) })} /> × model rate</label>
          <label className="flex items-center gap-2 text-slate-600">Priority <input className="h-8 w-16 rounded-md border border-slate-200 px-2 tabular-nums" type="number" step="0.5" min={1} max={10} value={form.pricing.priorityMultiplier} onChange={(e) => up('pricing', { priorityMultiplier: Number(e.target.value) })} />×</label>
        </div>
      </Section>
      <ConfirmDialog open={confirmReset} title="Reset the usage counter?" body="Estimated remaining will be calculated from now against the allowance above. Usage history is kept." confirmLabel="Reset" onConfirm={() => { setConfirmReset(false); onResetAllowance(); }} onClose={() => setConfirmReset(false)} />
    </>
  );
}

function BrandLogo({ version, onSaved }: { version: string | null; onSaved: (s: any) => void }) {
  const { toast } = useAdminLive();
  const [busy, setBusy] = useState(false);
  const [bust, setBust] = useState(0);
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/admin/ai-itinerary/settings/logo', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Upload failed');
      onSaved(j.settings);
      setBust(Date.now());
      toast('Logo updated — new PDFs will use it');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { const j = await api('/settings/logo', { method: 'DELETE' }); onSaved(j.settings); setBust(Date.now()); toast('Back to the website logo'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/admin/ai-itinerary/settings/logo?v=${encodeURIComponent(version || 'default')}-${bust}`} alt="Current logo" className="max-h-full max-w-full object-contain" />
      </span>
      <div className="space-y-2">
        <p className="text-[12.5px] text-slate-500">{version ? 'Custom logo uploaded.' : 'Using the website logo (public/logo.png).'} PNG with a transparent background works best.</p>
        <div className="flex gap-2">
          <label className={`${btn.secondary} cursor-pointer`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload logo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
          {version && <button type="button" className={btn.secondary} disabled={busy} onClick={reset}>Use website logo</button>}
        </div>
      </div>
    </div>
  );
}

function PdfSettings({ form, up, onSaved }: { form: StudioSettings; up: UpFn; onSaved: (s: any) => void }) {
  const p = form.pdf;
  const o = p.defaultOptions || {};
  const setO = (patch: Record<string, unknown>) => up('pdf', { defaultOptions: { ...o, ...patch } });
  return (
    <>
      <Section title="Your brand on every PDF" icon={Brush} description="Logo, name and contact details appear on the cover, page headers/footers and the closing contact page. The AI never invents these.">
        <BrandLogo version={p.logoVersion} onSaved={onSaved} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Company name"><input className={inputCls} value={p.companyName} onChange={(e) => up('pdf', { companyName: e.target.value })} /></Field>
          <Field label="Tagline"><input className={inputCls} value={p.tagline} onChange={(e) => up('pdf', { tagline: e.target.value })} /></Field>
          <Field label="Contact person" hint="e.g. your name — shown as “Talk to … to book” and in the footer."><input className={inputCls} value={p.contactPerson} onChange={(e) => up('pdf', { contactPerson: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} placeholder={DEFAULT_SETTINGS.pdf.phone} value={p.phone} onChange={(e) => up('pdf', { phone: e.target.value })} /></Field>
          <Field label="WhatsApp" hint="Leave the same as phone to show it once."><input className={inputCls} placeholder={p.phone || DEFAULT_SETTINGS.pdf.phone} value={p.whatsapp} onChange={(e) => up('pdf', { whatsapp: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} type="email" placeholder={DEFAULT_SETTINGS.pdf.email} value={p.email} onChange={(e) => up('pdf', { email: e.target.value })} /></Field>
          <Field label="Website"><input className={inputCls} placeholder={DEFAULT_SETTINGS.pdf.website} value={p.website} onChange={(e) => up('pdf', { website: e.target.value })} /></Field>
          <Field label="Instagram"><input className={inputCls} placeholder={DEFAULT_SETTINGS.pdf.instagram} value={p.instagram} onChange={(e) => up('pdf', { instagram: e.target.value })} /></Field>
        </div>
        <div className="mt-4"><Field label="Office address"><input className={inputCls} placeholder={DEFAULT_SETTINGS.pdf.address} value={p.address} onChange={(e) => up('pdf', { address: e.target.value })} /></Field></div>
        <p className="mt-3 text-[12px] text-slate-500">Blank fields fall back to the contact details used on the website.</p>
      </Section>
      <Section title="Defaults for new itineraries" icon={FileText} description="Designs are generated per itinerary. These only set the starting point.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default mood" hint="Auto lets the AI pick a mood that suits each trip.">
            <select className={inputCls} value={o.design?.mood || ''} onChange={(e) => setO({ design: { ...(o.design || {}), mood: e.target.value || undefined } })}>
              <option value="">Auto (recommended)</option>
              {MOODS.map((m) => <option key={m.key} value={m.key}>{m.label} — {m.hint}</option>)}
            </select>
          </Field>
          <Field label="Paper size"><select className={inputCls} value={o.paper || 'a4'} onChange={(e) => setO({ paper: e.target.value })}><option value="a4">A4</option><option value="letter">Letter</option></select></Field>
          <Field label="Cover page"><select className={inputCls} value={o.cover || 'full'} onChange={(e) => setO({ cover: e.target.value })}><option value="full">Full designed cover</option><option value="compact">Compact header</option><option value="none">No cover</option></select></Field>
          <Field label="Density"><select className={inputCls} value={o.density || 'comfortable'} onChange={(e) => setO({ density: e.target.value })}><option value="comfortable">Airy</option><option value="compact">Compact</option></select></Field>
          <Field label="Photos"><select className={inputCls} value={o.images || 'cover'} onChange={(e) => setO({ images: e.target.value })}><option value="cover">Use attached photos (or a photo from our trips for the cover)</option><option value="none">No photos</option></select></Field>
          <Field label="Footer text" hint="Optional. Defaults to contact person · phone · website."><input className={inputCls} value={o.footerText || ''} onChange={(e) => setO({ footerText: e.target.value || undefined })} /></Field>
        </div>
      </Section>
    </>
  );
}

function RefSettings({ form, up }: { form: StudioSettings; up: UpFn }) {
  const r = form.references;
  const types: [string, string][] = [['application/pdf', 'PDF'], ['text/plain', 'Plain text (.txt)'], ['text/markdown', 'Markdown (.md)']];
  return (
    <Section title="Reference files" icon={Brush} description="Uploaded files are stored privately and their text is treated as data, never as instructions. Photos (JPG/PNG/WebP, up to 15 MB, 20 per itinerary) are always allowed.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Max file size (MB)"><input className={inputCls} type="number" min={1} max={25} value={r.maxFileMB} onChange={(e) => up('references', { maxFileMB: Number(e.target.value) })} /></Field>
        <Field label="Max files per itinerary"><input className={inputCls} type="number" min={1} max={30} value={r.maxFilesPerProject} onChange={(e) => up('references', { maxFilesPerProject: Number(e.target.value) })} /></Field>
        <Field label="Characters sent to the AI per file" hint="Larger = better recall, more tokens."><input className={inputCls} type="number" min={1000} max={100000} step={1000} value={r.maxCharsPerReference} onChange={(e) => up('references', { maxCharsPerReference: Number(e.target.value) })} /></Field>
        <Field label="Delete reference files after (days)" hint="0 = keep forever. Applied by Advanced → Run cleanup."><input className={inputCls} type="number" min={0} value={r.retentionDays} onChange={(e) => up('references', { retentionDays: Number(e.target.value) })} /></Field>
      </div>
      <p className="mb-2 mt-4 text-sm font-semibold text-slate-800">Allowed types</p>
      <div className="flex flex-wrap gap-3">
        {types.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={r.allowedTypes.includes(k)} onChange={(e) => up('references', { allowedTypes: e.target.checked ? [...r.allowedTypes, k] : r.allowedTypes.filter((x) => x !== k) })} />{l}
          </label>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-slate-500">Scanned/image-only PDFs have no extractable text (no OCR). Visual design can’t be reproduced from text — design references map to the closest built-in theme.</p>
    </Section>
  );
}

interface Diag { config: { apiKeyConfigured: boolean; apiKeyMasked: string | null; baseUrl: string; storageReady: boolean; storageError: string | null; verifiedModels: string[] }; errors: { id: string; kind: string; model_id: string; http_status: number | null; error_code: string | null; error_message: string | null; created_at: string }[]; failedJobs: { id: string; kind: string; stage: string | null; error: string | null; started_at: string }[] }

function Advanced({ form, up, onSaved }: { form: StudioSettings; up: UpFn; onSaved: (s: any) => void }) {
  const { toast } = useAdminLive();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testModel, setTestModel] = useState(form.ai.defaultModel);
  const [result, setResult] = useState<any>(null);
  const [confirmTest, setConfirmTest] = useState(false);

  const loadDiag = useCallback(async () => { try { setDiag(await api<Diag>('/diagnostics')); } catch (e) { toast((e as Error).message, 'error'); } }, [toast]);
  useEffect(() => { loadDiag(); }, [loadDiag]);
  const refreshSettings = async () => onSaved(await api('/settings'));

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setResult(null);
    try {
      const r = await api('/diagnostics', { method: 'POST', json: { action, ...extra } });
      setResult({ action, ...r });
      if (action !== 'cleanup') await refreshSettings();
      loadDiag();
    } catch (e) { setResult({ action, ok: false, error: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const adv = form.advanced;
  return (
    <>
      <Section title="Connection test & model discovery" icon={Radar} description="A test sends one tiny paid request (logged in Usage). A successful test verifies that model id.">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Model to test">
            <select className={`${inputCls} w-64`} value={testModel} onChange={(e) => setTestModel(e.target.value)}>
              {form.pricing.models.map((m) => <option key={m.key} value={m.key}>{m.displayName} — {m.apiId}</option>)}
            </select>
          </Field>
          <button type="button" className={btn.primary} disabled={!!busy} onClick={() => setConfirmTest(true)}>{busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Test connection</button>
          <button type="button" className={btn.secondary} disabled={!!busy} onClick={() => run('discover')}>{busy === 'discover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />} Discover models</button>
        </div>
        {result && result.action !== 'cleanup' && (
          <div className={`mt-3 rounded-xl border p-3 text-[12.5px] ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {result.action === 'test' && (result.ok
              ? <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> <b>{result.model}</b> responded in {(result.latencyMs / 1000).toFixed(1)}s and is now verified. Usage: {result.usage?.reported ? `${result.usage.input} in / ${result.usage.output} out (${fmtTokens(result.weighted)} weighted)` : 'not reported by the provider'}.</p>
              : <p className="flex items-center gap-1.5"><XCircle className="h-4 w-4" /> <b>{result.model}</b>: {result.error} ({result.code})</p>)}
            {result.action === 'discover' && (result.ok
              ? <><p><b>{result.ids.length}</b> model ids reported by the provider · {result.newlyVerified} newly verified.</p><p className="mt-1 break-words font-mono text-[11.5px] opacity-80">{result.ids.slice(0, 60).join(', ') || '—'}</p></>
              : <p>Discovery unavailable: {result.error}. Use “Test connection” per model instead.</p>)}
          </div>
        )}
      </Section>

      <Section title="Requests" icon={Wrench}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API base URL" hint="OpenAI-compatible base. Must be https."><input className={`${inputCls} font-mono`} value={adv.baseUrl} onChange={(e) => up('advanced', { baseUrl: e.target.value })} /></Field>
          <Field label="Request timeout (seconds)"><input className={inputCls} type="number" min={10} max={600} value={Math.round(adv.timeoutMs / 1000)} onChange={(e) => up('advanced', { timeoutMs: Number(e.target.value) * 1000 })} /></Field>
          <Field label="Mark stuck jobs as failed after (minutes)" hint="Covers server restarts mid-generation."><input className={inputCls} type="number" min={2} max={120} value={adv.staleJobMinutes} onChange={(e) => up('advanced', { staleJobMinutes: Number(e.target.value) })} /></Field>
          <Field label="Rate limits" hint="429s are retried with exponential backoff (honouring Retry-After, max 20s) up to the retry limit in AI settings."><div className="flex h-11 items-center text-[13px] text-slate-600">Automatic</div></Field>
        </div>
      </Section>

      <Section title="Data retention" icon={Trash2} action={<button type="button" className={btn.secondary} disabled={!!busy} onClick={() => run('cleanup')}>{busy === 'cleanup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Run cleanup</button>}>
        <Field label="Delete usage logs and archived itineraries older than (days)" hint="0 = keep forever. Save first, then run cleanup.">
          <input className={`${inputCls} max-w-[200px]`} type="number" min={0} value={adv.dataRetentionDays} onChange={(e) => up('advanced', { dataRetentionDays: Number(e.target.value) })} />
        </Field>
        {result?.action === 'cleanup' && <p className="mt-3 text-[12.5px] text-slate-600">{result.ok ? `Removed ${result.usageEvents} usage logs, ${result.archivedProjects} archived itineraries, ${result.references} reference files; closed ${result.staleJobs} stuck jobs.` : result.error}</p>}
      </Section>

      <Section title="Diagnostics" icon={Activity} action={<button type="button" className={btn.secondary} onClick={loadDiag}>Refresh</button>}>
        {!diag ? <div className="sk sk-soft h-24 rounded-xl" /> : (
          <>
            <KeyValue items={[
              { label: 'API key', value: diag.config.apiKeyConfigured ? <Pill tone="ok">Configured</Pill> : <Pill tone="error">Missing</Pill> },
              { label: 'PDF storage (private bucket)', value: diag.config.storageReady ? <Pill tone="ok">Ready</Pill> : <Pill tone="warn">{diag.config.storageError || 'Will be created on first use'}</Pill> },
              { label: 'Verified models', value: <span className="font-mono text-[12px]">{diag.config.verifiedModels.join(', ') || '—'}</span> },
            ]} />
            <p className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-400">Recent API errors</p>
            {!diag.errors.length ? <p className="text-[13px] text-slate-500">None.</p> : (
              <ul className="divide-y divide-slate-100 text-[12.5px]">
                {diag.errors.slice(0, 10).map((e) => (
                  <li key={e.id} className="py-1.5"><span className="text-slate-400">{fmtDate(e.created_at, true)}</span> · <span className="font-mono">{e.model_id}</span> · <b className="text-red-600">{e.error_code}</b>{e.http_status ? ` (${e.http_status})` : ''} — <span className="text-slate-600">{e.error_message}</span></li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>
      <ConfirmDialog open={confirmTest} title="Send a test request?" body="This makes one tiny paid request (a few tokens) to the selected model. It is recorded in Usage." confirmLabel="Send test" onConfirm={() => { setConfirmTest(false); run('test', { model: testModel }); }} onClose={() => setConfirmTest(false)} />
    </>
  );
}
