'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2, RotateCcw, Save, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { draftFromRow, draftToPayload, type AddonDraft } from '@/components/admin/TripAddonsEditor';
import {
  STEPS,
  emptyState,
  fid,
  generateSlug,
  publishPayload,
  snapshot,
  stateFromRow,
  tripPayload,
  validateAll,
  type Errors,
  type TripFormState,
} from './state';
import { StepBasics, StepDates, StepExtras, StepItinerary, StepPhotos, StepPricing, type Patch, type StepProps } from './steps';
import { Toast, type ToastData } from './ui';

const AUTOSAVE_KEY = 'ghumakkars:trip-form:create';
const LAST = STEPS.length;

interface TripMeta {
  status: string;
  isActive: boolean;
  publishedAt: string | null;
  currentParticipants: number;
  slug: string;
}

function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export default function TripForm({ mode, tripId }: { mode: 'create' | 'edit'; tripId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [s, setS] = useState<TripFormState>(emptyState);
  const [baseline, setBaseline] = useState(() => snapshot(emptyState()));
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState('');
  const [meta, setMeta] = useState<TripMeta | null>(null);
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(mode === 'edit' ? LAST : 1);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const leavingRef = useRef(false);

  const dirty = snapshot(s) !== baseline;
  const allErrors = useMemo(() => validateAll(s), [s]);
  const stepErrors = (n: number): Errors => ({
    ...(attempted.has(n) ? allErrors[n] : {}),
    ...(n === 1 ? serverErrors : {}),
  });
  const errorCount = (n: number) => Object.keys(stepErrors(n)).length;

  const set = useCallback((patch: Patch) => {
    setS((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  const notify = useCallback((t: Omit<ToastData, 'id'>) => setToast({ ...t, id: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);

  // Server-side slug clash clears as soon as the slug changes.
  useEffect(() => setServerErrors({}), [s.slug]);

  /* ───────────── Load (edit) / restore autosave (create) ───────────── */
  const load = useCallback(async () => {
    if (mode !== 'edit' || !tripId) return;
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (error) throw error;
      if (!data) {
        router.push('/admin/trips');
        return;
      }
      let addonRows: any[] = [];
      try {
        const res = await fetch(`/api/admin/trips/${tripId}/addons`);
        if (res.ok) addonRows = (await res.json()).addons || [];
      } catch {
        /* non-fatal — the add-ons editor just starts empty */
      }
      const next = stateFromRow(data, addonRows);
      setS(next);
      setBaseline(snapshot(next));
      setMeta({
        status: data.status || (data.is_active ? 'active' : 'draft'),
        isActive: !!data.is_active,
        publishedAt: data.published_at || null,
        currentParticipants: data.current_participants || 0,
        slug: data.slug || '',
      });
    } catch (e: any) {
      setLoadError(e.message || 'Could not load this trip');
    } finally {
      setLoading(false);
    }
  }, [mode, tripId, supabase, router]);

  useEffect(() => {
    if (mode === 'edit') {
      load();
      return;
    }
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { savedAt: number; step?: number; maxReached?: number; state: Partial<TripFormState> };
      if (!saved?.state) return;
      setS({ ...emptyState(), ...saved.state });
      if (saved.step) setStep(saved.step);
      if (saved.maxReached) setMaxReached(saved.maxReached);
      setRestoredAt(saved.savedAt);
    } catch {
      /* storage blocked or corrupt — start fresh */
    }
  }, [mode, load]);

  // Autosave the create form so a refresh or closed tab doesn't lose work.
  useEffect(() => {
    if (mode !== 'create' || !dirty || leavingRef.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: Date.now(), step, maxReached, state: s }));
      } catch {
        /* ignore quota / private mode */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [mode, s, dirty, step, maxReached]);

  const discardRestored = () => {
    if (!confirm('Discard the restored trip and start from a blank form?')) return;
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
    const blank = emptyState();
    setS(blank);
    setStep(1);
    setMaxReached(1);
    setAttempted(new Set());
    setRestoredAt(null);
  };

  /* ───────────── Unsaved-changes guard ───────────── */
  useEffect(() => {
    // In create mode, work is autosaved locally, so only warn on edit.
    const guard = mode === 'edit' && dirty;
    if (!guard) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (leavingRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (!confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [mode, dirty]);

  /* ───────────── Navigation ───────────── */
  const focusFirstError = (errs: Errors) => {
    const key = Object.keys(errs)[0];
    if (!key) return;
    // Wait for the step to render before focusing.
    setTimeout(() => {
      const el = document.getElementById(fid(key));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.focus({ preventScroll: true });
      }
    }, 60);
  };

  const goTo = (n: number) => {
    if (n < 1 || n > LAST || (mode === 'create' && n > maxReached)) return;
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    setAttempted((prev) => new Set(prev).add(step));
    const errs = allErrors[step];
    if (Object.keys(errs).length) {
      focusFirstError(errs);
      return;
    }
    const n = Math.min(step + 1, LAST);
    setMaxReached((m) => Math.max(m, n));
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => goTo(step - 1);

  /* ───────────── Save ───────────── */
  const isUnpublished = mode === 'create' || meta?.status === 'draft' || meta?.status === 'scheduled';

  const save = async () => {
    if (saving) return;
    const all = validateAll(s);
    const bad = STEPS.map((x) => x.num).filter((n) => Object.keys(all[n]).length > 0);
    if (bad.length) {
      setAttempted(new Set(STEPS.map((x) => x.num)));
      setMaxReached(LAST);
      const first = bad[0];
      const total = bad.reduce((sum, n) => sum + Object.keys(all[n]).length, 0);
      setStep(first);
      notify({ message: `Fix ${total} issue${total === 1 ? '' : 's'} before saving — starting with ${STEPS[first - 1].label}.`, tone: 'error' });
      focusFirstError(all[first]);
      return;
    }

    setSaving(true);
    try {
      const base = tripPayload(s);
      const addonBody = JSON.stringify({ enabled: s.addonsEnabled, addons: s.addonDrafts.map((d, i) => draftToPayload(d, i)) });

      if (mode === 'create') {
        const pub = publishPayload(s);
        const { data, error } = await supabase
          .from('trips')
          .insert([{
            ...base,
            slug: base.slug || generateSlug(s.title),
            current_participants: 0,
            ...pub,
            published_at: s.publishOption === 'now' ? new Date().toISOString() : null,
          }])
          .select('id')
          .single();
        if (error) throw error;

        let addonError = '';
        if (s.addonsEnabled || s.addonDrafts.length > 0) {
          try {
            const res = await fetch(`/api/admin/trips/${data.id}/addons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: addonBody });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save add-ons');
          } catch (e: any) {
            addonError = e.message;
          }
        }
        fetch('/api/admin/revalidate-trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: data.id }) }).catch(() => {});

        leavingRef.current = true;
        try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
        setBaseline(snapshot(s));
        if (addonError) {
          notify({ message: `Trip created, but add-ons failed: ${addonError}. Opening the edit page so you can retry.`, tone: 'error' });
          setTimeout(() => router.push(`/admin/trips/edit/${data.id}`), 1800);
        } else {
          notify({ message: s.publishOption === 'now' ? 'Trip published' : s.publishOption === 'schedule' ? 'Trip scheduled' : 'Draft saved', tone: 'success' });
          setTimeout(() => router.push('/admin/trips'), 900);
        }
        return;
      }

      // ── edit ──
      const update: Record<string, unknown> = { ...base };
      if (isUnpublished) {
        Object.assign(update, publishPayload(s));
        if (s.publishOption === 'now' && !meta?.publishedAt) update.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from('trips').update(update).eq('id', tripId);
      if (error) throw error;

      const res = await fetch(`/api/admin/trips/${tripId}/addons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: addonBody });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Trip saved, but add-ons failed to save');

      // Re-read add-ons so new ones get their real ids (a second save must not duplicate them).
      let saved = s;
      try {
        const r = await fetch(`/api/admin/trips/${tripId}/addons`);
        if (r.ok) {
          const rows = (await r.json()).addons || [];
          saved = { ...s, addonDrafts: rows.map((row: any) => draftFromRow(row)) };
        }
      } catch {}
      setS(saved);
      setBaseline(snapshot(saved));

      fetch('/api/admin/revalidate-trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId }) }).catch(() => {});

      if (isUnpublished && meta) {
        const status = (update.status as string) || meta.status;
        setMeta({ ...meta, status, isActive: status === 'active', publishedAt: (update.published_at as string) || meta.publishedAt, slug: s.slug });
      } else if (meta) {
        setMeta({ ...meta, slug: s.slug });
      }
      notify({ message: 'Changes saved', tone: 'success' });
    } catch (e: any) {
      const msg: string = e?.message || 'Save failed';
      if (e?.code === '23505' && /slug/i.test(msg + (e?.details || ''))) {
        setServerErrors({ slug: 'Another trip already uses this link. Pick a different one.' });
        setStep(1);
        focusFirstError({ slug: 'x' });
        notify({ message: 'That trip link is already taken', tone: 'error' });
      } else {
        notify({ message: msg, tone: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S saves on the edit page.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (mode !== 'edit') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const onAddonRemoved = (d: AddonDraft, index: number) =>
    notify({
      message: `Add-on “${d.name || 'Untitled'}” removed`,
      actionLabel: 'Undo',
      onAction: () =>
        set((prev) => {
          const next = [...prev.addonDrafts];
          next.splice(Math.min(index, next.length), 0, d);
          return { addonDrafts: next };
        }),
    });

  /* ───────────── Render ───────────── */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />
          <p className="mt-3 text-sm font-medium text-gray-500">Loading trip…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">Couldn’t load this trip</p>
        <p className="mt-1 text-sm text-red-600">{loadError}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/admin/trips" className="btn btn-secondary">All trips</Link>
          <button type="button" onClick={load} className="btn btn-primary"><RotateCcw /> Try again</button>
        </div>
      </div>
    );
  }

  const stepProps: StepProps = {
    s,
    set,
    errors: stepErrors(step),
    mode,
    notify,
    goTo,
    originalSlug: meta?.slug || '',
    currentParticipants: meta?.currentParticipants || 0,
    showPublish: isUnpublished,
    liveStatus: meta?.status,
  };

  const publicHref = meta ? `/trips/${meta.slug || tripId}` : '';
  const finalLabel =
    s.publishOption === 'now' ? 'Publish trip' : s.publishOption === 'schedule' ? 'Schedule trip' : 'Save as draft';
  const FinalIcon = s.publishOption === 'now' ? Send : s.publishOption === 'schedule' ? Clock : Save;
  const editSaveLabel = isUnpublished && s.publishOption === 'now' ? 'Save & publish' : 'Save changes';

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <Link href="/admin/trips" className="btn btn-sm btn-ghost -ml-3 mb-2">
          <ArrowLeft /> All trips
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{mode === 'create' ? 'New trip' : 'Edit trip'}</h1>
            {mode === 'edit' && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span className="truncate">{s.title || 'Untitled'}</span>
                {meta && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    meta.status === 'active' ? 'bg-green-100 text-green-700' : meta.status === 'draft' ? 'bg-gray-100 text-gray-600' : meta.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>{meta.status}</span>
                )}
              </p>
            )}
            {mode === 'create' && <p className="mt-1 text-sm text-gray-500">Six short steps. Your progress is saved on this device as you go.</p>}
          </div>
          {mode === 'edit' && meta && (
            <a href={publicHref} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
              <ExternalLink /> View trip page
            </a>
          )}
        </div>
      </div>

      {restoredAt && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span className="min-w-0 flex-1">Restored your unsaved trip from {timeAgo(restoredAt)}.</span>
          <button type="button" onClick={() => setRestoredAt(null)} className="btn btn-sm btn-ghost text-blue-800 hover:bg-blue-100">Keep it</button>
          <button type="button" onClick={discardRestored} className="btn btn-sm btn-secondary">Start fresh</button>
        </div>
      )}

      {/* Step indicator */}
      <nav aria-label="Trip form steps" className="mb-5 sm:mb-6">
        {/* Mobile: compact label + segmented bar */}
        <div className="sm:hidden">
          <p className="mb-2 text-sm font-semibold text-gray-900">
            {STEPS[step - 1].label} <span className="font-normal text-gray-500">· step {step} of {LAST}</span>
          </p>
          <div className="flex gap-1.5">
            {STEPS.map((x) => {
              const reachable = mode === 'edit' || x.num <= maxReached;
              const hasErr = errorCount(x.num) > 0;
              return (
                <button
                  key={x.num}
                  type="button"
                  onClick={() => goTo(x.num)}
                  disabled={!reachable}
                  aria-label={`${x.label}${hasErr ? ' (has errors)' : ''}`}
                  aria-current={x.num === step ? 'step' : undefined}
                  className="no-min-touch flex-1 py-2 disabled:cursor-not-allowed"
                >
                  <span className={`block h-1.5 rounded-full ${
                    hasErr ? 'bg-red-500' : x.num === step ? 'bg-purple-600' : x.num < step || (mode === 'create' && x.num <= maxReached) ? 'bg-purple-300' : 'bg-gray-200'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop: clickable circles with labels */}
        <ol className="hidden items-start sm:flex">
          {STEPS.map((x, i) => {
            const active = x.num === step;
            const reachable = mode === 'edit' || x.num <= maxReached;
            const done = mode === 'create' ? x.num < maxReached && !active : false;
            const hasErr = errorCount(x.num) > 0;
            return (
              <li key={x.num} className="flex flex-1 items-start last:flex-none">
                <button
                  type="button"
                  onClick={() => goTo(x.num)}
                  disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  className="no-min-touch group flex w-20 flex-col items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed"
                >
                  <span className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    active ? 'bg-purple-600 text-white ring-4 ring-purple-100'
                      : hasErr ? 'bg-red-50 text-red-600 ring-1 ring-red-300'
                      : done ? 'bg-purple-100 text-purple-700 group-hover:bg-purple-200'
                      : reachable ? 'bg-white text-gray-600 ring-1 ring-gray-300 group-hover:ring-purple-400'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done && !hasErr ? <Check className="h-4 w-4" /> : x.num}
                    {hasErr && !active && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
                  </span>
                  <span className={`text-center text-xs font-medium leading-tight ${active ? 'text-purple-700' : hasErr ? 'text-red-600' : 'text-gray-500'}`}>{x.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={`mt-[18px] h-0.5 flex-1 rounded ${x.num < maxReached || mode === 'edit' ? 'bg-purple-200' : 'bg-gray-200'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Current step */}
      <div key={step} className="animate-fade-in-up rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        {step === 1 && <StepBasics {...stepProps} />}
        {step === 2 && <StepPricing {...stepProps} />}
        {step === 3 && <StepDates {...stepProps} />}
        {step === 4 && <StepPhotos {...stepProps} />}
        {step === 5 && <StepItinerary {...stepProps} />}
        {step === 6 && <StepExtras {...stepProps} onAddonRemoved={onAddonRemoved} />}
      </div>

      {/* Sticky action bar — sits above the mobile bottom nav */}
      <div className="sticky bottom-[4.25rem] z-30 mt-5 md:bottom-4">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:gap-3 sm:p-2.5">
          {step > 1 ? (
            <button type="button" onClick={back} className="btn btn-lg btn-secondary max-sm:w-12 max-sm:px-0" aria-label="Previous step">
              <ChevronLeft /> <span className="hidden sm:inline">Back</span>
            </button>
          ) : (
            <span className="hidden sm:block sm:w-[1px]" aria-hidden />
          )}

          <div className="min-w-0 flex-1 truncate text-xs text-gray-500 sm:text-sm">
            {mode === 'edit' ? (
              dirty ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" /> All changes saved</span>
              )
            ) : (
              <span className="hidden sm:inline">Step {step} of {LAST}</span>
            )}
          </div>

          {step < LAST && (
            <button
              type="button"
              onClick={next}
              className={`btn btn-lg ${mode === 'edit' ? 'btn-secondary' : 'btn-primary'}`}
            >
              Next <ChevronRight />
            </button>
          )}

          {mode === 'edit' ? (
            <button type="button" onClick={save} disabled={saving || !dirty} className="btn btn-lg btn-primary" title="Save (Ctrl+S)">
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? 'Saving…' : editSaveLabel}
            </button>
          ) : (
            step === LAST && (
              <button type="button" onClick={save} disabled={saving} className="btn btn-lg btn-primary">
                {saving ? <Loader2 className="animate-spin" /> : <FinalIcon />}
                {saving ? 'Saving…' : finalLabel}
              </button>
            )
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
