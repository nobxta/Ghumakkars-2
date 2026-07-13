'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Pencil, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import {
  type PricingMethod,
  type TripAddon,
  computeAddon,
  priceRuleLabel,
  PRICING_METHOD_LABELS,
  usesQuantity,
} from '@/lib/addons';
import { ADDON_ICON_CATEGORIES, suggestIconForName } from '@/lib/addon-icons';
import AddonIcon from '@/components/AddonIcon';
import IconPicker from '@/components/admin/IconPicker';

// Form-friendly draft (numbers as strings while typing).
export interface AddonDraft {
  id: string; // real uuid (existing) or `new_*` (unsaved)
  name: string;
  description: string;
  icon_key: string | null;
  category: string;
  price: string;
  pricing_method: PricingMethod;
  room_occupancy: string;
  exact_occupancy: boolean;
  partial_occupancy: boolean;
  is_room_upgrade: boolean;
  chargeable_units: string;
  min_quantity: string;
  max_quantity: string;
  capacity: string;
  is_required: boolean;
  is_refundable: boolean;
  is_active: boolean;
  _expanded?: boolean;
}

const uid = () =>
  `new_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

export function newDraft(): AddonDraft {
  return {
    id: uid(),
    name: '',
    description: '',
    icon_key: null,
    category: '',
    price: '',
    pricing_method: 'per_traveller',
    room_occupancy: '2',
    exact_occupancy: true,
    partial_occupancy: false,
    is_room_upgrade: false,
    chargeable_units: '',
    min_quantity: '1',
    max_quantity: '',
    capacity: '',
    is_required: false,
    is_refundable: true,
    is_active: true,
    _expanded: true,
  };
}

/** DB row -> editable draft. */
export function draftFromRow(r: any): AddonDraft {
  const s = (v: any) => (v == null ? '' : String(v));
  return {
    id: r.id,
    name: r.name || '',
    description: r.description || '',
    icon_key: r.icon_key || null,
    category: r.category || '',
    price: s(r.price),
    pricing_method: (r.pricing_method || 'per_traveller') as PricingMethod,
    room_occupancy: s(r.room_occupancy ?? '2'),
    exact_occupancy: !!r.exact_occupancy,
    partial_occupancy: r.partial_occupancy !== false,
    is_room_upgrade: !!r.is_room_upgrade,
    chargeable_units: s(r.chargeable_units),
    min_quantity: s(r.min_quantity ?? '1'),
    max_quantity: s(r.max_quantity),
    capacity: s(r.capacity),
    is_required: !!r.is_required,
    is_refundable: r.is_refundable !== false,
    is_active: r.is_active !== false,
    _expanded: false,
  };
}

/** Draft -> API payload for the addons sync endpoint. */
export function draftToPayload(d: AddonDraft, order: number) {
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
  const isRoom = d.pricing_method === 'per_room';
  return {
    id: d.id.startsWith('new_') ? undefined : d.id,
    name: d.name.trim(),
    description: d.description.trim() || null,
    icon_key: d.icon_key || null,
    category: d.category.trim() || null,
    price: Number(d.price) || 0,
    pricing_method: d.pricing_method,
    room_occupancy: isRoom ? (Number(d.room_occupancy) || 1) : null,
    exact_occupancy: isRoom ? d.exact_occupancy : false,
    partial_occupancy: isRoom ? d.partial_occupancy : true,
    is_room_upgrade: isRoom ? true : d.is_room_upgrade,
    chargeable_units: d.pricing_method === 'per_traveller_night' ? numOrNull(d.chargeable_units) : null,
    min_quantity: Number(d.min_quantity) || 1,
    max_quantity: d.pricing_method === 'per_unit' ? numOrNull(d.max_quantity) : null,
    capacity: numOrNull(d.capacity),
    is_required: d.is_required,
    is_refundable: d.is_refundable,
    is_active: d.is_active,
    display_order: order,
  };
}

const METHODS: PricingMethod[] = ['per_traveller', 'per_room', 'per_unit', 'per_traveller_night', 'per_booking'];

const fieldCls =
  'w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 bg-white';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-purple-600' : 'bg-gray-300'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function previewLine(d: AddonDraft, tripDurationDays: number): { rule: string; calc: string } {
  const addon: TripAddon = {
    id: d.id,
    name: d.name || 'Add-on',
    price: Number(d.price) || 0,
    pricing_method: d.pricing_method,
    room_occupancy: Number(d.room_occupancy) || 1,
    exact_occupancy: d.exact_occupancy,
    chargeable_units: d.chargeable_units.trim() === '' ? null : Number(d.chargeable_units),
  };
  const sample = usesQuantity(d.pricing_method)
    ? { addon_id: d.id, quantity: Math.max(1, Number(d.min_quantity) || 1) }
    : { addon_id: d.id, passenger_ids: ['s1', 's2'] };
  const line = computeAddon(addon, sample, { paxCount: 2, tripDurationDays });
  return { rule: priceRuleLabel(addon), calc: line.calcLabel };
}

export default function TripAddonsEditor({
  enabled,
  drafts,
  onEnabledChange,
  onDraftsChange,
  tripDurationDays = 3,
}: {
  enabled: boolean;
  drafts: AddonDraft[];
  onEnabledChange: (v: boolean) => void;
  onDraftsChange: (next: AddonDraft[]) => void;
  tripDurationDays?: number;
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<AddonDraft>) =>
    onDraftsChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const remove = (id: string) => onDraftsChange(drafts.filter((d) => d.id !== id));

  const add = () => {
    const d = newDraft();
    onDraftsChange([...drafts, d]);
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = drafts.findIndex((d) => d.id === dragId);
    const to = drafts.findIndex((d) => d.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...drafts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onDraftsChange(next);
    setDragId(null);
  };

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-100/40 border border-purple-200 rounded-xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-600" /> Trip Add-ons
          </label>
          <p className="text-xs text-gray-600 max-w-md">
            Optional upgrades &amp; activities travellers can add during booking (room upgrades, permits,
            meals, pickups…). Leave disabled to keep the standard 3-step booking flow.
          </p>
        </div>
        <Toggle checked={enabled} onChange={onEnabledChange} label="Enable add-ons for this trip" />
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          {drafts.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-500 border-2 border-dashed border-purple-200 rounded-xl bg-white/60">
              No add-ons yet. Click “Add Add-on” to create the first upgrade.
            </div>
          )}

          {drafts.map((d) => {
            const pv = previewLine(d, tripDurationDays);
            const isRoom = d.pricing_method === 'per_room';
            return (
              <div
                key={d.id}
                draggable
                onDragStart={() => setDragId(d.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(d.id)}
                className={`bg-white rounded-xl border ${d.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'} shadow-sm`}
              >
                {/* Collapsed header */}
                <div className="flex items-center gap-2 p-3">
                  <span className="cursor-grab text-gray-300 hover:text-gray-500" title="Drag to reorder">
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <span className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                    <AddonIcon iconKey={d.icon_key} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.name || 'Untitled add-on'}</p>
                      {d.is_required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">Required</span>}
                      {!d.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{pv.rule} · {PRICING_METHOD_LABELS[d.pricing_method]}</p>
                  </div>
                  <button type="button" onClick={() => update(d.id, { _expanded: !d._expanded })} className="p-2 text-gray-400 hover:text-purple-600 rounded-lg">
                    {d._expanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => remove(d.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded editor */}
                {d._expanded && (
                  <div className="px-3 pb-4 pt-1 border-t border-gray-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-3 items-start">
                      {/* Icon */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Icon</label>
                        <button
                          type="button"
                          onClick={() => setPickerFor(d.id)}
                          className="w-16 h-16 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-400 flex flex-col items-center justify-center text-purple-600 gap-0.5"
                        >
                          {d.icon_key ? <AddonIcon iconKey={d.icon_key} className="w-6 h-6" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
                          <span className="text-[10px] text-gray-400">{d.icon_key ? 'Change' : 'Pick'}</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Add-on name *</label>
                          <input
                            value={d.name}
                            onChange={(e) => {
                              const name = e.target.value;
                              // Auto-suggest an icon the first time they name it.
                              update(d.id, d.icon_key ? { name } : { name, icon_key: name.trim() ? suggestIconForName(name) : null });
                            }}
                            placeholder="e.g. Rohtang Pass"
                            className={fieldCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Short description</label>
                          <textarea
                            value={d.description}
                            onChange={(e) => update(d.id, { description: e.target.value })}
                            rows={2}
                            placeholder="Shown to the customer only after they select this add-on."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-gray-900 bg-white resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Pricing method</label>
                        <select
                          value={d.pricing_method}
                          onChange={(e) => {
                            const pm = e.target.value as PricingMethod;
                            update(d.id, { pricing_method: pm, is_room_upgrade: pm === 'per_room' ? true : d.is_room_upgrade });
                          }}
                          className={fieldCls}
                        >
                          {METHODS.map((m) => (
                            <option key={m} value={m}>{PRICING_METHOD_LABELS[m]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Price (₹)</label>
                        <input type="number" min={0} value={d.price} onChange={(e) => update(d.id, { price: e.target.value })} placeholder="1000" className={fieldCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                        <select value={d.category} onChange={(e) => update(d.id, { category: e.target.value })} className={fieldCls}>
                          <option value="">—</option>
                          {ADDON_ICON_CATEGORIES.map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Room-specific */}
                    {isRoom && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end p-3 rounded-lg bg-purple-50/60 border border-purple-100">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Room occupancy</label>
                          <input type="number" min={1} value={d.room_occupancy} onChange={(e) => update(d.id, { room_occupancy: e.target.value })} placeholder="2" className={fieldCls} />
                        </div>
                        <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-x-4 gap-y-2 pb-1">
                          <Toggle checked={d.exact_occupancy} onChange={(v) => update(d.id, { exact_occupancy: v, partial_occupancy: v ? false : d.partial_occupancy })} label="Exact occupancy required" />
                          <Toggle checked={d.partial_occupancy} onChange={(v) => update(d.id, { partial_occupancy: v, exact_occupancy: v ? false : d.exact_occupancy })} label="Allow partial room" />
                        </div>
                        <p className="col-span-2 sm:col-span-4 text-[11px] text-purple-700/80">
                          Room upgrades are mutually exclusive per traveller — a traveller can’t be in two room types.
                        </p>
                      </div>
                    )}

                    {/* Per-unit specific */}
                    {d.pricing_method === 'per_unit' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Min quantity</label>
                          <input type="number" min={0} value={d.min_quantity} onChange={(e) => update(d.id, { min_quantity: e.target.value })} className={fieldCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Max quantity</label>
                          <input type="number" min={1} value={d.max_quantity} onChange={(e) => update(d.id, { max_quantity: e.target.value })} placeholder="No limit" className={fieldCls} />
                        </div>
                      </div>
                    )}

                    {/* Per-night specific */}
                    {d.pricing_method === 'per_traveller_night' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Chargeable nights</label>
                          <input type="number" min={0} value={d.chargeable_units} onChange={(e) => update(d.id, { chargeable_units: e.target.value })} placeholder={`Auto (${Math.max(1, tripDurationDays - 1)})`} className={fieldCls} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Availability limit</label>
                        <input type="number" min={0} value={d.capacity} onChange={(e) => update(d.id, { capacity: e.target.value })} placeholder="Unlimited" className={fieldCls} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                      <Toggle checked={d.is_required} onChange={(v) => update(d.id, { is_required: v })} label="Required" />
                      <Toggle checked={d.is_refundable} onChange={(v) => update(d.id, { is_refundable: v })} label="Refundable" />
                      <Toggle checked={d.is_active} onChange={(v) => update(d.id, { is_active: v })} label="Active" />
                    </div>

                    {/* Live preview */}
                    <div className="mt-1 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">Preview (sample: 2 travellers)</p>
                      <p className="text-sm text-gray-800">{pv.calc || pv.rule}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={add}
            className="w-full h-11 rounded-xl border-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Add-on
          </button>
        </div>
      )}

      {pickerFor && (
        <IconPicker
          value={drafts.find((d) => d.id === pickerFor)?.icon_key || null}
          onChange={(key) => update(pickerFor, { icon_key: key })}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
