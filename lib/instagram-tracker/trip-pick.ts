/**
 * Which trips go into a "trip cards" reply, and what each card says.
 * Pure code (no server imports): the engine, the preview endpoint and the
 * scenario checks all use it, so the preview shows exactly what gets sent.
 */
import { normalise } from './rules-core';

export interface TripRow {
  id: string; slug: string | null; title: string; destination: string | null;
  price: number; old_price: number; duration: string; description: string | null;
  start_date: string | null; image: string | null; featured: boolean; bookable: boolean; created_at: string;
}

export type TripPick = 'auto' | 'match' | 'selected';
export type TripSort = 'featured' | 'cheapest' | 'newest' | 'soonest';
export type TripField = 'price' | 'old_price' | 'duration' | 'place' | 'description' | 'date';

export interface TripOptions {
  trips_limit?: number;
  trip_button?: string;
  /** auto = upcoming trips · match = only trips named in the message (or the post) · selected = these trips */
  trip_pick?: TripPick;
  trip_ids?: string[];
  /** match found nothing: send upcoming trips instead, or only the text */
  trip_fallback?: 'auto' | 'text';
  trip_sort?: TripSort;
  /** what the card's second line shows, in this order */
  trip_fields?: TripField[];
  /** a second button on every card (fixed link) */
  trip_extra_button?: { title: string; url: string } | null;
}

export const DEFAULT_FIELDS: TripField[] = ['price', 'duration', 'place'];
export const MAX_CARDS = 10;

/** Words that name a trip: from its title and destination, minus generic travel words. */
const STOP = new Set(['trip', 'trips', 'trek', 'tour', 'tours', 'package', 'weekend', 'escape', 'special', 'valley', 'india', 'pradesh', 'days', 'nights',
  'night', 'and', 'with', 'the', 'new', 'year', 'christmas', 'dham', 'group', 'getaway', 'camp', 'camping', 'from', 'delhi', 'state']);
export function tripTerms(t: Pick<TripRow, 'title' | 'destination'>) {
  return Array.from(new Set(normalise(`${t.title} ${t.destination || ''}`).split(' ')
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w))));
}

const has = (msg: string, w: string) => ` ${msg} `.includes(` ${w} `) || (w.length >= 5 && msg.includes(w));

/** Trips the message names, best match first (score = how many of the trip's words appear). */
export function matchTrips<T extends Pick<TripRow, 'title' | 'destination'>>(trips: T[], text: string) {
  const msg = normalise(text || '');
  if (!msg) return [];
  return trips
    .map((t) => {
      const terms = tripTerms(t);
      // the trip's own title words count double — "kasol" should prefer "Manali Kasol Escape" over a trip that only lists Himachal
      const titleTerms = new Set(tripTerms({ title: t.title, destination: '' }));
      const score = terms.reduce((s, w) => s + (has(msg, w) ? (titleTerms.has(w) ? 2 : 1) : 0), 0);
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

export function sortTrips(trips: TripRow[], sort: TripSort = 'featured') {
  const by = {
    featured: (a: TripRow, b: TripRow) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at),
    cheapest: (a: TripRow, b: TripRow) => (a.price || Infinity) - (b.price || Infinity),
    newest: (a: TripRow, b: TripRow) => b.created_at.localeCompare(a.created_at),
    soonest: (a: TripRow, b: TripRow) => (a.start_date || '9999').localeCompare(b.start_date || '9999') || Number(b.featured) - Number(a.featured),
  }[sort] || (() => 0);
  return [...trips].sort(by);
}

/**
 * The trips to send.
 * `context` = the person's message, plus (for comments) the post caption.
 */
export function chooseTrips(all: TripRow[], o: TripOptions, context: string): { trips: TripRow[]; matched: boolean } {
  const limit = Math.min(MAX_CARDS, Math.max(1, Number(o.trips_limit) || 5));
  if (o.trip_pick === 'selected') {
    const byId = new Map(all.map((t) => [t.id, t]));
    return { trips: (o.trip_ids || []).map((id) => byId.get(id)).filter(Boolean).slice(0, limit) as TripRow[], matched: false };
  }
  const open = all.filter((t) => t.bookable);
  if (o.trip_pick === 'match') {
    // Sorted first, so trips with the same score follow the chosen order.
    const hits = matchTrips(sortTrips(open, o.trip_sort), context);
    if (hits.length) return { trips: hits.slice(0, limit), matched: true };
    if (o.trip_fallback === 'text') return { trips: [], matched: false };
  }
  return { trips: sortTrips(open, o.trip_sort).slice(0, limit), matched: false };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Second line of a card (≤ 80 characters), built from the chosen fields. */
export function tripSubtitle(t: TripRow, fields: TripField[] = DEFAULT_FIELDS) {
  const bits: string[] = [];
  for (const f of fields) {
    if (f === 'price' && t.price) bits.push(`From ${inr(t.price)}`);
    if (f === 'old_price' && t.old_price && t.old_price > t.price) bits.push(`was ${inr(t.old_price)}`);
    if (f === 'duration' && t.duration) bits.push(t.duration);
    if (f === 'place' && t.destination) bits.push(t.destination.split(',')[0].trim());
    if (f === 'date' && t.start_date) bits.push(new Date(`${t.start_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    if (f === 'description' && t.description) bits.push(t.description.replace(/\s+/g, ' ').trim());
  }
  return clip(bits.join(' · '), 80);
}

export const tripUrl = (t: Pick<TripRow, 'slug' | 'id'>, siteUrl: string) => `${siteUrl.replace(/\/$/, '')}/trips/${t.slug || t.id}`;
