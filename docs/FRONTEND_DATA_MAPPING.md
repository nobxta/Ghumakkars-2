# Frontend Data Mapping — Trip Detail Page

Page: `app/trips/[id]/page.tsx` · Route: `/trips/{slug}` (e.g. `/trips/manali-kasol-escape`)
Source of truth: `public.trips` table (Supabase) + admin trip creator (`app/admin/trips/create/page.tsx`).

> **Golden rule:** Admin enters **content**. Frontend decides **presentation**.
> Backend stores raw values (plain strings, numbers, dates, arrays). The frontend
> owns every icon, color, gradient, badge, font size, animation, and layout.

Legend: **Static** = permanently designed in frontend · **Dynamic** = comes from backend ·
**Optional** = may be empty/null · **Empty State** = what renders when missing.

---

## SECTION: Trip Hero
**Static**
- Hero/cover layout, aspect ratio, rounded corners
- Gradient overlay on the image
- Discount badge shape/color (`% OFF` pill)
- Back button, breadcrumb, share button
- Gallery thumbnail strip layout

**Dynamic**
- `title` — trip name
- `destination` — location label
- `cover_image_url` (falls back to `image_url`) — hero image
- `gallery_images[]` — thumbnail strip
- `discount_percentage` — badge number

**Optional**
- `cover_image_url`, `gallery_images`, `discount_percentage`

**Empty State**
- No image → frontend placeholder (gradient block + trip initials/icon), **never a broken `<img>`**
- `discount_percentage = 0` or null → **badge hidden** (no "0% OFF")
- No gallery → thumbnail strip hidden

**Frontend Rules**
- Location always shown with the location icon (frontend-owned)
- Discount badge only renders when `discount_percentage > 0`
- Backend provides the number `25`; frontend renders "`25% OFF`" with styling

---

## SECTION: Quick Facts Bar (duration · group size · dates)
**Static**
- Clock / People / Calendar icons
- Chip layout, separators, typography

**Dynamic**
- `duration_text` (override) **or** `duration_days` → duration label
- `max_participants` → group size
- `start_date`/`end_date`, or for recurring: `is_recurring` + `recurrence_day` + `recurrence_weeks_ahead` → date label
- `max_participants − current_participants` → seats available

**Optional**
- `duration_text`, `max_participants`, `start_date`/`end_date`

**Empty State**
- No `max_participants` → treated as **unlimited** (hide the "X spots left" line or show "Open group")
- No dates + not recurring → hide the date chip
- `duration_text` empty → frontend builds "`3 days`" from `duration_days`

**Frontend Rules**
- Duration always shows with the clock icon
- Group size always shows with the people icon
- Backend only provides `duration_days: 3`; frontend renders "`3 days`" + icon
- ⚠️ `duration_text` is a free-text override — see **Risks** below

---

## SECTION: Short Description (subtitle)
**Static** — typography, max-width, spacing
**Dynamic** — `short_description`
**Optional** — yes
**Empty State** — section hidden if empty
**Frontend Rules** — plain text only; no markdown/HTML rendered

---

## SECTION: About / Full Description
**Static** — "About this trip" heading, layout, read-more behavior
**Dynamic** — `full_description` (falls back to `description`)
**Optional** — yes
**Empty State** — section hidden if both empty
**Frontend Rules** — render as paragraphs; backend stores plain text, frontend handles line breaks/spacing

---

## SECTION: Bonus Perks ("Book now and get free")
**Static**
- Purple→indigo gradient card, blur orb, "BONUS PERKS INCLUDED" heading
- Sparkles icon, yellow accent, check bullets

**Dynamic** — `free_perks[]` (array of plain strings)
**Optional** — yes (also gated by `display_sections.perks`)
**Empty State** — entire gradient card hidden when array empty
**Frontend Rules**
- ✅ Already correct: backend stores `["Free trek guide", "Bonfire night"]`; frontend draws the check icon + gradient
- Admin should **never** add ✨/🔥 — the frontend supplies the icon

---

## SECTION: Trip Highlights
**Static** — "Trip highlights" heading, 2-col grid, Sparkles chip per item
**Dynamic** — `highlights[]`
**Optional** — yes (gated by `display_sections.highlights`)
**Empty State** — section hidden when empty
**Frontend Rules**
- Backend: `{ "highlight": "Solang Valley" }` → Frontend: `[icon] Solang Valley`
- Admin enters the place/experience name only

---

