/**
 * Validation + normalisation for everything the model returns.
 * Nothing from the model reaches the database or the PDF without passing here.
 */
import type {
  ActivityStatus,
  Itinerary,
  ItineraryDay,
  MissingField,
  ThemeOptions,
  TripDetails,
  TripFieldKey,
} from './types';
import { THEMES, TRIP_FIELD_KEYS } from './types';
import { COVERS, DAY_STYLES, FONT_PAIRS, MOODS, MOTIFS, PALETTES } from './design';

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function str(v: unknown, max = 2000): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
  if (typeof v !== 'string') return undefined;
  const s = v.replace(CTRL, '').replace(/\s+\n/g, '\n').trim();
  return s ? s.slice(0, max) : undefined;
}

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.]/g, '')) : Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (n < min || n > max) return undefined;
  return n;
}

function strList(v: unknown, maxItems = 40, maxLen = 400): string[] {
  if (typeof v === 'string') v = v.split(/\n|;|•/);
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, maxLen)?.replace(/^[-*•\d.)\s]+/, '').trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/* ─────────────────────── trip details patch ─────────────────────── */

/** Clean a partial trip-details patch from the model or the admin. `null` means "clear this field". */
export function cleanTripPatch(raw: unknown): Partial<Record<TripFieldKey, unknown>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<TripFieldKey, unknown>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!TRIP_FIELD_KEYS.includes(k as TripFieldKey)) continue;
    const key = k as TripFieldKey;
    if (v === null) { out[key] = null; continue; }
    if (key === 'durationDays' || key === 'durationNights') {
      const n = num(v, 0, 90);
      if (n != null) out[key] = Math.round(n);
    } else if (key === 'dayPlans') {
      if (!Array.isArray(v)) continue;
      const plans: { day: number; notes: string }[] = [];
      for (const p of v) {
        const day = num((p as any)?.day, 1, 90);
        const notes = str((p as any)?.notes, 1500);
        if (day && notes) plans.push({ day: Math.round(day), notes });
      }
      if (plans.length) out.dayPlans = plans.slice(0, 60);
    } else {
      const s = Array.isArray(v) ? strList(v).join('\n') : str(v, 3000);
      if (s) out[key] = s;
    }
  }
  return out;
}

/**
 * Merge a patch into trip details. Locked (manually confirmed) fields are never
 * overwritten — differing values come back as conflicts for the admin to accept.
 * Day plans merge by day number so days can arrive in any order.
 */
export function mergeTripDetails(
  current: TripDetails,
  patch: Partial<Record<TripFieldKey, unknown>>,
  locked: string[]
): { next: TripDetails; changed: string[]; conflicts: { field: string; current: unknown; proposed: unknown }[] } {
  const next: TripDetails = { ...current };
  const changed: string[] = [];
  const conflicts: { field: string; current: unknown; proposed: unknown }[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const key = k as TripFieldKey;
    const cur = (current as any)[key];
    if (key === 'dayPlans' && Array.isArray(v)) {
      const map = new Map<number, string>((cur || []).map((p: any) => [p.day, p.notes]));
      let touched = false;
      for (const p of v as { day: number; notes: string }[]) {
        if (map.get(p.day) !== p.notes) { map.set(p.day, p.notes); touched = true; }
      }
      if (!touched) continue;
      if (locked.includes(key)) { conflicts.push({ field: key, current: cur, proposed: v }); continue; }
      next.dayPlans = Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([day, notes]) => ({ day, notes }));
      changed.push(key);
      continue;
    }
    if (JSON.stringify(cur ?? null) === JSON.stringify(v ?? null)) continue;
    if (locked.includes(key)) {
      conflicts.push({ field: key, current: cur, proposed: v });
      continue;
    }
    if (v === null) delete (next as any)[key];
    else (next as any)[key] = v;
    changed.push(key);
  }
  return { next, changed, conflicts };
}

export function cleanMissing(raw: unknown): MissingField[] {
  if (!Array.isArray(raw)) return [];
  const out: MissingField[] = [];
  for (const m of raw.slice(0, 8)) {
    const field = str((m as any)?.field, 60);
    const question = str((m as any)?.question, 300);
    if (field && question) out.push({ field, question, essential: !!(m as any)?.essential });
  }
  return out;
}

/* ─────────────────────── itinerary ─────────────────────── */

const ACT_STATUS: ActivityStatus[] = ['included', 'optional', 'suggested'];

