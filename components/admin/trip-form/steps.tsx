'use client';

import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Clock, FileText, Plus, Save, Send, Trash2, X } from 'lucide-react';
import DepartureScheduleEditor from '@/components/admin/DepartureScheduleEditor';
import TripAddonsEditor, { type AddonDraft } from '@/components/admin/TripAddonsEditor';
import {
  EARLY_BIRD_LABELS,
  STEPS,
  discountPercent,
  emptyDay,
  fid,
  generateSlug,
  tripDurationDays,
  type EarlyBirdType,
  type Errors,
  type PublishOption,
  type SectionKey,
  type TripFormState,
} from './state';
import { Field, ListEditor, Section, Switch, Thumb, UploadButton, uploadImage, type ToastData } from './ui';

export type Patch = Partial<TripFormState> | ((prev: TripFormState) => Partial<TripFormState>);

export interface StepProps {
  s: TripFormState;
  set: (patch: Patch) => void;
  errors: Errors;
  mode: 'create' | 'edit';
  notify: (t: Omit<ToastData, 'id'>) => void;
  goTo: (step: number) => void;
  originalSlug: string;
  currentParticipants: number;
  /** Draft/schedule/publish choice is shown (always on create; only for unpublished trips on edit). */
  showPublish: boolean;
  liveStatus?: string;
}

export function StepHeading({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="mb-6 border-b border-gray-100 pb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
        Step {step} of {STEPS.length}
      </p>
      <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
      <p className="mt-0.5 text-sm text-gray-500">{description}</p>
    </div>
  );
}

/* ═════════════════════════ 1 · Basics ═════════════════════════ */
export function StepBasics({ s, set, errors, mode, originalSlug }: StepProps) {
  const slugChanged = mode === 'edit' && !!originalSlug && s.slug !== originalSlug;
  return (
    <div className="space-y-5">
      <StepHeading step={1} title="Basics" description="What the trip is called and where it goes." />

      <Field name="title" label="Trip title" required error={errors.title}>
        {(p) => (
          <input
            {...p}
            type="text"
            value={s.title}
            onChange={(e) => {
              const title = e.target.value;
              set(s.slugTouched ? { title } : { title, slug: generateSlug(title) });
            }}
            placeholder="e.g. Manali Snow Adventure"
            className="field"
          />
        )}
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          name="slug"
          label="Trip link"
          error={errors.slug}
          hint={
            slugChanged ? (
              <span className="text-amber-700">
                Changing this breaks links already shared as /trips/{originalSlug}. Links that use the trip ID keep working.
              </span>
            ) : mode === 'create' ? (
              'Filled in from the title. Lowercase letters, numbers and hyphens.'
            ) : !s.slug ? (
              'Empty — the trip link uses its ID.'
            ) : (
              'Lowercase letters, numbers and hyphens.'
            )
          }
        >
          {(p) => (
            <div className="flex h-11 items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100">
              <span className="select-none whitespace-nowrap pl-3.5 pr-0.5 text-sm text-gray-500">/trips/</span>
              <input
                {...p}
                type="text"
                value={s.slug}
                onChange={(e) => set({ slug: generateSlug(e.target.value), slugTouched: true })}
                placeholder="manali-snow-adventure"
                maxLength={80}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm text-gray-900 outline-none"
              />
            </div>
          )}
        </Field>

        <Field name="destination" label="Destination" required error={errors.destination}>
          {(p) => (
            <input
              {...p}
              type="text"
              value={s.destination}
              onChange={(e) => set({ destination: e.target.value })}
              placeholder="e.g. Manali, Himachal Pradesh"
              className="field"
            />
          )}
        </Field>
      </div>

      <Field
        name="shortDescription"
        label="Short description"
        required
        error={errors.shortDescription}
        hint={`Shown on trip cards. ${s.shortDescription.length} characters — around 160 reads best.`}
      >
        {(p) => (
          <textarea
            {...p}
            rows={3}
            value={s.shortDescription}
            onChange={(e) => set({ shortDescription: e.target.value })}
            placeholder="One or two lines that sell the trip…"
            className="field"
          />
        )}
      </Field>

      <Field name="fullDescription" label="Full description" required error={errors.fullDescription} hint="Shown on the trip page.">
        {(p) => (
          <textarea
            {...p}
            rows={8}
            value={s.fullDescription}
            onChange={(e) => set({ fullDescription: e.target.value })}
            placeholder="What travellers can expect, the vibe, special moments…"
            className="field"
          />
        )}
      </Field>
    </div>
  );
}

