'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Handshake, Phone, Plus, Search } from 'lucide-react';
import { Bone } from '@/components/ui/Skeleton';
import PartnerForm, { emptyPartner, type PartnerInput } from '@/components/admin/partners/PartnerForm';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [totals, setTotals] = useState({ margin: 0, weOwe: 0, theyOwe: 0, bookings: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load partners');
      setPartners(data.partners || []);
      setTotals(data.totals || { margin: 0, weOwe: 0, theyOwe: 0, bookings: 0 });
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load partners');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return partners
      .filter((p) => showArchived || p.is_active)
      .filter((p) => !term || [p.name, p.contact_name, p.phone].some((x) => String(x || '').toLowerCase().includes(term)))
      // Most money at stake first.
      .sort((a, b) => Math.abs(b.account.balance) - Math.abs(a.account.balance) || b.account.bookings - a.account.bookings);
  }, [partners, q, showArchived]);

  const create = async (v: PartnerInput) => {
    const res = await fetch('/api/admin/partners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v),
    });
    const data = await res.json();
    if (!res.ok) return data.error || 'Could not save';
    setAdding(false);
    await load();
    return null;
  };

  const archivedCount = partners.filter((p) => !p.is_active).length;

  return (
    <div className="space-y-4 tabular-nums">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900">Partners</h1>
          <p className="text-sm text-gray-600">Operators you hand customers to, what you earn, and who owes whom.</p>
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">
          <Plus className="h-4 w-4" />Add partner
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile label="Your margin" value={inr(totals.margin)} sub={`${totals.bookings} partner booking${totals.bookings === 1 ? '' : 's'}`} />
        <Tile label="Partners owe you" value={inr(totals.theyOwe)} tone={totals.theyOwe > 0 ? 'text-green-700' : 'text-gray-900'} sub="To collect from partners" />
        <Tile label="You owe partners" value={inr(totals.weOwe)} tone={totals.weOwe > 0 ? 'text-amber-700' : 'text-gray-900'} sub="To pay out" />
      </div>

      <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ECECEE] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search partners" className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" />
          </div>
          {archivedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600" />
              Show archived ({archivedCount})
            </label>
          )}
        </div>

        {loading ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <p className="px-4 py-6 text-sm text-red-600">{error}</p>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Handshake className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800">{partners.length === 0 ? 'Add your first partner' : 'No partners match'}</p>
            <p className="text-sm text-gray-600 mt-1">{partners.length === 0 ? 'Or open a booking and choose “Refer to partner”.' : 'Try another name or phone.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F1F1F3]">
            {visible.map((p) => {
              const a = p.account;
              return (
                <li key={p.id}>
                  <Link href={`/admin/partners/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">{(p.name[0] || '?').toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.name}
                        {!p.is_active && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 align-middle">Archived</span>}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {a.bookings} booking{a.bookings === 1 ? '' : 's'} · {a.pax} traveller{a.pax === 1 ? '' : 's'} · margin {inr(a.margin)}
                        {p.phone ? <span className="hidden sm:inline"> · <Phone className="inline h-3 w-3 -mt-0.5" /> {p.phone}</span> : null}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {a.balance < 0 ? (
                        <><p className="text-sm font-semibold text-green-700">{inr(-a.balance)}</p><p className="text-[11px] text-gray-600">owes you</p></>
                      ) : a.balance > 0 ? (
                        <><p className="text-sm font-semibold text-amber-700">{inr(a.balance)}</p><p className="text-[11px] text-gray-600">you owe</p></>
                      ) : (
                        <p className="text-xs font-medium text-gray-600">{a.untracked > 0 && a.untracked === a.bookings ? 'Not tracked' : 'Settled'}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && <PartnerForm title="Add partner" initial={emptyPartner} onClose={() => setAdding(false)} onSave={create} />}
    </div>
  );
}

function Tile({ label, value, sub, tone = 'text-gray-900' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#ECECEE] px-4 py-3">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}