function cleanDay(raw: any, i: number): ItineraryDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = str(raw.title, 160);
  const activities = (Array.isArray(raw.activities) ? raw.activities : [])
    .slice(0, 20)
    .map((a: any) => {
      if (typeof a === 'string') return { title: str(a, 200)!, status: 'included' as ActivityStatus };
      const t = str(a?.title, 200);
      if (!t) return null;
      return {
        time: str(a.time, 40),
        title: t,
        description: str(a.description, 700),
        status: ACT_STATUS.includes(a.status) ? a.status : 'included',
      };
    })
    .filter(Boolean);
  if (!title && !activities.length && !str(raw.summary)) return null;
  return {
    day: Math.round(num(raw.day, 1, 90) ?? i + 1),
    title: title || `Day ${i + 1}`,
    date: str(raw.date, 60),
    route: str(raw.route, 160),
    summary: str(raw.summary, 1200),
    activities,
    meals: strList(raw.meals, 4, 60),
    stay: str(raw.stay, 200),
    transport: str(raw.transport, 200),
    notes: str(raw.notes, 500),
  };
}

export type ValidationResult = { ok: true; value: Itinerary; warnings: string[]; errors: string[] } | { ok: false; errors: string[]; value?: undefined; warnings?: undefined };

/** Strict-but-forgiving: coerce shapes, cap lengths, reject documents that are unusable. */
export function validateItinerary(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Itinerary is not an object'] };
  const r = raw as any;

  const title = str(r.title, 140);
  const destination = str(r.destination, 140);
  if (!title) errors.push('title is required');
  if (!destination) errors.push('destination is required');

  const daysRaw = Array.isArray(r.days) ? r.days : [];
  const days = daysRaw.slice(0, 60).map(cleanDay).filter(Boolean) as ItineraryDay[];
  if (!days.length) errors.push('days must contain at least one day');
  days.sort((a, b) => a.day - b.day);
  const seen = new Set<number>();
  for (const d of days) {
    if (seen.has(d.day)) warnings.push(`Duplicate day ${d.day}`);
    seen.add(d.day);
  }

  if (errors.length) return { ok: false, errors };

  const pricing = (Array.isArray(r.pricing) ? r.pricing : []).slice(0, 12).map((p: any) => {
    const label = str(p?.label, 120);
    if (!label) return null;
    const amount = num(p?.amount, 0, 100_000_000);
    return { label, amount, basis: str(p?.basis, 80), note: str(p?.note, 200) };
  }).filter(Boolean);

  const contactRaw = r.contact && typeof r.contact === 'object' ? r.contact : {};
  const contact = {
    name: str(contactRaw.name, 120),
    phone: str(contactRaw.phone, 60),
    email: str(contactRaw.email, 120),
    website: str(contactRaw.website, 120),
    emergency: str(contactRaw.emergency, 200),
  };

  const value: Itinerary = {
    title: title!,
    subtitle: str(r.subtitle, 200),
    destination: destination!,
    durationLabel: str(r.durationLabel, 60),
    dates: str(r.dates, 80),
    startLocation: str(r.startLocation, 120),
    endLocation: str(r.endLocation, 120),
    travellers: str(r.travellers, 80),
    audience: str(r.audience, 120),
    pickup: str(r.pickup, 200),
    drop: str(r.drop, 200),
    overview: str(r.overview, 2000),
    highlights: strList(r.highlights, 10, 160),
    days,
    stays: (Array.isArray(r.stays) ? r.stays : []).slice(0, 15).map((s: any) => ({
      location: str(s?.location, 120),
      name: str(s?.name, 160),
      category: str(s?.category, 120),
      nights: str(s?.nights, 40),
      notes: str(s?.notes, 300),
      confirmed: s?.confirmed === true,
    })).filter((s: any) => s.location || s.name || s.category),
    transport: (Array.isArray(r.transport) ? r.transport : []).slice(0, 10).map((t: any) => ({
      mode: str(t?.mode, 120) || '',
      details: str(t?.details, 400),
      confirmed: t?.confirmed === true,
    })).filter((t: any) => t.mode),
    inclusions: strList(r.inclusions, 30),
    exclusions: strList(r.exclusions, 30),
    pricing: pricing as Itinerary['pricing'],
    pricingNote: str(r.pricingNote, 400),
    paymentTerms: strList(r.paymentTerms, 15),
    cancellationPolicy: strList(r.cancellationPolicy, 15),
    importantNotes: strList(r.importantNotes, 20),
    thingsToCarry: strList(r.thingsToCarry, 25, 120),
    contact: Object.values(contact).some(Boolean) ? contact : undefined,
    assumptions: strList(r.assumptions, 15),
  };
  return { ok: true, value, warnings, errors: [] };
}

/**
 * Apply a targeted edit: only the sections present in `patch` change.
 * Days merge by day number; `removeDays` drops days. Everything else is preserved.
 */
