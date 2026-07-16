'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { formatDeparture, nextOccurrences } from '@/lib/recurrence';
import {
  computeSelections,
  formatINR,
  usesPassengerSelection,
  usesQuantity,
  withRequiredSelections,
  type AddonSelection,
  type TripAddon,
} from '@/lib/addons';

type OfflineTrip = {
  id: string;
  title: string;
  destination?: string | null;
  discounted_price?: number | string | null;
  seat_lock_price?: number | string | null;
  duration_days?: number | string | null;
  is_recurring?: boolean | null;
  recurrence_day?: number | null;
  recurrence_weeks_ahead?: number | null;
  pickup_points?: string[] | null;
  addons_enabled?: boolean | null;
  booking_disabled?: boolean | null;
  status?: string | null;
};

type PassengerDraft = {
  pid: string;
  name: string;
  age: string;
  gender: string;
  phone: string;
};

const makePassenger = (index: number): PassengerDraft => ({
  pid: index === 0 ? 'primary' : `offline_${index}`,
  name: '',
  age: '',
  gender: '',
  phone: '',
});

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100';
const labelClass = 'mb-1 block text-xs font-semibold text-gray-700';

export default function OfflineBookingForm({
  initialTrip,
  lockTrip = false,
  onCreated,
}: {
  initialTrip?: OfflineTrip | null;
  lockTrip?: boolean;
  onCreated?: () => void | Promise<void>;
}) {
  const [trips, setTrips] = useState<OfflineTrip[]>(initialTrip ? [initialTrip] : []);
  const [tripId, setTripId] = useState(initialTrip?.id || '');
  const [addons, setAddons] = useState<TripAddon[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(!initialTrip && !lockTrip);
  const [submitting, setSubmitting] = useState(false);
  const [participants, setParticipants] = useState(1);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([makePassenger(0)]);
  const [departureDate, setDepartureDate] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [paymentOption, setPaymentOption] = useState<'full' | 'seat_lock'>('full');
  const [paymentState, setPaymentState] = useState<'paid' | 'partial' | 'unpaid'>('partial');
  const [amountPaid, setAmountPaid] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [addonSelections, setAddonSelections] = useState<AddonSelection[]>([]);

  useEffect(() => {
    if (initialTrip) {
      setTrips((current) => current.some((t) => t.id === initialTrip.id) ? current : [initialTrip, ...current]);
      setTripId(initialTrip.id);
      return;
    }
    let alive = true;
    setLoadingTrips(true);
    fetch('/api/admin/trips', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (!alive) return;
        const list = (payload.trips || []) as OfflineTrip[];
        setTrips(list);
        if (!tripId && list[0]) setTripId(list[0].id);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingTrips(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrip?.id]);

  const selectedTrip = trips.find((t) => t.id === tripId) || initialTrip || null;
  const paxIds = passengers.map((p) => p.pid);
  const finalSelections = useMemo(
    () => withRequiredSelections(addons, addonSelections, paxIds),
    [addons, addonSelections, paxIds.join('|')],
  );
  const addonEstimate = useMemo(() => computeSelections(
    addons,
    finalSelections,
    { paxCount: participants, tripDurationDays: Number(selectedTrip?.duration_days) || 1 },
  ), [addons, finalSelections, participants, selectedTrip?.duration_days]);

  const baseTotal = Math.max(0, (Number(selectedTrip?.discounted_price) || 0) * participants);
  const addonsTotal = addonEstimate.errors.length ? 0 : addonEstimate.total;
  const grandTotal = baseTotal + addonsTotal;
  const paid = paymentState === 'paid' ? grandTotal : paymentState === 'unpaid' ? 0 : Math.min(Math.max(0, Number(amountPaid) || 0), grandTotal);
  const remaining = Math.max(0, grandTotal - paid);

  useEffect(() => {
    if (!tripId) return;
    setAddonSelections([]);
    setPickupPoint('');
    setDepartureDate('');
    fetch(`/api/admin/trips/${tripId}/addons`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => setAddons((payload.addons || []) as TripAddon[]))
      .catch(() => setAddons([]));
  }, [tripId]);

  useEffect(() => {
    if (paymentState === 'paid') setAmountPaid(String(Math.round(grandTotal)));
    if (paymentState === 'unpaid') setAmountPaid('0');
  }, [paymentState, grandTotal]);

  const setParticipantCount = (value: number) => {
    const next = Math.max(1, value || 1);
    setParticipants(next);
    setPassengers((current) => Array.from({ length: next }, (_, i) => current[i] || makePassenger(i)));
    setAddonSelections((current) => current.map((s) => s.passenger_ids ? { ...s, passenger_ids: s.passenger_ids.filter((pid) => passengers.some((p, i) => i < next && p.pid === pid)) } : s));
  };

  const updatePassenger = (index: number, patch: Partial<PassengerDraft>) => {
    setPassengers((current) => current.map((p, i) => i === index ? { ...p, ...patch } : p));
  };

  const toggleAddon = (addon: TripAddon) => {
    setAddonSelections((current) => {
      if (current.some((s) => s.addon_id === addon.id)) return current.filter((s) => s.addon_id !== addon.id);
      const selection: AddonSelection = usesQuantity(addon.pricing_method)
        ? { addon_id: addon.id, quantity: Math.max(1, Number(addon.min_quantity) || 1) }
        : usesPassengerSelection(addon.pricing_method)
          ? { addon_id: addon.id, passenger_ids: [] }
          : { addon_id: addon.id };
      return [...current, selection];
    });
  };

  const updateAddon = (addonId: string, patch: Partial<AddonSelection>) => {
    setAddonSelections((current) => current.map((s) => s.addon_id === addonId ? { ...s, ...patch } : s));
  };

  const reset = () => {
    setParticipants(1);
    setPassengers([makePassenger(0)]);
    setDepartureDate('');
    setPickupPoint('');
    setPaymentOption('full');
    setPaymentState('partial');
    setAmountPaid('');
    setEmergencyName('');
    setEmergencyPhone('');
    setNotes('');
    setAddonSelections([]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTrip) return alert('Choose a trip.');
    const lead = passengers[0];
    if (!lead.name.trim() || !lead.phone.trim()) return alert('Lead passenger name and mobile are required.');
    if (selectedTrip.is_recurring && !departureDate) return alert('Choose a departure batch.');
    if (addonEstimate.errors.length) return alert(addonEstimate.errors[0]);
    if (paymentState === 'partial' && paid <= 0) return alert('Enter the amount collected, or choose Not paid yet.');

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/trips/${selectedTrip.id}/offline-bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          mobile: lead.phone,
          participants,
          amount_paid: paid,
          payment_option: paymentOption,
          payment_state: paymentState,
          departure_date: selectedTrip.is_recurring ? departureDate : null,
          pickup_point: pickupPoint || null,
          primary_passenger_age: lead.age || null,
          primary_passenger_gender: lead.gender || null,
          emergency_contact_name: emergencyName || null,
          emergency_contact_phone: emergencyPhone || null,
          passengers: passengers.map((p, index) => ({ ...p, is_primary: index === 0 })),
          addon_selections: finalSelections,
          notes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to add offline booking');
      reset();
      await onCreated?.();
    } catch (error: any) {
      alert(error.message || 'Failed to add offline booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {!lockTrip && (
          <label className="block xl:col-span-2">
            <span className={labelClass}>Trip</span>
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} disabled={loadingTrips} className={inputClass}>
              <option value="">Choose trip</option>
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title} - {trip.destination || 'Trip'}</option>)}
            </select>
          </label>
        )}
        {selectedTrip?.is_recurring && typeof selectedTrip.recurrence_day === 'number' && (
          <label className="block">
            <span className={labelClass}>Batch / departure</span>
            <select value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className={inputClass}>
              <option value="">Choose a departure</option>
              {nextOccurrences(selectedTrip.recurrence_day, Number(selectedTrip.recurrence_weeks_ahead) || 4).map((date) => (
                <option key={date} value={date}>{formatDeparture(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className={labelClass}>Pickup point</span>
          {selectedTrip?.pickup_points?.length ? (
            <select value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} className={inputClass}>
              <option value="">Choose pickup</option>
              {selectedTrip.pickup_points.map((point) => <option key={point} value={point}>{point}</option>)}
            </select>
          ) : (
            <input value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="Pickup point" className={inputClass} />
          )}
        </label>
        <label className="block">
          <span className={labelClass}>Travellers</span>
          <input type="number" min={1} value={participants} onChange={(e) => setParticipantCount(parseInt(e.target.value, 10))} className={inputClass} />
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">Passenger details</p>
          <p className="text-xs text-gray-500">Lead passenger is required</p>
        </div>
        <div className="space-y-2">
          {passengers.map((p, index) => (
            <div key={p.pid} className="grid gap-2 md:grid-cols-[88px_minmax(0,1.5fr)_90px_120px_minmax(0,1fr)]">
              <span className="flex items-center text-xs font-semibold text-gray-500">{index === 0 ? 'Lead' : `Guest ${index + 1}`}</span>
              <input value={p.name} onChange={(e) => updatePassenger(index, { name: e.target.value })} placeholder="Full name" className={inputClass} />
              <input value={p.age} onChange={(e) => updatePassenger(index, { age: e.target.value })} placeholder="Age" className={inputClass} />
              <select value={p.gender} onChange={(e) => updatePassenger(index, { gender: e.target.value })} className={inputClass}>
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input value={p.phone} onChange={(e) => updatePassenger(index, { phone: e.target.value })} placeholder={index === 0 ? 'Mobile required' : 'Phone optional'} className={inputClass} />
            </div>
          ))}
        </div>
      </div>

      {addons.length > 0 && (
        <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3">
          <p className="mb-3 text-sm font-bold text-gray-900">Add-ons</p>
          <div className="grid gap-2 md:grid-cols-2">
            {addons.map((addon) => {
              const selection = finalSelections.find((s) => s.addon_id === addon.id);
              const checked = !!selection;
              return (
                <div key={addon.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={checked} disabled={!!addon.is_required} onChange={() => toggleAddon(addon)} className="mt-1 h-4 w-4 rounded text-purple-600 focus:ring-purple-500" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900">{addon.name}{addon.is_required ? ' (required)' : ''}</span>
                      <span className="block text-xs text-gray-500">{formatINR(addon.price)} - {addon.pricing_method.replace(/_/g, ' ')}</span>
                    </span>
                  </label>
                  {checked && usesQuantity(addon.pricing_method) && (
                    <input type="number" min={Math.max(1, Number(addon.min_quantity) || 1)} max={addon.max_quantity || undefined} value={selection.quantity || 1} onChange={(e) => updateAddon(addon.id, { quantity: parseInt(e.target.value, 10) || 1 })} className={`${inputClass} mt-2 w-28`} />
                  )}
                  {checked && usesPassengerSelection(addon.pricing_method) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {passengers.map((p, i) => {
                        const on = (selection.passenger_ids || []).includes(p.pid);
                        return (
                          <button key={p.pid} type="button" onClick={() => updateAddon(addon.id, { passenger_ids: on ? (selection.passenger_ids || []).filter((pid) => pid !== p.pid) : [...(selection.passenger_ids || []), p.pid] })} className={`rounded-full border px-2 py-1 text-xs font-semibold ${on ? 'border-purple-300 bg-purple-100 text-purple-800' : 'border-gray-200 bg-white text-gray-600'}`}>
                            {p.name || (i === 0 ? 'Lead' : `Guest ${i + 1}`)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {addonEstimate.errors.length > 0 && <p className="mt-2 text-xs font-semibold text-red-600">{addonEstimate.errors[0]}</p>}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Payment option</span>
          <select value={paymentOption} onChange={(e) => setPaymentOption(e.target.value as any)} className={inputClass}>
            <option value="full">Full booking</option>
            {Number(selectedTrip?.seat_lock_price) > 0 && <option value="seat_lock">Seat lock</option>}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Payment state</span>
          <select value={paymentState} onChange={(e) => setPaymentState(e.target.value as any)} className={inputClass}>
            <option value="paid">Fully paid</option>
            <option value="partial">Partial paid</option>
            <option value="unpaid">Not paid yet</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Amount paid</span>
          <input type="number" min={0} max={grandTotal || undefined} value={amountPaid} disabled={paymentState !== 'partial'} onChange={(e) => setAmountPaid(e.target.value)} placeholder="Amount collected" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Remaining</span>
          <input type="number" min={0} max={grandTotal || undefined} value={Math.round(remaining)} disabled={paymentState !== 'partial'} onChange={(e) => setAmountPaid(String(Math.max(0, grandTotal - (parseFloat(e.target.value) || 0))))} className={inputClass} />
        </label>
        <div className="rounded-lg bg-white p-3 text-sm md:col-span-2">
          <div className="flex justify-between"><span className="text-gray-500">Base trip</span><span className="font-semibold">{formatINR(baseTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Add-ons</span><span className="font-semibold">{formatINR(addonsTotal)}</span></div>
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1"><span className="font-bold text-gray-900">Total payable</span><span className="font-bold text-gray-900">{formatINR(grandTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Collected</span><span className="font-semibold text-green-700">{formatINR(paid)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Remaining</span><span className="font-semibold text-orange-700">{formatINR(remaining)}</span></div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Emergency contact name" className={inputClass} />
        <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="Emergency contact phone" className={inputClass} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin note / reference" className={inputClass} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <X className="h-4 w-4" /> Clear
        </button>
        <button type="submit" disabled={submitting || !selectedTrip || addonEstimate.errors.length > 0} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
          <Plus className="h-4 w-4" /> {submitting ? 'Adding...' : 'Add offline booking'}
        </button>
      </div>
    </form>
  );
}
