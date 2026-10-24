/**
 * Shared shape + validation for the admin Contacts address book (table: admin_contacts).
 */

export const CONTACT_CATEGORIES = [
  'hotel', 'transport', 'driver', 'guide', 'captain', 'food', 'partner', 'emergency', 'other',
] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export interface AdminContact {
  id: string;
  name: string;
  category: ContactCategory;
  company: string | null;
  phone: string | null;
  alt_phone: string | null;
  whatsapp: boolean;
  email: string | null;
  location: string | null;
  address: string | null;
  map_url: string | null;
  rates: string | null;
  rating: number | null;
  trip_ids: string[];
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * Validate a create/update body. Returns only known fields; `partial` allows
 * leaving fields out (PATCH). Returns { error } for invalid input.
 */
export function cleanContactInput(
  body: any,
  partial = false
): { data: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request' };
  const data: Record<string, unknown> = {};
  const has = (key: string) => body[key] !== undefined;

  if (!partial || has('name')) {
    const name = text(body.name, 120);
    if (!name) return { error: 'Name is required' };
    data.name = name;
  }
  if (has('category')) {
    if (!CONTACT_CATEGORIES.includes(body.category)) return { error: 'Unknown category' };
    data.category = body.category;
  }

  const textFields: [string, number][] = [
    ['company', 120], ['phone', 30], ['alt_phone', 30], ['email', 200], ['location', 120],
    ['address', 400], ['rates', 300], ['notes', 4000],
  ];
  for (const [key, max] of textFields) if (has(key)) data[key] = text(body[key], max);

  if (has('email') && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
    return { error: 'Email address looks wrong' };
  }
  if (has('map_url')) {
    const url = text(body.map_url, 500);
    if (url && !/^https?:\/\//i.test(url)) return { error: 'Map link must start with https://' };
    data.map_url = url;
  }
  if (has('rating')) {
    const rating = body.rating === null || body.rating === '' ? null : Number(body.rating);
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      return { error: 'Rating must be 1 to 5' };
    }
    data.rating = rating;
  }
  if (has('trip_ids')) {
    if (!Array.isArray(body.trip_ids)) return { error: 'Invalid trips' };
    data.trip_ids = body.trip_ids.filter((id: unknown) => typeof id === 'string' && UUID.test(id)).slice(0, 50);
  }
  if (has('whatsapp')) data.whatsapp = Boolean(body.whatsapp);
  if (has('is_favorite')) data.is_favorite = Boolean(body.is_favorite);

  return { data };
}

/** Digits for wa.me / tel: links; assumes India (+91) for 10-digit numbers. */
export function phoneDigits(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}
