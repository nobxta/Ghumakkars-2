'use client';

import { useState } from 'react';
import { IndianRupee, X } from 'lucide-react';

export interface PartnerInput {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  upi_id: string;
  bank_details: string;
  default_price_basis: 'per_person' | 'total';
  default_price_rate: string;
  notes: string;
}

export const emptyPartner: PartnerInput = {
  name: '', contact_name: '', phone: '', email: '', upi_id: '', bank_details: '',
  default_price_basis: 'per_person', default_price_rate: '', notes: '',
};

export function partnerToInput(p: any): PartnerInput {
  return {
    name: p?.name || '',
    contact_name: p?.contact_name || '',
    phone: p?.phone || '',
    email: p?.email || '',
    upi_id: p?.upi_id || '',
    bank_details: p?.bank_details || '',
    default_price_basis: p?.default_price_basis === 'total' ? 'total' : 'per_person',
    default_price_rate: p?.default_price_rate != null ? String(Number(p.default_price_rate)) : '',
    notes: p?.notes || '',
  };
}

const field = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

/** Modal form to add or edit a partner. */
export default function PartnerForm({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: PartnerInput;
  onClose: () => void;
  onSave: (v: PartnerInput) => Promise<string | null>;
}) {
  const [v, setV] = useState<PartnerInput>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof PartnerInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV((cur) => ({ ...cur, [k]: e.target.value }));
    setErr('');
  };

  const submit = async () => {
    if (!v.name.trim()) { setErr('Enter the partner name'); return; }
    setSaving(true);
    const e = await onSave(v);
    setSaving(false);
    if (e) setErr(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ECECEE]">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5 text-gray-600" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Partner / company name</label>
            <input value={v.name} onChange={set('name')} placeholder="Just Travel On" className={field} autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contact person</label>
              <input value={v.contact_name} onChange={set('contact_name')} placeholder="Optional" className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone / WhatsApp</label>
              <input value={v.phone} onChange={set('phone')} placeholder="98765 43210" inputMode="tel" className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
              <input value={v.email} onChange={set('email')} placeholder="Optional" type="email" className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">UPI ID</label>
              <input value={v.upi_id} onChange={set('upi_id')} placeholder="name@bank" className={field} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Usual partner price <span className="font-normal text-gray-500">(filled in when you refer a booking)</span></label>
            <div className="flex gap-2">
              <div className="inline-flex rounded-xl border border-gray-300 p-0.5 bg-gray-50 flex-shrink-0">
                {([['per_person', 'Per traveller'], ['total', 'Total']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setV((cur) => ({ ...cur, default_price_basis: k }))} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${v.default_price_basis === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>{l}</button>
                ))}
              </div>
              <div className="relative flex-1">
                <IndianRupee className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="number" min="0" value={v.default_price_rate} onChange={set('default_price_rate')} placeholder="Optional" className={`${field} pl-9 tabular-nums`} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Bank details</label>
            <textarea value={v.bank_details} onChange={set('bank_details')} rows={2} placeholder="Account name, number, IFSC (optional)" className={`${field} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
            <textarea value={v.notes} onChange={set('notes')} rows={2} placeholder="Routes they run, how they like to settle…" className={`${field} resize-none`} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <div className="px-5 py-3 border-t border-[#ECECEE] flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving} className="h-9 px-4 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save partner'}</button>
        </div>
      </div>
    </div>
  );
}
