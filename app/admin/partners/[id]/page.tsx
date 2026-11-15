'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Archive, Check, ChevronRight, IndianRupee, MessageCircle, Pencil, Phone, Trash2, X,
} from 'lucide-react';
import { Bone } from '@/components/ui/Skeleton';
import PartnerForm, { partnerToInput, type PartnerInput } from '@/components/admin/partners/PartnerForm';
import { partnerMoneyOf, PARTNER_SETTLEMENT_METHODS } from '@/lib/partner-money';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const tripOf = (b: any) => (Array.isArray(b.trips) ? b.trips[0] : b.trips);
const methodLabel = (m: string) => (m === 'upi' ? 'UPI' : m === 'bank' ? 'Bank transfer' : m.charAt(0).toUpperCase() + m.slice(1));

export default function AdminPartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as any).id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'they_owe' | 'we_owe'>('all');

  // Settlement form
  const [dir, setDir] = useState<'to_partner' | 'from_partner'>('from_partner');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [forBooking, setForBooking] = useState('');
  const [formErr, setFormErr] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/partners/${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not load partner');
      setData(d);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load partner');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const rows = useMemo(() => {
    if (!data) return [];
    return (data.bookings || []).map((b: any) => {
      const linked = (data.settlements || []).filter((s: any) => s.booking_id === b.id);
      return { b, m: partnerMoneyOf(b, tripOf(b), linked) };
    });
  }, [data]);

  const shown = rows.filter(({ m }: any) =>
    filter === 'all' ? true : filter === 'open' ? m.state === 'we_owe' || m.state === 'they_owe' : m.state === filter);

  if (loading) {
    return (
      <div className="space-y-4">
        <Bone className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-20" />)}</div>
        <Bone className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-600 mb-3">{error || 'Partner not found'}</p>
        <Link href="/admin/partners" className="text-sm font-semibold text-purple-700 hover:underline">Back to partners</Link>
      </div>
    );
  }

  const p = data.partner;
  const a = data.account;
  const phoneDigits = String(p.phone || '').replace(/\D/g, '').slice(-10);
  const unlinked = (data.settlements || []).filter((s: any) => !s.booking_id);

  const save = async (v: PartnerInput) => {
    const res = await fetch(`/api/admin/partners/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    });
    const d = await res.json();
    if (!res.ok) return d.error || 'Could not save';
    setEditing(false);
    await load();
    return null;
  };

  const toggleArchive = async () => {
    if (!window.confirm(p.is_active ? `Archive ${p.name}? They won't appear when you refer bookings. Their history stays.` : `Restore ${p.name}?`)) return;
    setBusy(true);
    await fetch(`/api/admin/partners/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !p.is_active }),
    });
    setBusy(false);
    load();
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${p.name}? This can't be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/partners/${id}`, { method: 'DELETE' });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { alert(d.error || 'Could not delete'); return; }
    router.push('/admin/partners');
  };

  const openSettle = () => {
    setDir(a.balance > 0 ? 'to_partner' : 'from_partner');
    setAmount(a.balance ? String(Math.abs(a.balance)) : '');
    setMethod('upi'); setReference(''); setNotes(''); setForBooking(''); setFormErr('');
    setDate(new Date().toISOString().slice(0, 10));
    setSettling(true);
  };

  const submitSettle = async () => {
    if (!(parseFloat(amount) > 0)) { setFormErr('Enter an amount'); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/partners/${id}/settlements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: dir, amount, method, reference, notes, settled_on: date, booking_id: forBooking || undefined }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setFormErr(d.error || 'Could not save'); return; }
    setSettling(false);
    load();
  };

  const deleteSettlement = async (s: any) => {
    if (!window.confirm(`Delete this ${inr(Number(s.amount))} settlement?`)) return;
    setBusy(true);
    await fetch(`/api/admin/partners/${id}/settlements?sid=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    setBusy(false);
    load();
  };

  const field = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

  return (
    <div className="space-y-4 tabular-nums">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/partners" className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Back to partners"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {p.name}
            {!p.is_active && <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 align-middle">Archived</span>}
          </h1>
          <p className="text-sm text-gray-600 truncate">
            {[p.contact_name, p.phone, p.upi_id && `UPI ${p.upi_id}`].filter(Boolean).join(' · ') || 'No contact details yet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {phoneDigits && (
            <>
              <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"><Phone className="h-4 w-4" /><span className="hidden sm:inline">Call</span></a>
              <a href={`https://wa.me/91${phoneDigits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"><MessageCircle className="h-4 w-4 text-green-600" /><span className="hidden sm:inline">WhatsApp</span></a>
            </>
          )}
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"><Pencil className="h-4 w-4" />Edit</button>
          <button onClick={openSettle} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"><IndianRupee className="h-4 w-4" />Record settlement</button>
        </div>
      </div>

      {/* Account */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-xl border px-4 py-3 col-span-2 lg:col-span-1 ${a.balance < 0 ? 'bg-green-50 border-green-100' : a.balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-[#ECECEE]'}`}>
          <p className="text-xs font-medium text-gray-700">{a.balance < 0 ? `${p.name} owes you` : a.balance > 0 ? `You owe ${p.name}` : 'Balance'}</p>
          <p className={`text-2xl font-bold mt-0.5 ${a.balance < 0 ? 'text-green-700' : a.balance > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{a.balance === 0 ? '₹0' : inr(Math.abs(a.balance))}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            {a.customerDue > 0
              ? `Assumes they collect ${inr(a.customerDue)} still due from customers`
              : a.bookings > 0 && a.untracked === a.bookings && (data.settlements || []).length === 0
                ? 'Not tracked yet (older referrals)'
                : a.balance === 0 ? 'All square' : 'After every booking and settlement'}
          </p>
        </div>
        <Stat label="Your margin" value={inr(a.margin)} sub={`${a.bookings} booking${a.bookings === 1 ? '' : 's'} · ${a.pax} traveller${a.pax === 1 ? '' : 's'}`} />
        <Stat label="Customers paid you" value={inr(a.paidToUs)} sub="Online + cash to you" />
        <Stat label="Customers paid partner" value={inr(a.paidToPartner)} sub="e.g. cash on the bus" />
      </div>
      {a.untracked > 0 && (
        <p className="rounded-lg bg-gray-50 border border-[#ECECEE] px-3 py-2 text-[13px] text-gray-700">
          {a.untracked} older referral{a.untracked === 1 ? ' has' : 's have'} no partner price, so {a.untracked === 1 ? 'it isn’t' : 'they aren’t'} in the balance. Open {a.untracked === 1 ? 'it' : 'each one'} and choose <strong>Edit referral</strong> to add the partner price.
        </p>
      )}

      {/* Bookings */}
      <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#ECECEE] flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900 flex-1">Bookings</h2>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-xs">
            {([['all', 'All'], ['open', 'Open'], ['they_owe', 'Owe you'], ['we_owe', 'You owe']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-md font-semibold ${filter === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>{l}</button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-600">{rows.length === 0 ? 'No bookings handed to this partner yet.' : 'Nothing here.'}</p>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))_20px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-[#F1F1F3]">
              <span>Booking</span><span className="text-right">Customer</span><span className="text-right">Partner price</span><span className="text-right">Margin</span><span className="text-right">Paid you / partner</span><span className="text-right">Settlement</span><span />
            </div>
            <ul className="divide-y divide-[#F1F1F3]">
              {shown.map(({ b, m }: any) => {
                const t = tripOf(b);
                const pax = Number(b.number_of_participants) || 1;
                return (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))_20px] gap-x-3 gap-y-1 px-4 py-3 hover:bg-gray-50/70 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.primary_passenger_name || 'Customer'} <span className="text-gray-500 font-normal">· {pax} pax</span></p>
                        <p className="text-xs text-gray-600 truncate">{t?.title || 'Trip'} · {fmtDate(b.departure_date || t?.start_date)}{b.booking_status === 'cancelled' ? ' · Cancelled' : ''}</p>
                      </div>
                      <span className="hidden md:block text-right text-sm text-gray-900">{inr(m.customerPrice)}</span>
                      <span className="hidden md:block text-right text-sm text-gray-900">{m.isLegacy ? <span className="text-gray-500">Not set</span> : inr(m.partnerPrice || 0)}</span>
                      <span className={`hidden md:block text-right text-sm font-medium ${m.margin < 0 ? 'text-red-600' : 'text-gray-900'}`}>{inr(m.margin)}</span>
                      <span className="hidden md:block text-right text-xs text-gray-700">{inr(m.paidToUs)} / {inr(m.paidToPartner)}{m.customerDue > 0 && !m.isLegacy ? <span className="block text-amber-700">{inr(m.customerDue)} due</span> : null}</span>
                      <span className="text-right text-sm">
                        <SettleChip m={m} />
                        <span className="md:hidden block text-xs text-gray-600">margin {inr(m.margin)}</span>
                      </span>
                      <ChevronRight className="hidden md:block h-4 w-4 text-gray-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Settlements */}
      <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#ECECEE] flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900 flex-1">Settlements</h2>
          <button onClick={openSettle} className="text-xs font-semibold text-purple-700 hover:underline">Record settlement</button>
        </div>
        {(data.settlements || []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-600">No money has moved between you and {p.name} yet.</p>
        ) : (
          <ul className="divide-y divide-[#F1F1F3]">
            {data.settlements.map((s: any) => {
              const bk = (data.bookings || []).find((b: any) => b.id === s.booking_id);
              return (
                <li key={s.id} className="px-4 py-2.5 flex items-center gap-3 text-[13px]">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${s.direction === 'to_partner' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>
                    {s.direction === 'to_partner' ? 'You paid' : 'You received'}
                  </span>
                  <span className="min-w-0 flex-1 text-gray-700 truncate">
                    {fmtDate(s.settled_on)} · {methodLabel(String(s.method || 'other'))}
                    {s.reference ? ` · ${s.reference}` : ''}
                    {bk ? ` · ${bk.primary_passenger_name || 'booking'}` : ' · whole account'}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </span>
                  <span className="font-semibold text-gray-900 whitespace-nowrap">{inr(Number(s.amount))}</span>
                  <button onClick={() => deleteSettlement(s)} disabled={busy} title="Delete settlement" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ul>
        )}
        {unlinked.length > 0 && (
          <p className="px-4 py-2 border-t border-[#F1F1F3] text-xs text-gray-600">“Whole account” settlements count toward the balance above but not toward any single booking.</p>
        )}
      </div>

      {(p.notes || p.bank_details) && (
        <div className="bg-white rounded-xl border border-[#ECECEE] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          {p.bank_details && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Bank details</p><p className="text-gray-900 whitespace-pre-wrap">{p.bank_details}</p></div>}
          {p.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Notes</p><p className="text-gray-900 whitespace-pre-wrap">{p.notes}</p></div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={toggleArchive} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Archive className="h-4 w-4" />{p.is_active ? 'Archive partner' : 'Restore partner'}</button>
        {rows.length === 0 && (data.settlements || []).length === 0 && (
          <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete partner</button>
        )}
      </div>

      {editing && <PartnerForm title={`Edit ${p.name}`} initial={partnerToInput(p)} onClose={() => setEditing(false)} onSave={save} />}

      {settling && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setSettling(false)}>
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ECECEE]">
              <h2 className="text-base font-bold text-gray-900">Settle with {p.name}</h2>
              <button onClick={() => setSettling(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5 text-gray-600" /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([['to_partner', 'You paid partner'], ['from_partner', 'Partner paid you']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setDir(k)} className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold ${dir === k ? 'border-purple-500 bg-purple-50 text-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>{l}</button>
                ))}
              </div>
              <div className="relative">
                <IndianRupee className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="number" min="1" value={amount} onChange={(e) => { setAmount(e.target.value); setFormErr(''); }} placeholder="Amount" className={`${field} pl-9 tabular-nums`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
                  {PARTNER_SETTLEMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                </select>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </div>
              <select value={forBooking} onChange={(e) => setForBooking(e.target.value)} className={field}>
                <option value="">Whole account (covers several bookings)</option>
                {rows.filter(({ m }: any) => !m.isLegacy).map(({ b, m }: any) => (
                  <option key={b.id} value={b.id}>
                    {b.primary_passenger_name || 'Booking'} · {fmtDate(b.departure_date || tripOf(b)?.start_date)}{m.balance ? ` · ${m.balance < 0 ? 'owes you' : 'you owe'} ${inr(Math.abs(m.balance))}` : ''}
                  </option>
                ))}
              </select>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / reference (optional)" className={field} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className={field} />
              <p className="text-xs text-gray-600">
                Balance now: {a.balance < 0 ? `${p.name} owes you ${inr(-a.balance)}` : a.balance > 0 ? `you owe ${p.name} ${inr(a.balance)}` : 'square'}.
              </p>
              {formErr && <p className="text-sm text-red-600">{formErr}</p>}
            </div>
            <div className="px-5 py-3 border-t border-[#ECECEE] flex justify-end gap-2">
              <button onClick={() => setSettling(false)} className="h-9 px-4 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={submitSettle} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"><Check className="h-4 w-4" />Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#ECECEE] px-4 py-3">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-xl font-bold mt-0.5 text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function SettleChip({ m }: { m: any }) {
  if (m.state === 'untracked') return <span className="text-xs text-gray-500">Not tracked</span>;
  if (m.state === 'they_owe') return <span className="text-sm font-semibold text-green-700">Owes {inr(-m.balance)}</span>;
  if (m.state === 'we_owe') return <span className="text-sm font-semibold text-amber-700">You owe {inr(m.balance)}</span>;
  return <span className="text-xs font-medium text-gray-600">Settled</span>;
}
