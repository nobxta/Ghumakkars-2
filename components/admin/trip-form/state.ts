import { type AddonDraft, draftFromRow } from '@/components/admin/TripAddonsEditor';
import { validateDepartureSchedule } from '@/components/admin/DepartureScheduleEditor';
import { normalizeCustomDates } from '@/lib/recurrence';

export interface DayItinerary {
  day: number;
  title: string;
  description: string;
  activities: string[];
}

export type EarlyBirdType = 'date_range' | 'user_limit' | 'first_bookings' | 'discount_code';
export interface EarlyBirdCondition {
  type: EarlyBirdType;
  value: string;
}

export const EARLY_BIRD_LABELS: Record<EarlyBirdType, string> = {
  date_range: 'Bookings between dates',
  user_limit: 'First N users',
  first_bookings: 'First N bookings',
  discount_code: 'Users with discount code',
};

export type SectionKey = 'photos' | 'itinerary' | 'highlights' | 'perks' | 'included';
export type PublishOption = 'draft' | 'now' | 'schedule';

export interface TripFormState {
  // 1 · Basics
  title: string;
  slug: string;
  slugTouched: boolean;
  destination: string;
  shortDescription: string;
  fullDescription: string;
  // 2 · Pricing
  price: string;
  discountedPrice: string;
  seatLockPrice: string;
  paymentDueDaysBefore: string;
  earlyBirdEnabled: boolean;
  earlyBirdPrice: string;
  earlyBirdConditions: EarlyBirdCondition[];
  // 3 · Dates & seats
  isRecurring: boolean;
  startDate: string;
  endDate: string;
  bookingDeadline: string;
  weeklyEnabled: boolean;
  recurrenceDay: string;
  recurrenceWeeksAhead: string;
  customDates: string[];
  recurringDurationDays: string;
  maxSeats: string;
  durationText: string;
  pickupPoints: string[];
  // 4 · Photos
  coverImage: string;
  galleryImages: string[];
  // 5 · Itinerary
  highlights: string[];
  itinerary: DayItinerary[];
  // 6 · Extras & publish
  whatsappGroupLink: string;
  freePerks: string[];
  includedItems: string[];
  excludedItems: string[];
  showSections: Record<SectionKey, boolean>;
  addonsEnabled: boolean;
  addonDrafts: AddonDraft[];
  publishOption: PublishOption;
  scheduledDate: string;
  scheduledTime: string;
}

export const emptyDay = (day: number): DayItinerary => ({ day, title: '', description: '', activities: [''] });

export function emptyState(): TripFormState {
  return {
    title: '', slug: '', slugTouched: false, destination: '', shortDescription: '', fullDescription: '',
    price: '', discountedPrice: '', seatLockPrice: '', paymentDueDaysBefore: '',
    earlyBirdEnabled: false, earlyBirdPrice: '', earlyBirdConditions: [],
    isRecurring: false, startDate: '', endDate: '', bookingDeadline: '',
    weeklyEnabled: true, recurrenceDay: '5', recurrenceWeeksAhead: '4', customDates: [], recurringDurationDays: '3',
    maxSeats: '', durationText: '', pickupPoints: [''],
    coverImage: '', galleryImages: [''],
    highlights: [''], itinerary: [emptyDay(1)],
    whatsappGroupLink: '', freePerks: [''], includedItems: [''], excludedItems: [''],
    showSections: { photos: true, itinerary: true, highlights: true, perks: true, included: true },
    addonsEnabled: false, addonDrafts: [],
    publishOption: 'draft', scheduledDate: '', scheduledTime: '',
  };
}

export const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const list = (v: unknown): string[] => (Array.isArray(v) && v.length > 0 ? v.map((x) => String(x ?? '')) : ['']);
const str = (v: unknown) => (v == null ? '' : String(v));
const dateOnly = (v: unknown) => (v ? String(v).slice(0, 10) : '');

