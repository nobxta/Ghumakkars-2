'use client';

import { useState } from 'react';
import { Plus, Trash2, Ban, Pencil, Check, Minus, X, Sparkles } from 'lucide-react';
import AddonIcon from '@/components/AddonIcon';
import {
  formatINR,
  calcLabelFromRow,
  priceRuleLabel,
  usesPassengerSelection,
  usesQuantity,
  type TripAddon,
} from '@/lib/addons';

interface PaxRef { pid: string; name: string; is_primary?: boolean }

export default function AdminBookingAddons({
  bookingId,
  tripId,
  addons,
  passengers,
  onChanged,
}: {
  bookingId: string;
  tripId: string;
  addons: any[];
  passengers: PaxRef[];
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [catalog, setCatalog] = useState<TripAddon[]>([]);
  const [chosen, setChosen] = useState<TripAddon | null>(null);
  const [pids, setPids] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);

  const paxList: PaxRef[] = passengers && passengers.length
    ? passengers
    : [{ pid: 'primary', name: 'Primary traveller', is_primary: true }];

  const post = async (payload: any) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/addons`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Action failed');
      await onChanged();
      return true;
    } catch (e: any) { setErr(e.message); return false; }
    finally { setBusy(false); }
  };

  const openAdd = async () => {
    setErr(''); setChosen(null); setPids([]); setQty(1); setAddOpen(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/addons`);
      const j = await res.json();
      setCatalog((j.addons || []) as TripAddon[]);
    } catch { setCatalog([]); }
  };

  const submitAdd = async () => {
    if (!chosen) return;
    const ok = await post({
      action: 'add',
      trip_addon_id: chosen.id,
      passenger_ids: usesPassengerSelection(chosen.pricing_method) ? pids : undefined,
      quantity: usesQuantity(chosen.pricing_method) ? qty : undefined,
    });
    if (ok) setAddOpen(false);
  };

  const startEdit = (row: any) => {
    setEditId(row.id);
    setPids(Array.isArray(row.selected_passenger_ids) ? row.selected_passenger_ids : []);
    setQty(Number(row.quantity) || 1);
    setErr('');
  };

  const submitEdit = async (row: any) => {
    const ok = await post({
      action: 'update',
      booking_addon_id: row.id,
      passenger_ids: usesPassengerSelection(row.pricing_method) ? pids : undefined,
      quantity: usesQuantity(row.pricing_method) ? qty : undefined,
    });
    if (ok) setEditId(null);
  };

  const cancelRow = (row: any) => {
    const reason = window.prompt(`Cancel "${row.name}"? Optional reason:`);
    if (reason === null) return;
    post({ action: 'cancel', booking_addon_id: row.id, reason });
  };
  const removeRow = (row: any) => {
    if (window.confirm(`Permanently remove "${row.name}" from this booking?`)) {
      post({ action: 'remove', booking_addon_id: row.id });
    }
  };

  const togglePid = (pid: string) =>
    setPids((cur) => (cur.includes(pid) ? cur.filter((p) => p !== pid) : [...cur, pid]));

  const rows = addons || [];

  return (
    <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900">Add-ons &amp; Upgrades</h3>
        </div>
        <button type="button" onClick={openAdd} disabled={busy}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {err && <p className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{err}</p>}

      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-400">No add-ons on this booking.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map((row: any) => {
            const cancelled = row.status === 'cancelled';
            const editing = editId === row.id;
            return (
              <div key={row.id} className={`px-5 py-3.5 ${cancelled ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                    <AddonIcon iconKey={row.icon_key} className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-semibold text-gray-900 ${cancelled ? 'line-through' : ''}`}>{row.name}</p>
                      {cancelled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Cancelled</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">{row.payment_status || 'pending'}</span>
                    </div>
                    {Array.isArray(row.selected_passenger_names) && row.selected_passenger_names.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{row.selected_passenger_names.join(', ')}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{calcLabelFromRow(row)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold text-gray-900 ${cancelled ? 'line-through' : ''}`}>{formatINR(row.addon_total)}</p>
                    {!cancelled && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        {(usesPassengerSelection(row.pricing_method) || usesQuantity(row.pricing_method)) && (
                          <button type="button" onClick={() => (editing ? setEditId(null) : startEdit(row))} className="p-1.5 text-gray-400 hover:text-purple-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                        <button type="button" onClick={() => cancelRow(row)} className="p-1.5 text-gray-400 hover:text-amber-600" title="Cancel"><Ban className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => removeRow(row)} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                </div>

                {editing && (
                  <div className="mt-3 pl-12 space-y-2">
                    {usesPassengerSelection(row.pricing_method) && (
                      <div className="flex flex-wrap gap-1.5">
                        {paxList.map((p, i) => {
                          const on = pids.includes(p.pid);
                          return (
                            <button key={p.pid} type="button" onClick={() => togglePid(p.pid)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${on ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-600'}`}>
                              {on && <Check className="w-3 h-3" />}{p.name || `Passenger ${i + 1}`}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {usesQuantity(row.pricing_method) && (
                      <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setQty((q) => Math.max(0, q - 1))} className="w-7 h-7 flex items-center justify-center text-gray-600"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-8 text-center text-sm">{qty}</span>
                        <button type="button" onClick={() => setQty((q) => q + 1)} className="w-7 h-7 flex items-center justify-center text-gray-600"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => submitEdit(row)} className="h-8 px-3 rounded-lg text-xs font-semibold bg-gray-900 text-white disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setEditId(null)} className="h-8 px-3 rounded-lg text-xs text-gray-500">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Add an add-on</p>
              <button type="button" onClick={() => setAddOpen(false)} className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {err && <p className="text-xs text-red-600">{err}</p>}
              {catalog.length === 0 && <p className="text-sm text-gray-400">No active add-ons configured for this trip.</p>}
              {catalog.map((a) => (
                <button key={a.id} type="button" onClick={() => { setChosen(a); setPids([]); setQty(Math.max(1, Number(a.min_quantity) || 1)); }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left ${chosen?.id === a.id ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}>
                  <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700"><AddonIcon iconKey={a.icon_key} className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900 truncate">{a.name}</span>
                    <span className="block text-xs text-gray-400">{priceRuleLabel(a)}</span>
                  </span>
                  {chosen?.id === a.id && <Check className="w-4 h-4 text-purple-600" />}
                </button>
              ))}

              {chosen && usesPassengerSelection(chosen.pricing_method) && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Travellers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {paxList.map((p, i) => {
                      const on = pids.includes(p.pid);
                      return (
                        <button key={p.pid} type="button" onClick={() => togglePid(p.pid)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${on ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-600'}`}>
                          {on && <Check className="w-3 h-3" />}{p.name || `Passenger ${i + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {chosen && usesQuantity(chosen.pricing_method) && (
                <div className="pt-2 flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-600">Quantity</p>
                  <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button type="button" onClick={() => setQty((q) => Math.max(0, q - 1))} className="w-7 h-7 flex items-center justify-center text-gray-600"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-8 text-center text-sm">{qty}</span>
                    <button type="button" onClick={() => setQty((q) => q + 1)} className="w-7 h-7 flex items-center justify-center text-gray-600"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="h-9 px-4 rounded-lg text-sm text-gray-500">Cancel</button>
              <button type="button" disabled={!chosen || busy} onClick={submitAdd} className="h-9 px-4 rounded-lg text-sm font-semibold bg-purple-600 text-white disabled:opacity-50">Add to booking</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
