import { CONTACT } from '@/lib/contact';
import type { DesignPrefs } from './design';

/**
 * AI Itinerary Studio — shared types and static config.
 * Safe to import from both client components and server code (no Node APIs).
 */

/* ─────────────────────────── trip details state ─────────────────────────── */

/** Structured trip-details state. Source of truth for generation. All optional. */
export interface TripDetails {
  tripName?: string;
  destination?: string;
  startLocation?: string;
  endLocation?: string;
  durationDays?: number;
  durationNights?: number;
  startDate?: string;
  endDate?: string;
  pickup?: string;
  drop?: string;
  travellers?: string;
  audience?: string;
  transport?: string;
  accommodation?: string;
  meals?: string;
  dayPlans?: { day: number; notes: string }[];
  sightseeing?: string;
  activities?: string;
  inclusions?: string;
  exclusions?: string;
  pricing?: string;
  budget?: string;
  payment?: string;
  terms?: string;
  cancellation?: string;
  contact?: string;
  notes?: string;
  branding?: string;
  themePreference?: string;
  layoutPreference?: string;
}

export type TripFieldKey = keyof TripDetails;

export const TRIP_FIELDS: { key: TripFieldKey; label: string; group: string; kind: 'text' | 'long' | 'number' | 'days' }[] = [
  { key: 'tripName', label: 'Trip name', group: 'Basics', kind: 'text' },
  { key: 'destination', label: 'Destination', group: 'Basics', kind: 'text' },
  { key: 'durationDays', label: 'Days', group: 'Basics', kind: 'number' },
  { key: 'durationNights', label: 'Nights', group: 'Basics', kind: 'number' },
  { key: 'startDate', label: 'Start date', group: 'Basics', kind: 'text' },
  { key: 'endDate', label: 'End date', group: 'Basics', kind: 'text' },
  { key: 'travellers', label: 'Travellers', group: 'Basics', kind: 'text' },
  { key: 'audience', label: 'Audience', group: 'Basics', kind: 'text' },
  { key: 'startLocation', label: 'Starts from', group: 'Logistics', kind: 'text' },
  { key: 'endLocation', label: 'Ends at', group: 'Logistics', kind: 'text' },
  { key: 'pickup', label: 'Pickup', group: 'Logistics', kind: 'text' },
  { key: 'drop', label: 'Drop-off', group: 'Logistics', kind: 'text' },
  { key: 'transport', label: 'Transport', group: 'Logistics', kind: 'long' },
  { key: 'accommodation', label: 'Accommodation', group: 'Logistics', kind: 'long' },
  { key: 'meals', label: 'Meals', group: 'Logistics', kind: 'text' },
  { key: 'dayPlans', label: 'Day-by-day notes', group: 'Plan', kind: 'days' },
  { key: 'sightseeing', label: 'Sightseeing', group: 'Plan', kind: 'long' },
  { key: 'activities', label: 'Activities', group: 'Plan', kind: 'long' },
  { key: 'inclusions', label: 'Inclusions', group: 'Package', kind: 'long' },
  { key: 'exclusions', label: 'Exclusions', group: 'Package', kind: 'long' },
  { key: 'pricing', label: 'Package pricing', group: 'Package', kind: 'long' },
  { key: 'budget', label: 'Budget', group: 'Package', kind: 'text' },
  { key: 'payment', label: 'Payment info', group: 'Package', kind: 'long' },
  { key: 'terms', label: 'Booking terms', group: 'Policies', kind: 'long' },
  { key: 'cancellation', label: 'Cancellation policy', group: 'Policies', kind: 'long' },
  { key: 'contact', label: 'Contact / emergency', group: 'Policies', kind: 'long' },
  { key: 'notes', label: 'Important notes', group: 'Policies', kind: 'long' },
  { key: 'branding', label: 'Branding', group: 'Design', kind: 'text' },
  { key: 'themePreference', label: 'Theme preference', group: 'Design', kind: 'text' },
  { key: 'layoutPreference', label: 'Layout preference', group: 'Design', kind: 'text' },
];

export const TRIP_FIELD_KEYS = TRIP_FIELDS.map((f) => f.key);

export interface MissingField {
  field: string;
  question: string;
  essential: boolean;
}

/* ─────────────────────────── itinerary document ─────────────────────────── */