/** Trip DB row (+ its add-on rows) → form state. */
export function stateFromRow(row: any, addonRows: any[]): TripFormState {
  const base = emptyState();
  const eb = row.early_bird_conditions && typeof row.early_bird_conditions === 'object' ? row.early_bird_conditions : null;
  const scheduled = row.scheduled_publish_at ? new Date(row.scheduled_publish_at) : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const itinerary: DayItinerary[] =
    Array.isArray(row.day_wise_itinerary) && row.day_wise_itinerary.length > 0
      ? row.day_wise_itinerary.map((d: any, i: number) => ({
          day: i + 1,
          title: str(d?.title),
          description: str(d?.description),
          activities: list(d?.activities),
        }))
      : base.itinerary;

  return {
    ...base,
    title: str(row.title),
    slug: str(row.slug),
    slugTouched: true, // never auto-rewrite an existing trip's URL
    destination: str(row.destination),
    shortDescription: str(row.short_description || row.description),
    fullDescription: str(row.full_description || row.description),
    price: str(row.original_price),
    discountedPrice: str(row.discounted_price),
    seatLockPrice: str(row.seat_lock_price),
    paymentDueDaysBefore: str(row.payment_due_days_before),
    earlyBirdEnabled: !!row.early_bird_price,
    earlyBirdPrice: str(row.early_bird_price),
    earlyBirdConditions: Array.isArray(eb?.conditions)
      ? eb.conditions.map((c: any) => ({ type: c.type as EarlyBirdType, value: str(c.value) }))
      : [],
    isRecurring: !!row.is_recurring,
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    bookingDeadline: dateOnly(row.booking_deadline_date),
    weeklyEnabled: row.recurrence_day != null || !(row.custom_dates?.length),
    recurrenceDay: row.recurrence_day != null ? String(row.recurrence_day) : base.recurrenceDay,
    recurrenceWeeksAhead: row.recurrence_weeks_ahead != null ? String(row.recurrence_weeks_ahead) : base.recurrenceWeeksAhead,
    customDates: normalizeCustomDates(row.custom_dates),
    recurringDurationDays: row.duration_days != null ? String(row.duration_days) : base.recurringDurationDays,
    maxSeats: str(row.max_participants),
    durationText: str(row.duration_text),
    pickupPoints: list(row.pickup_points),
    coverImage: str(row.cover_image_url || row.image_url),
    galleryImages: list(row.gallery_images),
    highlights: list(row.highlights),
    itinerary,
    whatsappGroupLink: str(row.whatsapp_group_link),
    freePerks: list(row.free_perks),
    includedItems: list(row.included_features),
    excludedItems: list(row.excluded_features),
    showSections: { ...base.showSections, ...(row.display_sections || {}) },
    addonsEnabled: !!row.addons_enabled,
    addonDrafts: addonRows.map((r) => draftFromRow(r)),
    publishOption: row.status === 'scheduled' ? 'schedule' : row.status === 'draft' || (!row.status && !row.is_active) ? 'draft' : 'now',
    scheduledDate: scheduled ? `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}` : '',
    scheduledTime: scheduled ? `${pad(scheduled.getHours())}:${pad(scheduled.getMinutes())}` : '',
  };
}

/** Serialised form for dirty-checking (ignores purely visual add-on expand state). */
export function snapshot(s: TripFormState): string {
  return JSON.stringify({ ...s, addonDrafts: s.addonDrafts.map(({ _expanded, ...d }) => d) });
}

const daysBetween = (a: string, b: string) =>
  Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;

/** Trip length in days, or null when not yet known. */
export function tripDurationDays(s: TripFormState): number | null {
  if (s.isRecurring) return parseInt(s.recurringDurationDays) || null;
  if (s.startDate && s.endDate) return Math.max(1, daysBetween(s.startDate, s.endDate));
  return null;
}

export function discountPercent(s: TripFormState): number {
  const o = parseFloat(s.price);
  const d = parseFloat(s.discountedPrice);
  if (!o || isNaN(d) || o <= 0) return 0;
  return Math.round(((o - d) / o) * 100);
}

const clean = (arr: string[]) => arr.map((x) => x.trim()).filter(Boolean);
const orNull = <T,>(arr: T[]) => (arr.length > 0 ? arr : null);

/** Fields shared by create and edit. */
export function tripPayload(s: TripFormState) {
  const durationDays = tripDurationDays(s) || 1;
  const ebPrice = s.earlyBirdEnabled && s.earlyBirdPrice ? parseFloat(s.earlyBirdPrice) : null;
  return {
    title: s.title.trim(),
    slug: s.slug.trim() || null,
    short_description: s.shortDescription,
    full_description: s.fullDescription,
    description: s.shortDescription,
    destination: s.destination.trim(),
    original_price: parseFloat(s.price),
    discounted_price: parseFloat(s.discountedPrice),
    discount_percentage: discountPercent(s),
    seat_lock_price: parseFloat(s.seatLockPrice),
    payment_due_days_before: s.paymentDueDaysBefore.trim() === '' ? null : parseInt(s.paymentDueDaysBefore, 10) || null,
    early_bird_price: ebPrice,
    early_bird_conditions: ebPrice
      ? { enabled: true, price: ebPrice, conditions: s.earlyBirdConditions.map((c) => ({ type: c.type, value: c.value })) }
      : null,
    duration_days: durationDays,
    duration_text: s.durationText.trim() || null,
    max_participants: s.maxSeats ? parseInt(s.maxSeats) : null,
    // Recurring trips have no fixed start/end — departures are per-booking.
    start_date: s.isRecurring ? null : s.startDate,
    end_date: s.isRecurring ? null : s.endDate,
    booking_deadline_date: s.isRecurring ? null : s.bookingDeadline,
    is_recurring: s.isRecurring,
    recurrence_day: s.isRecurring && s.weeklyEnabled ? parseInt(s.recurrenceDay) : null,
    recurrence_weeks_ahead: s.isRecurring ? parseInt(s.recurrenceWeeksAhead) || 4 : 4,
    custom_dates: s.isRecurring ? normalizeCustomDates(s.customDates) : [],
    pickup_points: orNull(clean(s.pickupPoints)),
    cover_image_url: s.coverImage.trim(),
    image_url: s.coverImage.trim(),
    gallery_images: orNull(clean(s.galleryImages)),
    highlights: orNull(clean(s.highlights)),
    day_wise_itinerary: s.itinerary.map((d, i) => ({
      day: i + 1,
      title: d.title.trim(),
      description: d.description.trim(),
      activities: clean(d.activities),
    })),
    whatsapp_group_link: s.whatsappGroupLink.trim() || null,
    free_perks: clean(s.freePerks),
    included_features: clean(s.includedItems),
    excluded_features: orNull(clean(s.excludedItems)),
    display_sections: s.showSections,
    addons_enabled: s.addonsEnabled,
  };
}

