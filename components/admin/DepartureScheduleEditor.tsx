'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { DAY_NAMES, formatDeparture, normalizeCustomDates, toDateString, tripDepartures } from '@/lib/recurrence';

/**
 * Admin editor for how a trip departs:
 *  - Single trip: one fixed start/end (handled by the parent page's date fields)
 *  - Multiple departures: weekly rule and/or hand-picked dates, in any combination.
 */
interface Props {
  isMulti: boolean;
  onIsMultiChange: (v: boolean) => void;
  weeklyEnabled: boolean;
  onWeeklyEnabledChange: (v: boolean) => void;
  recurrenceDay: string;
  onRecurrenceDayChange: (v: string) => void;
  weeksAhead: string;
  onWeeksAheadChange: (v: string) => void;
  customDates: string[];
  onCustomDatesChange: (v: string[]) => void;
  durationDays: string;
  onDurationDaysChange: (v: string) => void;
}

const inputCls = 'field';

export default function DepartureScheduleEditor(p: Props) {
  const [pending, setPending] = useState('');
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateString(d); })();

  const addDate = () => {
    if (!pending) return;
    p.onCustomDatesChange(normalizeCustomDates([...p.customDates, pending]));
    setPending('');
  };

  const preview = p.isMulti
    ? tripDepartures({
        is_recurring: true,
        recurrence_day: p.weeklyEnabled ? parseInt(p.recurrenceDay) : null,
        recurrence_weeks_ahead: parseInt(p.weeksAhead) || 4,
        custom_dates: p.customDates,
      })
    : [];

  return (
    <div className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900 mb-2">How does this trip depart?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { v: false, title: '📅 Single trip', desc: 'One fixed start and end date.' },
            { v: true, title: '🔁 Multiple departures', desc: 'Weekly, hand-picked dates, or both. Travellers pick a date when booking.' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={p.isMulti === o.v}
              onClick={() => p.onIsMultiChange(o.v)}
              className={`no-min-touch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 p-3 rounded-lg border-2 transition-all ${p.isMulti === o.v ? 'border-purple-600 bg-white shadow-sm' : 'border-gray-200 bg-white/60 hover:border-purple-300'}`}
            >
              <span className="font-semibold text-gray-900 text-sm">{o.title}</span>
              <p className="text-xs text-gray-600 mt-0.5">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {p.isMulti && (
        <>
          {/* Weekly rule */}
          <div className="rounded-lg bg-white border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={p.weeklyEnabled}
                aria-label="Repeat every week"
                onClick={() => p.onWeeklyEnabledChange(!p.weeklyEnabled)}
                className="switch"
              >
                <span />
              </button>
              <button type="button" onClick={() => p.onWeeklyEnabledChange(!p.weeklyEnabled)} className="no-min-touch font-semibold text-sm text-gray-900">
                Repeat every week
              </button>
            </div>
            {p.weeklyEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Departs every</label>
                  <select value={p.recurrenceDay} onChange={(e) => p.onRecurrenceDayChange(e.target.value)} className={inputCls}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Bookable weeks ahead</label>
                  <input type="number" min="1" max="26" value={p.weeksAhead} onChange={(e) => p.onWeeksAheadChange(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* Custom dates */}
          <div className="rounded-lg bg-white border border-gray-200 p-3">
            <p className="font-semibold text-sm text-gray-900">Pick specific dates</p>
            <p className="text-xs text-gray-500 mb-2">Add any extra departure dates — on their own or on top of the weekly rule.</p>
            <div className="flex gap-2">
              <input
                type="date"
                min={tomorrow}
                value={pending}
                onChange={(e) => setPending(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDate(); } }}
                className={inputCls}
              />
              <button
                type="button"
                onClick={addDate}
                disabled={!pending}
                className="btn btn-primary"
              >
                <Plus /> Add date
              </button>
            </div>
            {p.customDates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {p.customDates.map((d) => {
                  const past = d < tomorrow;
                  return (
                    <span key={d} className={`inline-flex h-7 items-center gap-1 pl-2.5 pr-1 rounded-full text-xs font-medium ${past ? 'bg-gray-100 text-gray-400 line-through' : 'bg-purple-100 text-purple-800'}`}>
                      {formatDeparture(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      <button
                        type="button"
                        aria-label={`Remove ${d}`}
                        title="Remove"
                        onClick={() => p.onCustomDatesChange(p.customDates.filter((x) => x !== d))}
                        className="btn btn-sm btn-icon !h-5 !w-5 !rounded-full hover:bg-purple-200"
                      >
                        <X className="!h-3 !w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Days on trip (sets return date)</label>
              <input type="number" min="1" max="30" value={p.durationDays} onChange={(e) => p.onDurationDaysChange(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            <strong>Days on trip</strong> is used to auto-calculate each return date (departure + {p.durationDays || 'N'} days). The wording travellers see comes from <strong>Duration Display</strong> below. Seats count per departure.
          </p>

          <div className="rounded-lg bg-white border border-dashed border-purple-300 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Travellers will see {preview.length} upcoming date{preview.length === 1 ? '' : 's'}</p>
            {preview.length === 0 ? (
              <p className="text-xs text-red-600">Turn on weekly or add at least one future date.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {preview.slice(0, 20).map((d) => (
                  <span key={d} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">{formatDeparture(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                ))}
                {preview.length > 20 && <span className="text-[11px] text-gray-500">+{preview.length - 20} more</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Validation message for the multi-departure settings, or null when valid. */
export function validateDepartureSchedule(weeklyEnabled: boolean, customDates: string[], durationDays: string): string | null {
  if (!durationDays || parseInt(durationDays) < 1) return 'Please set the trip length in days';
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateString(d); })();
  if (!weeklyEnabled && !customDates.some((d) => d >= tomorrow)) {
    return 'Turn on weekly departures or add at least one future date';
  }
  return null;
}

export { DAY_NAMES };