export type ActivityStatus = 'included' | 'optional' | 'suggested';

export interface ItineraryActivity {
  time?: string;
  title: string;
  description?: string;
  status: ActivityStatus;
}

export interface ItineraryDay {
  day: number;
  title: string;
  date?: string;
  route?: string;
  summary?: string;
  activities: ItineraryActivity[];
  meals?: string[];
  stay?: string;
  transport?: string;
  notes?: string;
}

export interface ItineraryStay {
  location?: string;
  name?: string;
  category?: string;
  nights?: string;
  notes?: string;
  /** Only true when the admin supplied a specific confirmed property. */
  confirmed: boolean;
}

export interface ItineraryTransport {
  mode: string;
  details?: string;
  confirmed: boolean;
}

export interface ItineraryPrice {
  label: string;
  amount?: number;
  basis?: string;
  note?: string;
}

export interface Itinerary {
  title: string;
  subtitle?: string;
  destination: string;
  durationLabel?: string;
  dates?: string;
  startLocation?: string;
  endLocation?: string;
  travellers?: string;
  audience?: string;
  pickup?: string;
  drop?: string;
  overview?: string;
  highlights: string[];
  days: ItineraryDay[];
  stays: ItineraryStay[];
  transport: ItineraryTransport[];
  inclusions: string[];
  exclusions: string[];
  pricing: ItineraryPrice[];
  pricingNote?: string;
  paymentTerms: string[];
  cancellationPolicy: string[];
  importantNotes: string[];
  thingsToCarry: string[];
  contact?: { name?: string; phone?: string; email?: string; website?: string; emergency?: string };
  assumptions: string[];
}

/* ─────────────────────────── themes ─────────────────────────── */

export type ThemeKey = 'signature' | 'corporate' | 'luxury' | 'adventure' | 'nature' | 'magazine';

export interface ThemeOptions {
  primary?: string;
  secondary?: string;
  font?: 'sans' | 'serif' | 'mixed';
  cover?: 'full' | 'compact' | 'none';
  logo?: 'left' | 'center' | 'right' | 'none';
  density?: 'comfortable' | 'compact';
  images?: 'cover' | 'none';
  paper?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  header?: boolean;
  footer?: boolean;
  footerText?: string;
  sections?: Partial<Record<SectionKey, boolean>>;
  /** Per-itinerary design (mood, fonts, palette, cover …). Unset fields are chosen by the generator. */
  design?: DesignPrefs;
}

export type SectionKey =
  | 'overview' | 'highlights' | 'days' | 'stays' | 'transport' | 'inclusions'
  | 'pricing' | 'payment' | 'cancellation' | 'notes' | 'carry' | 'contact' | 'assumptions';

export const SECTION_LABELS: Record<SectionKey, string> = {
  overview: 'Trip overview',
  highlights: 'Highlights',
  days: 'Day-by-day itinerary',
  stays: 'Accommodation',
  transport: 'Transport',
  inclusions: 'Inclusions & exclusions',
  pricing: 'Package pricing',
  payment: 'Payment terms',
  cancellation: 'Cancellation policy',
  notes: 'Important notes',
  carry: 'Things to carry',
  contact: 'Contact & booking',
  assumptions: 'Assumptions & suggestions',
};

export interface ThemeDef {
  key: ThemeKey;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  ink: string;
  muted: string;
  paper: string;
  tint: string;
  font: 'sans' | 'serif' | 'mixed';
  cover: 'full' | 'compact' | 'none';
  coverStyle: 'band' | 'split' | 'editorial' | 'diagonal' | 'frame' | 'photo';
}