/* ═════════════════════════ 2 · Pricing ═════════════════════════ */
export function StepPricing({ s, set, errors }: StepProps) {
  const pct = discountPercent(s);
  const addCondition = (type: EarlyBirdType) =>
    set({ earlyBirdConditions: [...s.earlyBirdConditions, { type, value: '' }] });
  const updateCondition = (i: number, value: string) =>
    set({ earlyBirdConditions: s.earlyBirdConditions.map((c, j) => (j === i ? { ...c, value } : c)) });

  return (
    <div className="space-y-5">
      <StepHeading step={2} title="Pricing" description="What the trip costs and how much locks a seat." />

      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="price" label="Original price (₹)" required error={errors.price}>
          {(p) => (
            <input {...p} type="number" inputMode="decimal" min="0" step="1" value={s.price}
              onChange={(e) => set({ price: e.target.value })} placeholder="9999" className="field" />
          )}
        </Field>
        <Field
          name="discountedPrice"
          label="Selling price (₹)"
          required
          error={errors.discountedPrice}
          hint={pct > 0 ? <span className="font-medium text-green-700">{pct}% off the original price</span> : 'What travellers pay.'}
        >
          {(p) => (
            <input {...p} type="number" inputMode="decimal" min="0" step="1" value={s.discountedPrice}
              onChange={(e) => set({ discountedPrice: e.target.value })} placeholder="7999" className="field" />
          )}
        </Field>
        <Field name="seatLockPrice" label="Seat lock (₹)" required error={errors.seatLockPrice} hint="Non-refundable part-payment.">
          {(p) => (
            <input {...p} type="number" inputMode="decimal" min="0" step="1" value={s.seatLockPrice}
              onChange={(e) => set({ seatLockPrice: e.target.value })} placeholder="2000" className="field" />
          )}
        </Field>
      </div>

      <Field
        name="paymentDueDaysBefore"
        label="Balance due (days before departure)"
        optional
        className="sm:max-w-xs"
        hint="Leave empty to use the global setting."
      >
        {(p) => (
          <input {...p} type="number" inputMode="numeric" min="0" step="1" value={s.paymentDueDaysBefore}
            onChange={(e) => set({ paymentDueDaysBefore: e.target.value })} placeholder="Global default" className="field" />
        )}
      </Field>

      <Section
        title="Early bird pricing"
        description="A lower price for early bookers."
        action={
          <button
            type="button"
            role="switch"
            aria-checked={s.earlyBirdEnabled}
            aria-label="Early bird pricing"
            onClick={() => set({ earlyBirdEnabled: !s.earlyBirdEnabled })}
            className="switch"
          >
            <span />
          </button>
        }
      >
        {s.earlyBirdEnabled ? (
          <div className="space-y-4">
            <Field name="earlyBirdPrice" label="Early bird price (₹)" required error={errors.earlyBirdPrice} className="sm:max-w-xs">
              {(p) => (
                <input {...p} type="number" inputMode="decimal" min="0" step="1" value={s.earlyBirdPrice}
                  onChange={(e) => set({ earlyBirdPrice: e.target.value })} className="field" />
              )}
            </Field>

            <div>
              <p className="field-label">Who gets it</p>
              {s.earlyBirdConditions.length > 0 && (
                <div className="mb-3 space-y-2">
                  {s.earlyBirdConditions.map((c, i) => (
                    <div key={i} className="grid items-center gap-2 rounded-xl bg-gray-50 p-2.5 sm:grid-cols-[11rem,1fr,auto]">
                      <span className="text-sm font-medium text-gray-700">{EARLY_BIRD_LABELS[c.type]}</span>
                      {c.type === 'date_range' ? (
                        <div className="flex items-center gap-2">
                          <input type="date" aria-label="From" value={c.value.split('|')[0] || ''}
                            onChange={(e) => updateCondition(i, `${e.target.value}|${c.value.split('|')[1] || ''}`)}
                            className="field min-w-0" />
                          <span className="text-xs text-gray-400">to</span>
                          <input type="date" aria-label="To" value={c.value.split('|')[1] || ''}
                            onChange={(e) => updateCondition(i, `${c.value.split('|')[0] || ''}|${e.target.value}`)}
                            className="field min-w-0" />
                        </div>
                      ) : (
                        <input
                          type={c.type === 'discount_code' ? 'text' : 'number'}
                          min={c.type === 'discount_code' ? undefined : 1}
                          aria-label={EARLY_BIRD_LABELS[c.type]}
                          value={c.value}
                          onChange={(e) => updateCondition(i, e.target.value)}
                          placeholder={c.type === 'discount_code' ? 'Code' : 'Number'}
                          className="field"
                        />
                      )}
                      <button type="button" onClick={() => set({ earlyBirdConditions: s.earlyBirdConditions.filter((_, j) => j !== i) })}
                        className="btn btn-sm btn-icon btn-danger justify-self-end" aria-label="Remove condition" title="Remove">
                        <X />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EARLY_BIRD_LABELS) as EarlyBirdType[]).map((t) => (
                  <button key={t} type="button" onClick={() => addCondition(t)} className="btn btn-sm btn-secondary">
                    <Plus /> {EARLY_BIRD_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Off — everyone pays the selling price.</p>
        )}
      </Section>
    </div>
  );
}

/* ═════════════════════════ 3 · Dates & seats ═════════════════════════ */
export function StepDates({ s, set, errors, mode, currentParticipants }: StepProps) {
  const days = !s.isRecurring ? tripDurationDays(s) : null;
  return (
    <div className="space-y-5">
      <StepHeading step={3} title="Dates & seats" description="When the trip runs, how many can join, and pickup points." />

      <div id={fid('schedule')}>
        <DepartureScheduleEditor
          isMulti={s.isRecurring}
          onIsMultiChange={(v) => set({ isRecurring: v })}
          weeklyEnabled={s.weeklyEnabled}
          onWeeklyEnabledChange={(v) => set({ weeklyEnabled: v })}
          recurrenceDay={s.recurrenceDay}
          onRecurrenceDayChange={(v) => set({ recurrenceDay: v })}
          weeksAhead={s.recurrenceWeeksAhead}
          onWeeksAheadChange={(v) => set({ recurrenceWeeksAhead: v })}
          customDates={s.customDates}
          onCustomDatesChange={(v) => set({ customDates: v })}
          durationDays={s.recurringDurationDays}
          onDurationDaysChange={(v) => set({ recurringDurationDays: v })}
        />
        {errors.schedule && <p className="field-error" role="alert">{errors.schedule}</p>}
      </div>

      {!s.isRecurring && (
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="startDate" label="Start date" required error={errors.startDate}>
            {(p) => <input {...p} type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value })} className="field" />}
          </Field>
          <Field name="endDate" label="End date" required error={errors.endDate} hint={days ? `${days} day${days === 1 ? '' : 's'}` : undefined}>
            {(p) => <input {...p} type="date" value={s.endDate} min={s.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} className="field" />}
          </Field>
          <Field name="bookingDeadline" label="Last day to book" required error={errors.bookingDeadline} hint="Must be before the start date.">
            {(p) => <input {...p} type="date" value={s.bookingDeadline} max={s.startDate || undefined} onChange={(e) => set({ bookingDeadline: e.target.value })} className="field" />}
          </Field>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="maxSeats"
          label="Maximum seats"
          optional
          error={errors.maxSeats}
          hint={mode === 'edit' ? `Empty = no limit. ${currentParticipants} booked so far.` : 'Empty = no limit (travellers see “Spots available”).'}
        >
          {(p) => (
            <input {...p} type="number" inputMode="numeric" min="1" value={s.maxSeats}
              onChange={(e) => set({ maxSeats: e.target.value })} placeholder="No limit" className="field" />
          )}
        </Field>
        <Field name="durationText" label="Duration label" optional hint="How the length is shown, e.g. “4N / 5D”. Empty = worked out from the dates.">
          {(p) => (
            <input {...p} type="text" maxLength={40} value={s.durationText}
              onChange={(e) => set({ durationText: e.target.value })} placeholder="e.g. 4N 5D" className="field" />
          )}
        </Field>
      </div>

      <Section title="Pickup points" description="Travellers choose one when booking. Leave empty if there’s one fixed pickup.">
        <ListEditor
          name="pickupPoints"
          items={s.pickupPoints}
          onChange={(pickupPoints) => set({ pickupPoints })}
          placeholder="e.g. Delhi (ISBT Kashmere Gate)"
          addLabel="Add pickup point"
        />
      </Section>
    </div>
  );
}

/* ═════════════════════════ 4 · Photos ═════════════════════════ */
export function StepPhotos({ s, set, errors, notify }: StepProps) {
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);

  const uploadCover = async (files: File[]) => {
    setCoverBusy(true);
    try {
      const url = await uploadImage(files[0]);
      set({ coverImage: url });
    } catch (e: any) {
      notify({ message: e.message || 'Cover upload failed', tone: 'error' });
    } finally {
      setCoverBusy(false);
    }
  };

  const uploadGallery = async (files: File[]) => {
    setGalleryBusy(true);
    let failed = 0;
    for (const f of files) {
      try {
        const url = await uploadImage(f);
        set((prev) => {
          const filled = prev.galleryImages.filter((x) => x.trim());
          return { galleryImages: [...filled, url] };
        });
      } catch {
        failed++;
      }
    }
    setGalleryBusy(false);
    if (failed) notify({ message: `${failed} of ${files.length} image${files.length === 1 ? '' : 's'} failed to upload`, tone: 'error' });
  };

  const setGallery = (i: number, v: string) => set({ galleryImages: s.galleryImages.map((x, j) => (j === i ? v : x)) });

  return (
    <div className="space-y-5">
      <StepHeading step={4} title="Photos" description="A cover image for cards and the trip page, plus an optional gallery." />

      <Field name="coverImage" label="Cover image" required error={errors.coverImage} hint="Upload a photo or paste an image link. Wide (16:9) photos look best.">
        {(p) => (
          <div className="flex gap-2">
            <input {...p} type="url" value={s.coverImage} onChange={(e) => set({ coverImage: e.target.value })}
              placeholder="https://…" className="field" />
            <UploadButton onFiles={uploadCover} busy={coverBusy} />
          </div>
        )}
      </Field>
      {s.coverImage.trim() && <Thumb src={s.coverImage} alt="Cover preview" className="aspect-[16/9] w-full max-w-xl" />}

      <Section
        title="Gallery"
        description="Shown in the photo carousel on the trip page."
        action={<UploadButton onFiles={uploadGallery} busy={galleryBusy} multiple size="sm" label="Upload images" />}
      >
        <div className="space-y-2">
          {s.galleryImages.map((img, i) => (
            <div key={i} className="flex items-center gap-2">
              {img.trim() ? (
                <Thumb src={img} alt={`Gallery ${i + 1}`} className="h-11 w-11 shrink-0" />
              ) : (
                <div className="h-11 w-11 shrink-0 rounded-lg border border-dashed border-gray-200 bg-gray-50" aria-hidden />
              )}
              <input
                id={i === 0 ? fid('galleryImages') : undefined}
                type="url"
                value={img}
                onChange={(e) => setGallery(i, e.target.value)}
                placeholder="Paste image link"
                aria-label={`Gallery image ${i + 1}`}
                className="field"
              />
              <button type="button" onClick={() => set({ galleryImages: s.galleryImages.filter((_, j) => j !== i) })}
                disabled={s.galleryImages.length <= 1} className="btn btn-sm btn-icon btn-danger" aria-label={`Remove image ${i + 1}`} title="Remove">
                <X />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ galleryImages: [...s.galleryImages, ''] })} className="btn btn-sm btn-add">
            <Plus /> Add image link
          </button>
        </div>
      </Section>
    </div>
  );
}

/* ═════════════════════════ 5 · Itinerary ═════════════════════════ */
export function StepItinerary({ s, set, errors, notify }: StepProps) {
  const renumber = (days: TripFormState['itinerary']) => days.map((d, i) => ({ ...d, day: i + 1 }));

  const updateDay = (i: number, patch: Partial<TripFormState['itinerary'][number]>) =>
    set({ itinerary: s.itinerary.map((d, j) => (j === i ? { ...d, ...patch } : d)) });

  const addDay = () => {
    const n = s.itinerary.length;
    set({ itinerary: [...s.itinerary, emptyDay(n + 1)] });
    setTimeout(() => document.getElementById(fid(`itinerary.${n}.title`))?.focus(), 30);
  };

  const removeDay = (i: number) => {
    const removed = s.itinerary[i];
    set({ itinerary: renumber(s.itinerary.filter((_, j) => j !== i)) });
    notify({
      message: `Day ${i + 1}${removed.title ? ` “${removed.title}”` : ''} removed`,
      actionLabel: 'Undo',
      onAction: () =>
        set((prev) => {
          const next = [...prev.itinerary];
          next.splice(Math.min(i, next.length), 0, removed);
          return { itinerary: renumber(next) };
        }),
    });
  };

  const moveDay = (i: number, dir: -1 | 1) => {
    const next = [...s.itinerary];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    set({ itinerary: renumber(next) });
  };

  return (
    <div className="space-y-5">
      <StepHeading step={5} title="Itinerary" description="Highlights and the day-by-day plan." />

      <Section title="Highlights" description="Short points shown as “What you’ll experience”.">
        <ListEditor
          name="highlights"
          items={s.highlights}
          onChange={(highlights) => set({ highlights })}
          placeholder="e.g. Sunrise at Hampta Pass"
          addLabel="Add highlight"
        />
      </Section>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Day-by-day plan <span className="text-red-500">*</span>
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">Each day needs a title and a description.</p>
        </div>

        {s.itinerary.map((d, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-7 shrink-0 items-center rounded-lg bg-purple-600 px-2.5 text-xs font-bold text-white">Day {i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">{d.title}</span>
              <button type="button" onClick={() => moveDay(i, -1)} disabled={i === 0}
                className="btn btn-sm btn-icon btn-ghost" aria-label={`Move day ${i + 1} up`} title="Move up">
                <ArrowUp />
              </button>
              <button type="button" onClick={() => moveDay(i, 1)} disabled={i === s.itinerary.length - 1}
                className="btn btn-sm btn-icon btn-ghost" aria-label={`Move day ${i + 1} down`} title="Move down">
                <ArrowDown />
              </button>
              <button type="button" onClick={() => removeDay(i)} disabled={s.itinerary.length <= 1}
                className="btn btn-sm btn-danger" aria-label={`Remove day ${i + 1}`}>
                <Trash2 /> <span className="hidden sm:inline">Remove</span>
              </button>
            </div>

            <div className="space-y-4">
              <Field name={`itinerary.${i}.title`} label="Title" required error={errors[`itinerary.${i}.title`]}>
                {(p) => (
                  <input {...p} type="text" value={d.title} onChange={(e) => updateDay(i, { title: e.target.value })}
                    placeholder="e.g. Arrival & Old Manali walk" className="field" />
                )}
              </Field>
              <Field name={`itinerary.${i}.description`} label="Description" required error={errors[`itinerary.${i}.description`]}>
                {(p) => (
                  <textarea {...p} rows={3} value={d.description} onChange={(e) => updateDay(i, { description: e.target.value })}
                    placeholder="What happens on this day…" className="field" />
                )}
              </Field>
              <div>
                <p className="field-label">
                  Activities <span className="font-normal text-gray-400">(optional)</span>
                </p>
                <ListEditor
                  name={`itinerary.${i}.activities`}
                  items={d.activities.length ? d.activities : ['']}
                  onChange={(activities) => updateDay(i, { activities })}
                  placeholder="e.g. Bonfire at camp"
                  addLabel="Add activity"
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={addDay} className="btn btn-add">
          <Plus /> Add day {s.itinerary.length + 1}
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════ 6 · Extras & publish ═════════════════════════ */
const SECTION_TOGGLES: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'photos', label: 'Photo carousel', desc: 'Swipeable gallery at the top' },
  { key: 'itinerary', label: 'Day-by-day plan', desc: 'Timeline of activities' },
  { key: 'highlights', label: 'Highlights', desc: 'What you’ll experience' },
  { key: 'perks', label: 'Free perks banner', desc: 'Purple promo banner' },
  { key: 'included', label: 'Included / not included', desc: 'Two-column list' },
];

const PUBLISH_OPTIONS: { v: PublishOption; title: string; desc: string; icon: ReactNode }[] = [
  { v: 'draft', title: 'Save as draft', desc: 'Only admins can see it', icon: <FileText className="h-4 w-4" /> },
  { v: 'now', title: 'Publish now', desc: 'Live on the site right away', icon: <Send className="h-4 w-4" /> },
  { v: 'schedule', title: 'Schedule', desc: 'Goes live at a set time', icon: <Clock className="h-4 w-4" /> },
];

export function StepExtras(props: StepProps & { onAddonRemoved: (d: AddonDraft, index: number) => void }) {
  const { s, set, errors, goTo, showPublish, liveStatus, mode, currentParticipants, onAddonRemoved } = props;
  const days = tripDurationDays(s);
  const pct = discountPercent(s);
  const count = (arr: string[]) => arr.filter((x) => x.trim()).length;
  const today = new Date().toISOString().split('T')[0];

  const rows: { label: string; value: ReactNode; step: number }[] = [
    { label: 'Title', value: s.title || '—', step: 1 },
    { label: 'Destination', value: s.destination || '—', step: 1 },
    { label: 'Price', value: s.discountedPrice ? <>₹{s.discountedPrice}{pct > 0 && <span className="ml-1 text-green-700">({pct}% off)</span>}</> : '—', step: 2 },
    { label: 'Seat lock', value: s.seatLockPrice ? `₹${s.seatLockPrice}` : '—', step: 2 },
    ...(s.earlyBirdEnabled ? [{ label: 'Early bird', value: s.earlyBirdPrice ? `₹${s.earlyBirdPrice}` : '—', step: 2 }] : []),
    { label: 'Departures', value: s.isRecurring ? 'Multiple dates' : s.startDate ? `${s.startDate} → ${s.endDate || '?'}` : '—', step: 3 },
    { label: 'Duration', value: s.durationText || (days ? `${days} day${days === 1 ? '' : 's'}` : '—'), step: 3 },
    { label: 'Seats', value: (s.maxSeats || 'No limit') + (mode === 'edit' ? ` · ${currentParticipants} booked` : ''), step: 3 },
    { label: 'Photos', value: `${s.coverImage ? 'Cover' : 'No cover'} + ${count(s.galleryImages)} in gallery`, step: 4 },
    { label: 'Itinerary', value: `${s.itinerary.length} day${s.itinerary.length === 1 ? '' : 's'} · ${count(s.highlights)} highlights`, step: 5 },
  ];

  return (
    <div className="space-y-5">
      <StepHeading step={6} title="Extras & publish" description="Optional extras, what the page shows, then review and publish." />

      <Section title="WhatsApp group" description="Shared with travellers only after their booking is confirmed (not for seat locks or pending bookings).">
        <Field name="whatsappGroupLink" label="Group invite link" optional>
          {(p) => (
            <input {...p} type="url" value={s.whatsappGroupLink} onChange={(e) => set({ whatsappGroupLink: e.target.value })}
              placeholder="https://chat.whatsapp.com/…" className="field" />
          )}
        </Field>
      </Section>

      <Section title="Free perks" description="Shown prominently, e.g. “Free bike rental for the first 10 bookings” or “Groups of 5+ get ₹500 off”." tone="tinted">
        <ListEditor name="freePerks" items={s.freePerks} onChange={(freePerks) => set({ freePerks })}
          placeholder="e.g. Free welcome drink on arrival" addLabel="Add perk" />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="What’s included">
          <ListEditor name="includedItems" items={s.includedItems} onChange={(includedItems) => set({ includedItems })}
            placeholder="e.g. Stay, breakfast, guide" addLabel="Add included item" />
        </Section>
        <Section title="Not included">
          <ListEditor name="excludedItems" items={s.excludedItems} onChange={(excludedItems) => set({ excludedItems })}
            placeholder="e.g. Lunch, personal expenses" addLabel="Add excluded item" />
        </Section>
      </div>

      <TripAddonsEditor
        enabled={s.addonsEnabled}
        drafts={s.addonDrafts}
        onEnabledChange={(addonsEnabled) => set({ addonsEnabled })}
        onDraftsChange={(addonDrafts) => set({ addonDrafts })}
        onRemove={onAddonRemoved}
        tripDurationDays={days || 3}
      />

      <Section title="Show on trip page" description="Choose which sections travellers see.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SECTION_TOGGLES.map((t) => (
            <Switch
              key={t.key}
              checked={s.showSections[t.key]}
              onChange={(v) => set({ showSections: { ...s.showSections, [t.key]: v } })}
              label={t.label}
              description={t.desc}
            />
          ))}
        </div>
      </Section>

      <Section title="Review" description="Check the key details. Use Edit to jump to a step.">
        <dl className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-1.5">
              <dt className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-28">{r.label}</dt>
              <dd className="min-w-0 flex-1 truncate text-sm text-gray-900">{r.value}</dd>
              <button type="button" onClick={() => goTo(r.step)} className="btn btn-sm btn-ghost">Edit</button>
            </div>
          ))}
        </dl>
      </Section>

      {showPublish ? (
        <Section title={mode === 'create' ? 'Publish' : 'Visibility'} description="Choose what happens when you save.">
          <div role="radiogroup" aria-label="Publish option" className="grid gap-2 sm:grid-cols-3">
            {PUBLISH_OPTIONS.map((o) => {
              const active = s.publishOption === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set({ publishOption: o.v })}
                  className={`no-min-touch flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    active ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {o.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{o.title}</span>
                    <span className="block text-xs text-gray-500">{o.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {s.publishOption === 'schedule' && (
            <div className="mt-4 grid gap-4 sm:max-w-md sm:grid-cols-2">
              <Field name="scheduledDate" label="Publish date" required error={errors.scheduledDate}>
                {(p) => <input {...p} type="date" min={today} value={s.scheduledDate} onChange={(e) => set({ scheduledDate: e.target.value })} className="field" />}
              </Field>
              <Field name="scheduledTime" label="Time" required error={errors.scheduledTime}>
                {(p) => <input {...p} type="time" value={s.scheduledTime} onChange={(e) => set({ scheduledTime: e.target.value })} className="field" />}
              </Field>
            </div>
          )}
        </Section>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <Save className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p>
            This trip is <strong className="text-gray-900">{liveStatus || 'live'}</strong>. Saving updates it in place. To complete,
            cancel or postpone it, use the actions on the trips list.
          </p>
        </div>
      )}
    </div>
  );
}