## SECTION: What's In & What's Not (Included / Excluded)
**Static** — two cards (green "Included" / gray "Not included"), Check/X icons, headings
**Dynamic** — `included_features[]`, `excluded_features[]`
**Optional** — both
**Empty State** — whole section hidden if both empty; each card hidden independently
**Frontend Rules** — ✅ already correct (icons are frontend-owned; admin enters plain strings)

---

## SECTION: Day-wise Itinerary
**Static** — timeline/accordion design, day badges, connectors
**Dynamic** — `day_wise_itinerary` (jsonb array of `{ day, title, description, ... }`)
**Optional** — yes (gated by `display_sections.itinerary`)
**Empty State** — section hidden when empty
**Frontend Rules** — timeline visuals are frontend; backend stores structured day objects only

---

## SECTION: Photo Gallery
**Static** — grid/lightbox layout
**Dynamic** — `gallery_images[]` (filtered for truthy URLs)
**Optional** — yes (gated by `display_sections.photos`)
**Empty State** — section hidden when no valid images
**Frontend Rules** — frontend handles cropping/lazy-load; backend stores URLs

---

## SECTION: Pickup & Booking Deadline
**Static** — labels, MapPin icon, divider
**Dynamic** — `pickup_points[]`, `booking_deadline_date`
**Optional** — both
**Empty State** — block hidden if both missing
**Frontend Rules** — pickup joined with `·`; deadline formatted by frontend (admin stores a raw date)

---

## SECTION: Booking / Pricing Card (sticky sidebar)
**Static** — card design, CTA buttons, "per person", strikethrough style, seats meter
**Dynamic**
- `discounted_price` (primary, large type)
- `original_price` (strikethrough)
- `discount_percentage`
- `early_bird_price` + `early_bird_conditions` (conditional discount)
- `seat_lock_price` (partial-payment option)
- `payment_due_days_before` (remaining-payment deadline)
- seats: `max_participants − current_participants`
- `booking_disabled`, `status` (gates the CTA)

**Optional** — `original_price`, `early_bird_*`, `seat_lock_price`
**Empty State**
- No `original_price` or equal to discounted → hide strikethrough + % off
- No `seat_lock_price` → hide the "Lock your seat" option
- Sold out / `booking_disabled` / non-active `status` → CTA becomes disabled state

**Frontend Rules**
- Price always uses the large typography + ₹ formatting (frontend), backend stores the raw number `12998`
- Frontend computes % off if needed; never trust admin to keep it in sync (see Risks)

---

## SECTION: Status / Lifecycle States
**Static** — banner styles (cancelled/completed/postponed/sold-out)
**Dynamic** — `status`, `is_active`, `show_on_user_side`, `booking_disabled`, `cancellation_reason`, `postponed_to_date`, `completed_at`
**Empty State** — normal trip = no banner
**Frontend Rules** — frontend maps each status to a banner + CTA behavior; backend only stores the state value/reason text

---

## SECTION: Post-booking / WhatsApp
**Dynamic** — `whatsapp_group_link`
**Frontend Rules** — shown only after booking; frontend owns the WhatsApp icon/button

---

# FINAL FIELD TABLE