export const THEMES: ThemeDef[] = [
  { key: 'signature', name: 'Ghumakkars Signature', description: 'White pages, violet accents. Premium and clean.', primary: '#7C3AED', secondary: '#8B5CF6', ink: '#1E1B2E', muted: '#6B6880', paper: '#FFFFFF', tint: '#F5F1FF', font: 'sans', cover: 'full', coverStyle: 'band' },
  { key: 'corporate', name: 'Minimal Corporate', description: 'Restrained styling, elegant typography.', primary: '#1F2937', secondary: '#64748B', ink: '#111827', muted: '#6B7280', paper: '#FFFFFF', tint: '#F3F4F6', font: 'sans', cover: 'compact', coverStyle: 'split' },
  { key: 'luxury', name: 'Luxury Travel', description: 'Editorial layout with a refined serif hierarchy.', primary: '#1C1917', secondary: '#B08D57', ink: '#1C1917', muted: '#78716C', paper: '#FFFDF8', tint: '#F6F0E4', font: 'serif', cover: 'full', coverStyle: 'frame' },
  { key: 'adventure', name: 'Adventure', description: 'Bold, energetic and outdoor-ready.', primary: '#EA580C', secondary: '#0F172A', ink: '#0F172A', muted: '#57534E', paper: '#FFFFFF', tint: '#FFF4EC', font: 'sans', cover: 'full', coverStyle: 'diagonal' },
  { key: 'nature', name: 'Nature Escape', description: 'Earthy greens and calm, scenic spacing.', primary: '#3F6212', secondary: '#A16207', ink: '#1A2E05', muted: '#5B6B4C', paper: '#FCFCF7', tint: '#F1F5E8', font: 'mixed', cover: 'full', coverStyle: 'band' },
  { key: 'magazine', name: 'Modern Magazine', description: 'Photo-led editorial pages.', primary: '#BE123C', secondary: '#111827', ink: '#111827', muted: '#6B7280', paper: '#FFFFFF', tint: '#FFF1F2', font: 'mixed', cover: 'full', coverStyle: 'photo' },
];

export const themeByKey = (k?: string | null): ThemeDef => THEMES.find((t) => t.key === k) || THEMES[0];

/* ─────────────────────────── models ─────────────────────────── */

export interface ModelConfig {
  key: string;
  displayName: string;
  /** Exact id sent to the provider. */
  apiId: string;
  multiplier: number;
  /** Only verified models can be used. */
  verified: boolean;
  enabled: boolean;
  supportsPriority: boolean;
  recommended: string;
}

export const DEFAULT_MODELS: ModelConfig[] = [
  { key: 'gpt-6-luna', displayName: 'GPT 6 Luna', apiId: 'gpt-6-luna', multiplier: 0.8, verified: true, enabled: true, supportsPriority: false, recommended: 'Default. Fast, low cost — chat and most itineraries.' },
  { key: 'gpt-6-sol', displayName: 'GPT 6 Sol', apiId: 'gpt-6-sol', multiplier: 3.8, verified: false, enabled: false, supportsPriority: false, recommended: 'Richer writing for premium itineraries.' },
  { key: 'gpt-6-astra', displayName: 'GPT 6 Astra', apiId: 'gpt-6-astra', multiplier: 11.25, verified: false, enabled: false, supportsPriority: false, recommended: 'Most capable. Use sparingly — very expensive.' },
  { key: 'gpt-6.1-terra', displayName: 'GPT 6.1 Terra', apiId: 'gpt-6.1-terra', multiplier: 1.5, verified: false, enabled: false, supportsPriority: false, recommended: 'Balanced quality and cost.' },
  { key: 'gpt-6.1-sol', displayName: 'GPT 6.1 Sol', apiId: 'gpt-6.1-sol', multiplier: 4, verified: false, enabled: false, supportsPriority: false, recommended: 'High quality long itineraries.' },
  { key: 'gpt-5.6-luna', displayName: 'GPT 5.6 Luna', apiId: 'gpt-5.6-luna', multiplier: 0.9, verified: false, enabled: false, supportsPriority: false, recommended: 'Low cost fallback.' },
  { key: 'gpt-5.6-terra', displayName: 'GPT 5.6 Terra', apiId: 'gpt-5.6-terra', multiplier: 1.5, verified: false, enabled: false, supportsPriority: false, recommended: 'Balanced fallback.' },
  { key: 'gpt-5.6-sol', displayName: 'GPT 5.6 Sol', apiId: 'gpt-5.6-sol', multiplier: 4.5, verified: false, enabled: false, supportsPriority: false, recommended: 'High quality fallback.' },
];

/* ─────────────────────────── settings ─────────────────────────── */