/** Status columns for the chosen publish option. */
export function publishPayload(s: TripFormState) {
  return {
    status: s.publishOption === 'draft' ? 'draft' : s.publishOption === 'schedule' ? 'scheduled' : 'active',
    is_active: s.publishOption === 'now',
    scheduled_publish_at:
      s.publishOption === 'schedule' && s.scheduledDate && s.scheduledTime
        ? new Date(`${s.scheduledDate}T${s.scheduledTime}`).toISOString()
        : null,
  };
}

// ───────────────────────── Validation ─────────────────────────

export const STEPS = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Pricing' },
  { num: 3, label: 'Dates & seats' },
  { num: 4, label: 'Photos' },
  { num: 5, label: 'Itinerary' },
  { num: 6, label: 'Extras & publish' },
] as const;

export type Errors = Record<string, string>;

/** DOM id for a field key, so errors can scroll to / focus it. */
export const fid = (key: string) => `tf-${key.replace(/\./g, '-')}`;

const num = (v: string) => parseFloat(v);

export function validateStep(step: number, s: TripFormState): Errors {
  const e: Errors = {};
  switch (step) {
    case 1:
      if (!s.title.trim()) e.title = 'Give the trip a title';
      if (!s.destination.trim()) e.destination = 'Where is this trip going?';
      if (!s.shortDescription.trim()) e.shortDescription = 'Add a short description for the trip cards';
      if (!s.fullDescription.trim()) e.fullDescription = 'Add the full description for the trip page';
      break;
    case 2:
      if (!s.price) e.price = 'Enter the original price';
      else if (num(s.price) <= 0) e.price = 'Price must be more than 0';
      if (!s.discountedPrice) e.discountedPrice = 'Enter the selling price';
      if (!s.seatLockPrice) e.seatLockPrice = 'Enter the seat lock amount';
      else if (s.discountedPrice && num(s.seatLockPrice) >= num(s.discountedPrice))
        e.seatLockPrice = 'Seat lock amount must be less than the selling price';
      if (s.earlyBirdEnabled && !s.earlyBirdPrice) e.earlyBirdPrice = 'Enter the early bird price, or turn early bird off';
      break;
    case 3:
      if (s.isRecurring) {
        const err = validateDepartureSchedule(s.weeklyEnabled, s.customDates, s.recurringDurationDays);
        if (err) e.schedule = err;
      } else {
        if (!s.startDate) e.startDate = 'Pick the start date';
        if (!s.endDate) e.endDate = 'Pick the end date';
        else if (s.startDate && s.endDate < s.startDate) e.endDate = 'End date can’t be before the start date';
        if (!s.bookingDeadline) e.bookingDeadline = 'Pick the last day to book';
        else if (s.startDate && s.bookingDeadline >= s.startDate) e.bookingDeadline = 'Booking deadline must be before the start date';
      }
      if (s.maxSeats && parseInt(s.maxSeats) < 1) e.maxSeats = 'Seats must be at least 1, or leave empty';
      break;
    case 4:
      if (!s.coverImage.trim()) e.coverImage = 'Add a cover image';
      break;
    case 5:
      s.itinerary.forEach((d, i) => {
        if (!d.title.trim()) e[`itinerary.${i}.title`] = `Day ${i + 1} needs a title`;
        if (!d.description.trim()) e[`itinerary.${i}.description`] = `Day ${i + 1} needs a description`;
      });
      break;
    case 6:
      if (s.publishOption === 'schedule') {
        if (!s.scheduledDate) e.scheduledDate = 'Pick a publish date';
        if (!s.scheduledTime) e.scheduledTime = 'Pick a publish time';
      }
      break;
  }
  return e;
}

export function validateAll(s: TripFormState): Record<number, Errors> {
  const out: Record<number, Errors> = {};
  for (const { num: n } of STEPS) out[n] = validateStep(n, s);
  return out;
}