| Field Name | Backend Value (`trips`) | Frontend Display | Required | Optional |
|---|---|---|---|---|
| Trip Name | `title` | Hero heading | ✅ | |
| Slug | `slug` | URL only | ✅ | |
| Location | `destination` | Location icon + text | ✅ | |
| Short tagline | `short_description` | Subtitle | | ✅ |
| About | `full_description` / `description` | Paragraphs | | ✅ |
| Hero image | `cover_image_url` / `image_url` | Hero with gradient overlay | | ✅ (placeholder) |
| Gallery | `gallery_images[]` | Thumbnail grid / lightbox | | ✅ |
| Price | `discounted_price` | Large ₹ typography | ✅ | |
| Original price | `original_price` | Strikethrough | ✅ | |
| Discount % | `discount_percentage` | `% OFF` badge | | ✅ |
| Early-bird price | `early_bird_price` (+`early_bird_conditions`) | Conditional price | | ✅ |
| Seat-lock price | `seat_lock_price` | "Lock your seat" option | | ✅ |
| Payment deadline | `payment_due_days_before` | "Pay rest N days before" | | ✅ |
| Duration | `duration_days` (+`duration_text`) | Clock icon + label | ✅ | |
| Start time / End time | `trip_start_time` / `trip_end_time` | Time chips | | ✅ |
| Group size | `max_participants` | People icon + number | | ✅ (unlimited) |
| Seats left | `max_participants − current_participants` | Seats meter | | ✅ |
| Trip dates | `start_date` / `end_date` | Calendar chip | | ✅ |
| Recurring schedule | `is_recurring`, `recurrence_day`, `recurrence_weeks_ahead` | "Every Friday" + date picker | | ✅ |
| Booking deadline | `booking_deadline_date` | Deadline line | | ✅ |
| Pickup points | `pickup_points[]` | Pickup list w/ MapPin | | ✅ |
| Highlights | `highlights[]` | Icon chips | | ✅ |
| Included | `included_features[]` | Green check list | | ✅ |
| Excluded | `excluded_features[]` | Gray X list | | ✅ |
| Bonus perks | `free_perks[]` | Gradient perks card | | ✅ |
| Itinerary | `day_wise_itinerary` (jsonb) | Timeline / accordion | | ✅ |
| Section toggles | `display_sections` (jsonb) | Show/hide sections | | ✅ |
| WhatsApp group | `whatsapp_group_link` | Post-booking button | | ✅ |
| Status | `status`, `is_active`, `booking_disabled`, `show_on_user_side` | Banners + CTA gating | ✅ | |
| Cancellation reason | `cancellation_reason` | Cancelled banner text | | ✅ |
| Postponed date | `postponed_to_date` | Postponed banner | | ✅ |

---

# MISSING FIELDS (recommended additions for a premium frontend)

These are **content** fields a premium trip page needs that the `trips` table does **not** have today:

| Suggested column | Type | Why | Frontend renders as |
|---|---|---|---|
| `faq` | `jsonb` `[{q, a}]` | **No FAQ field exists** despite being core content | Accordion (frontend owns the design) |
| `tags` / `category` | `text[]` | Filtering + premium chips ("Mountains", "Weekend") | Styled tag pills |
| `difficulty` | `text` enum (easy/moderate/hard) | Trust + filtering | Icon + label |
| `best_season` | `text` | Premium info bar | Calendar/leaf icon + label |
| `altitude_m` | `integer` | Mountain trips love this | "↑ 3,978 m" stat |
| `things_to_carry` | `text[]` | Reduces support questions | Checklist section |
| `meeting_point` / `map_lat`,`map_lng` | `numeric` | Embedded map | Map pin (frontend map widget) |
| `host_name` / `host_bio` / `host_image` | `text` | Trust ("Led by …") | Host card |
| `reviews` / rating | table or `jsonb` | Social proof | Star rating + cards |
| `policy_cancellation` | `text` | Per-trip refund terms | Policy accordion |

Itinerary enrichment (inside `day_wise_itinerary` objects): add structured `meals`, `stay`, `activities[]`, `distance_km`, `transport` — so the timeline can render rich rows instead of one description blob.

---

# RISKS — where presentation is leaking into the CMS (fix these)

The codebase mostly follows the golden rule (icons/gradients are frontend-owned). Watch these:

1. **Free-text fields accept emojis / ALL-CAPS / symbols.** `title`, `highlights[]`, `free_perks[]`, `included_features[]` are plain strings — an admin can paste 🔥/✨/®. **Fix:** sanitize on save (strip emoji, collapse whitespace) and/or normalize casing in the frontend. The frontend already supplies the icon, so emojis are redundant noise.
2. **`duration_text` is a free-text override of `duration_days`.** Leads to "3D/2N" vs "3 Days 2 Nights" inconsistency. **Fix:** prefer structured `duration_days` (+ optional `nights`); compute the label in the frontend. Keep `duration_text` only as a rare manual override.
3. **`discount_percentage` is stored separately from prices.** Can drift out of sync with `original_price`/`discounted_price`. **Fix:** compute `% off` in the frontend from the two prices; treat the stored column as display-only/auto-filled.
4. **`display_sections` (jsonb toggles) is a layout decision living in the CMS.** Acceptable (it's visibility, not styling), but keep it to **show/hide** booleans only — never let it carry colors, order, or component choices.
5. **`early_bird_conditions` (jsonb) is logic config in the CMS.** Fine, but document the schema so admins enter data, not behavior.

**Rule of thumb to enforce going forward:** the trip creator form must only ever ask for *words, numbers, dates, image files, and on/off toggles*. The moment it asks an admin to pick an emoji, color, badge style, font size, or card layout, move that decision into the frontend component.