export interface StudioSettings {
  ai: {
    defaultModel: string;
    temperature: number | null;
    maxOutputTokens: number;
    chatMaxOutputTokens: number;
    askQuestions: 'essential' | 'helpful' | 'never';
    autoGenerateWhenReady: boolean;
    retryLimit: number;
    jsonMode: boolean;
    historyMessages: number;
    /** Block requests whose estimate exceeds the estimated remaining allowance. */
    blockWhenInsufficient: boolean;
    warnAboveWeighted: number;
  };
  pricing: {
    models: ModelConfig[];
    cachedInputMultiplier: number;
    priorityMultiplier: number;
    allowanceTokens: number;
    allowanceSetAt: string | null;
  };
  pdf: {
    defaultTheme: ThemeKey;
    defaultOptions: ThemeOptions;
    companyName: string;
    tagline: string;
    contactPerson: string;
    phone: string;
    whatsapp: string;
    email: string;
    website: string;
    instagram: string;
    address: string;
    /** Set when a custom logo is uploaded (cache-buster); null = site logo (public/logo.png). */
    logoVersion: string | null;
  };
  references: {
    maxFileMB: number;
    maxFilesPerProject: number;
    allowedTypes: string[];
    maxCharsPerReference: number;
    retentionDays: number;
  };
  advanced: {
    timeoutMs: number;
    baseUrl: string;
    dataRetentionDays: number;
    staleJobMinutes: number;
  };
}

export const DEFAULT_SETTINGS: StudioSettings = {
  ai: {
    defaultModel: 'gpt-6-luna',
    temperature: null,
    maxOutputTokens: 8000,
    chatMaxOutputTokens: 1500,
    askQuestions: 'essential',
    autoGenerateWhenReady: false,
    retryLimit: 2,
    jsonMode: true,
    historyMessages: 10,
    blockWhenInsufficient: true,
    warnAboveWeighted: 20000,
  },
  pricing: {
    models: DEFAULT_MODELS,
    cachedInputMultiplier: 0.4,
    priorityMultiplier: 2,
    allowanceTokens: 5_000_000,
    allowanceSetAt: null,
  },
  pdf: {
    defaultTheme: 'signature',
    defaultOptions: {
      cover: 'full', logo: 'left', density: 'comfortable', images: 'cover', paper: 'a4', orientation: 'portrait',
      header: true, footer: true,
    },
    companyName: CONTACT.brandName,
    tagline: 'Travel with your tribe',
    contactPerson: '',
    phone: CONTACT.phoneDisplay,
    whatsapp: CONTACT.phoneDisplay,
    email: CONTACT.contactEmail,
    website: CONTACT.domain,
    instagram: '@' + CONTACT.instagram.replace(/\/$/, '').split('/').pop(),
    address: CONTACT.address,
    logoVersion: null,
  },
  references: {
    maxFileMB: 10,
    maxFilesPerProject: 8,
    allowedTypes: ['application/pdf', 'text/plain', 'text/markdown'],
    maxCharsPerReference: 12000,
    retentionDays: 0,
  },
  advanced: {
    timeoutMs: 120000,
    baseUrl: 'https://codex.sale/v1',
    dataRetentionDays: 0,
    staleJobMinutes: 10,
  },
};

/* ─────────────────────────── API shapes ─────────────────────────── */

export type ProjectStatus = 'new' | 'collecting' | 'clarifying' | 'ready' | 'generating' | 'pdf_ready' | 'editing' | 'failed';

export interface ProjectRow {
  id: string;
  title: string;
  destination: string | null;
  duration_label: string | null;
  status: ProjectStatus;
  trip_details: TripDetails;
  locked_fields: string[];
  missing_fields: MissingField[];
  itinerary: Itinerary | null;
  itinerary_dirty: boolean;
  theme: ThemeKey;
  theme_options: ThemeOptions;
  model: string | null;
  current_version_id: string | null;
  is_final: boolean;
  last_error: string | null;
  weighted_tokens: number;
  raw_tokens: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  project_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta: MessageMeta;
  client_id: string | null;
  created_at: string;
}

export interface MessageMeta {
  intent?: string;
  model?: string;
  attachments?: { id: string; filename: string }[];
  missing?: MissingField[];
  suggestions?: string[];
  conflicts?: { field: string; current: unknown; proposed: unknown }[];
  error?: { code: string; message: string; retryable: boolean };
  versionNo?: number;
  usage?: { input?: number | null; output?: number | null; weighted?: number | null };
  changed?: string[];
}

