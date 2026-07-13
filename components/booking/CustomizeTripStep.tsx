'use client';

import { Plus, X, Check, Minus, AlertCircle, Sparkles } from 'lucide-react';
import AddonIcon from '@/components/AddonIcon';
import {
  type TripAddon,
  type AddonSelection,
  computeAddon,
  priceRuleLabel,
  validateSelection,
  usesPassengerSelection,
  usesQuantity,
  formatINR,
} from '@/lib/addons';

export interface PaxRef {
  pid: string;
  name: string;
  age?: string | number;
  isPrimary?: boolean;
}

export default function CustomizeTripStep({
  addons,
  passengers,
  selections,
  onSelectionsChange,
  tripDurationDays,
  basePackageLabel,
  baseGrandTotal,
  amountPayableNowBase,
  paymentMethod,
  discountAmount = 0,
  onBack,
  onContinue,
}: {
  addons: TripAddon[];
  passengers: PaxRef[];
  selections: AddonSelection[];
  onSelectionsChange: (next: AddonSelection[]) => void;
  tripDurationDays: number;
  basePackageLabel: string;
  baseGrandTotal: number;
  amountPayableNowBase: number;
  paymentMethod: 'full' | 'seat_lock';
  discountAmount?: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  const ctx = { paxCount: passengers.length, tripDurationDays };
  const selByAddon = new Map(selections.map((s) => [s.addon_id, s]));
  const hasRequired = addons.some((a) => a.is_required);

  const select = (a: TripAddon) => {
    if (selByAddon.has(a.id)) return;
    const base: AddonSelection = usesQuantity(a.pricing_method)
      ? { addon_id: a.id, quantity: Math.max(1, Number(a.min_quantity) || 1) }
      : usesPassengerSelection(a.pricing_method)
        ? { addon_id: a.id, passenger_ids: [] }
        : { addon_id: a.id };
    onSelectionsChange([...selections, base]);
  };

  const deselect = (id: string) => onSelectionsChange(selections.filter((s) => s.addon_id !== id));

  const setQty = (id: string, q: number) =>
    onSelectionsChange(selections.map((s) => (s.addon_id === id ? { ...s, quantity: Math.max(0, q) } : s)));

  const togglePassenger = (a: TripAddon, pid: string) => {
    const sel = selByAddon.get(a.id);
    if (!sel) return;
    const has = (sel.passenger_ids || []).includes(pid);
    let next = selections;
    if (!has) {
      // Room upgrades are mutually exclusive per traveller — pull this pid out of
      // any other room upgrade before adding it here.
      if (a.is_room_upgrade) {
        next = next.map((s) => {
          if (s.addon_id === a.id) return s;
          const other = addons.find((x) => x.id === s.addon_id);
          if (other?.is_room_upgrade && (s.passenger_ids || []).includes(pid)) {
            return { ...s, passenger_ids: (s.passenger_ids || []).filter((p) => p !== pid) };
          }
          return s;
        });
      }
      next = next.map((s) =>
        s.addon_id === a.id ? { ...s, passenger_ids: [...(s.passenger_ids || []), pid] } : s);
    } else {
      next = next.map((s) =>
        s.addon_id === a.id ? { ...s, passenger_ids: (s.passenger_ids || []).filter((p) => p !== pid) } : s);
    }
    onSelectionsChange(next);
  };

  const skipWithout = () => {
    onSelectionsChange(selections.filter((s) => addons.find((a) => a.id === s.addon_id)?.is_required));
    onContinue();
  };

  let addonsTotal = 0;
  const summaryLines: Array<{ name: string; calc: string; total: number }> = [];
  for (const s of selections) {
    const a = addons.find((x) => x.id === s.addon_id);
    if (!a) continue;
    const line = computeAddon(a, s, ctx);
    addonsTotal += line.total;
    summaryLines.push({ name: a.name, calc: line.calcLabel, total: line.total });
  }
  const addonsNow = paymentMethod === 'full' ? addonsTotal : 0;
  const grandTotal = baseGrandTotal + addonsTotal;
  const payableNow = amountPayableNowBase + addonsNow;
  const remaining = Math.max(0, grandTotal - payableNow);

  const CARD = 'rounded-2xl bg-white border border-[#E2E8F0]';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
      {/* Add-on list */}
      <div className="space-y-3">
        {addons.map((a) => {
          const sel = selByAddon.get(a.id);
          const selected = !!sel;
          const line = sel ? computeAddon(a, sel, ctx) : null;
          const err = sel ? validateSelection(a, sel, ctx) : null;
          const required = !!a.is_required;
          return (
            <div key={a.id} className={`${CARD} ${selected ? 'ring-1 ring-purple-200' : ''} transition-all`}>
              {/* Collapsed header */}
              <div className="flex items-center gap-3 p-3.5">
                <span className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                  <AddonIcon iconKey={a.icon_key} className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                    {required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">Required</span>}
                    {!a.is_refundable && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">Non-refundable</span>}
                  </div>
                  <p className="text-xs text-gray-500">{priceRuleLabel(a)}</p>
                </div>
                {required ? (
                  <span className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-purple-600 text-white">
                    <Check className="w-3.5 h-3.5" /> Added
                  </span>
                ) : selected ? (
                  <button type="button" onClick={() => deselect(a.id)}
                    className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                ) : (
                  <button type="button" onClick={() => select(a)}
                    className="shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-lg text-xs font-bold text-white hover:opacity-95"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)' }}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>

              {/* Expanded body — only when selected */}
              {selected && (
                <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 space-y-3">
                  {a.description && <p className="text-xs text-gray-600">{a.description}</p>}

                  {/* Passenger picker */}
                  {usesPassengerSelection(a.pricing_method) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1.5">Select travellers</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {passengers.map((p, i) => {
                          const on = (sel!.passenger_ids || []).includes(p.pid);
                          return (
                            <button
                              key={p.pid}
                              type="button"
                              onClick={() => togglePassenger(a, p.pid)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                                on ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-200'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${on ? 'bg-purple-600 text-white' : 'border border-gray-300'}`}>
                                {on && <Check className="w-3 h-3" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-medium text-gray-900 truncate">{p.name || `Passenger ${i + 1}`}</span>
                                <span className="block text-[10px] text-gray-400">
                                  Passenger {i + 1}{p.isPrimary ? ', Primary' : ''}{p.age ? ` · ${p.age}y` : ''}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantity stepper */}
                  {usesQuantity(a.pricing_method) && (
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold text-gray-700">Quantity</p>
                      <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setQty(a.id, (Number(sel!.quantity) || 0) - 1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
                        <span className="w-9 text-center text-sm font-semibold text-gray-900">{Number(sel!.quantity) || 0}</span>
                        <button type="button" onClick={() => setQty(a.id, (Number(sel!.quantity) || 0) + 1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
                      </div>
                      {a.max_quantity != null && <span className="text-[11px] text-gray-400">Max {a.max_quantity}</span>}
                    </div>
                  )}

                  {/* Room summary */}
                  {a.pricing_method === 'per_room' && line && (line.roomCount ?? 0) > 0 && (
                    <p className="text-xs text-gray-600">
                      {(sel!.passenger_ids || []).length} traveller(s) → <strong>{line.roomCount}</strong> room{line.roomCount === 1 ? '' : 's'} (occupancy {a.room_occupancy})
                    </p>
                  )}

                  {/* Inline validation */}
                  {err && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
                    </p>
                  )}

                  {/* Calculation */}
                  {line && !err && line.total > 0 && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-500">{line.calcLabel}</span>
                      <span className="text-sm font-bold text-gray-900">{formatINR(line.total)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-36">
        <div className={`${CARD} p-4`}>
          <p className="text-sm font-bold text-gray-900 mb-3">Price Summary</p>

          <div className="flex items-start justify-between text-sm mb-2">
            <span className="text-gray-500">Base Package<br /><span className="text-[11px] text-gray-400">{basePackageLabel}</span></span>
            <span className="font-semibold text-gray-900 whitespace-nowrap">{formatINR(baseGrandTotal)}</span>
          </div>

          {summaryLines.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-500" /> Add-ons &amp; Upgrades
              </p>
              {summaryLines.map((l, i) => (
                <div key={i} className="flex items-start justify-between text-xs mb-1">
                  <span className="text-gray-600 min-w-0 pr-2">{l.name}<br /><span className="text-[10px] text-gray-400">{l.calc}</span></span>
                  <span className="font-medium text-gray-800 whitespace-nowrap">{formatINR(l.total)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm mt-1.5 pt-1.5 border-t border-dashed border-gray-100">
                <span className="text-gray-500">Add-on Total</span>
                <span className="font-semibold text-gray-900">{formatINR(addonsTotal)}</span>
              </div>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Discount</span>
              <span className="font-semibold text-emerald-600">−{formatINR(discountAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <span className="text-sm font-bold text-gray-900">Grand Total</span>
            <span className="text-lg font-extrabold text-gray-900">{formatINR(grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500">Amount Payable Now</span>
            <span className="font-bold text-purple-700">{formatINR(payableNow)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-500">Remaining Balance</span>
              <span className="font-medium text-gray-700">{formatINR(remaining)}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onContinue}
            className="w-full h-12 rounded-xl text-sm font-bold text-white hover:opacity-95"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)' }}>
            Continue
          </button>
          {!hasRequired && (
            <button type="button" onClick={skipWithout}
              className="w-full h-10 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-800">
              Continue without add-ons
            </button>
          )}
          <button type="button" onClick={onBack}
            className="w-full h-10 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-800">
            Back
          </button>
        </div>
      </aside>
    </div>
  );
}