export function applyItineraryPatch(base: Itinerary, patch: any): { value: Itinerary; changed: string[] } | { error: string } {
  if (!patch || typeof patch !== 'object') return { error: 'Edit was empty' };
  const merged: any = { ...base };
  const changed: string[] = [];
  const simple = ['title', 'subtitle', 'destination', 'durationLabel', 'dates', 'startLocation', 'endLocation', 'travellers',
    'audience', 'pickup', 'drop', 'overview', 'highlights', 'stays', 'transport', 'inclusions', 'exclusions', 'pricing',
    'pricingNote', 'paymentTerms', 'cancellationPolicy', 'importantNotes', 'thingsToCarry', 'contact', 'assumptions'];
  for (const k of simple) {
    if (k in patch && patch[k] !== undefined) { merged[k] = patch[k]; changed.push(k); }
  }
  let days = [...base.days];
  if (Array.isArray(patch.removeDays) && patch.removeDays.length) {
    const rm = new Set(patch.removeDays.map((n: any) => Number(n)));
    days = days.filter((d) => !rm.has(d.day));
    changed.push(...Array.from(rm).map((n) => `day ${n} removed`));
  }
  if (Array.isArray(patch.days)) {
    for (const d of patch.days) {
      const n = Number(d?.day);
      if (!n) continue;
      const i = days.findIndex((x) => x.day === n);
      if (i >= 0) days[i] = { ...days[i], ...d };
      else days.push(d);
      changed.push(`day ${n}`);
    }
  }
  if (patch.renumber === true) days = days.sort((a, b) => a.day - b.day).map((d, i) => ({ ...d, day: i + 1 }));
  merged.days = days;
  const v = validateItinerary(merged);
  if (!v.ok) return { error: v.errors.join('; ') };
  return { value: v.value, changed };
}

/* ─────────────────────── theme options ─────────────────────── */

const HEX = /^#[0-9a-f]{6}$/i;

export function cleanThemeOptions(raw: unknown): ThemeOptions {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as any;
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(v as T) ? (v as T) : undefined);
  const o: ThemeOptions = {
    primary: HEX.test(r.primary) ? r.primary : undefined,
    secondary: HEX.test(r.secondary) ? r.secondary : undefined,
    font: pick(r.font, ['sans', 'serif', 'mixed'] as const),
    cover: pick(r.cover, ['full', 'compact', 'none'] as const),
    logo: pick(r.logo, ['left', 'center', 'right', 'none'] as const),
    density: pick(r.density, ['comfortable', 'compact'] as const),
    images: pick(r.images, ['cover', 'none'] as const),
    paper: pick(r.paper, ['a4', 'letter'] as const),
    orientation: pick(r.orientation, ['portrait', 'landscape'] as const),
    header: typeof r.header === 'boolean' ? r.header : undefined,
    footer: typeof r.footer === 'boolean' ? r.footer : undefined,
    footerText: str(r.footerText, 160),
  };
  if (r.design && typeof r.design === 'object') {
    const d = r.design;
    const dp: Record<string, unknown> = {};
    if (Number.isFinite(Number(d.seed))) dp.seed = Math.abs(Math.floor(Number(d.seed))) % 2147483647;
    if (MOODS.some((m) => m.key === d.mood)) dp.mood = d.mood;
    if (FONT_PAIRS.some((f) => f.key === d.fonts)) dp.fonts = d.fonts;
    if (d.palette === 'extracted' || PALETTES.some((p) => p.key === d.palette)) dp.palette = d.palette;
    if (COVERS.some((c) => c.key === d.cover)) dp.cover = d.cover;
    if (d.dayStyle === 'mixed' || DAY_STYLES.some((x) => x.key === d.dayStyle)) dp.dayStyle = d.dayStyle;
    if (MOTIFS.some((m) => m.key === d.motif)) dp.motif = d.motif;
    if (d.extracted && HEX.test(d.extracted.primary)) dp.extracted = { primary: d.extracted.primary, accent: HEX.test(d.extracted.accent) ? d.extracted.accent : undefined, source: str(d.extracted.source, 120) || 'photo' };
    (o as any).design = dp;
  }
  if (r.sections && typeof r.sections === 'object') {
    o.sections = {};
    for (const [k, v] of Object.entries(r.sections)) if (typeof v === 'boolean') (o.sections as any)[k] = v;
  }
  for (const k of Object.keys(o) as (keyof ThemeOptions)[]) if (o[k] === undefined) delete o[k];
  return o;
}

export const isThemeKey = (k: unknown): k is (typeof THEMES)[number]['key'] => THEMES.some((t) => t.key === k);

/** Parse a model reply that should be JSON: strips fences, falls back to the outermost {...}. */
export function parseModelJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error('Response was not valid JSON');
  }
}