export interface VersionRow {
  id: string;
  project_id: string;
  version_no: number;
  source: string;
  label: string | null;
  theme: ThemeKey;
  theme_options: ThemeOptions;
  pdf_path: string | null;
  pdf_size: number | null;
  page_count: number | null;
  model: string | null;
  is_final: boolean;
  created_at: string;
  itinerary?: Itinerary;
}

export interface ReferenceRow {
  id: string;
  project_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  purpose: ReferencePurpose;
  status: 'processing' | 'ready' | 'failed';
  page_count: number | null;
  error: string | null;
  created_at: string;
  preview?: string | null;
  kind?: 'document' | 'image';
  image_role?: ImageRole | null;
  image_day?: number | null;
  caption?: string | null;
  meta?: { width?: number; height?: number; palette?: { primary: string; accent?: string } | null };
}

export type ImageRole = 'auto' | 'cover' | 'day' | 'gallery' | 'exclude';
export const IMAGE_ROLES: { key: ImageRole; label: string }[] = [
  { key: 'auto', label: 'Auto place' }, { key: 'cover', label: 'Cover photo' }, { key: 'day', label: 'A specific day' },
  { key: 'gallery', label: 'Gallery page' }, { key: 'exclude', label: 'Don’t use in PDF' },
];

export type ReferencePurpose = 'auto' | 'extract' | 'structure' | 'design' | 'compare' | 'rewrite' | 'terms' | 'new_from_old' | 'photo';

export const REFERENCE_PURPOSES: { key: ReferencePurpose; label: string; hint: string }[] = [
  { key: 'auto', label: 'Let AI decide', hint: 'The assistant infers the purpose and confirms if unclear.' },
  { key: 'extract', label: 'Extract trip details', hint: 'Pull destination, dates, prices, stays into Trip Details.' },
  { key: 'structure', label: 'Reuse day-by-day structure', hint: 'Follow its day plan and section order.' },
  { key: 'new_from_old', label: 'New itinerary from this PDF', hint: 'Rebuild it as a fresh Ghumakkars itinerary.' },
  { key: 'rewrite', label: 'Rewrite / improve', hint: 'Keep the facts, improve the writing.' },
  { key: 'terms', label: 'Inclusions, exclusions & terms', hint: 'Reuse its lists and policies.' },
  { key: 'compare', label: 'Compare', hint: 'Compare against the current itinerary.' },
  { key: 'design', label: 'Design reference', hint: 'Its colours and style guide the design (layout is not copied).' },
];

export interface JobRow {
  id: string;
  project_id: string;
  kind: string;
  status: 'running' | 'succeeded' | 'failed';
  stage: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

/** Stages surfaced to the UI while a job runs. */
export const STAGE_LABELS: Record<string, string> = {
  thinking: 'Reading your message',
  generating: 'Writing the itinerary',
  editing: 'Applying your changes',
  validating: 'Checking the itinerary',
  repairing: 'Fixing the itinerary format',
  rendering: 'Rendering the PDF',
  saving: 'Saving',
};

/* ─────────────────────────── helpers ─────────────────────────── */

export function weightedTokens(
  u: { input: number; output: number; cached: number | null },
  multiplier: number,
  cachedMultiplier: number,
  priorityFactor = 1
): number {
  const cached = Math.max(0, Math.min(u.cached ?? 0, u.input));
  const fresh = u.input - cached;
  return Math.round((fresh * multiplier + cached * multiplier * cachedMultiplier + u.output * multiplier) * priorityFactor * 100) / 100;
}

export function fmtTokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

export function durationLabelOf(t: Pick<TripDetails, 'durationDays' | 'durationNights'>): string | null {
  const d = Number(t.durationDays) || 0;
  const n = t.durationNights != null ? Number(t.durationNights) : d > 0 ? d - 1 : 0;
  if (!d) return null;
  return `${d} Day${d === 1 ? '' : 's'} / ${n} Night${n === 1 ? '' : 's'}`;
}

/** Deterministic readiness: can a sensible draft be generated right now? */
export function canGenerate(t: TripDetails): boolean {
  const hasDest = !!(t.destination && t.destination.trim());
  const hasLength = (Number(t.durationDays) || 0) > 0 || (t.dayPlans?.length || 0) > 0;
  return hasDest && hasLength;
}
