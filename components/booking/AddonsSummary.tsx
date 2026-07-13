'use client';

import { Sparkles } from 'lucide-react';
import AddonIcon from '@/components/AddonIcon';
import { formatINR, calcLabelFromRow, sumBookingAddons } from '@/lib/addons';

export interface BookingAddon {
  id: string;
  name: string;
  description?: string | null;
  icon_key?: string | null;
  category?: string | null;
  pricing_method: string;
  unit_price?: number | string | null;
  selected_passenger_ids?: unknown;
  selected_passenger_names?: unknown;
  quantity?: number | null;
  room_count?: number | null;
  chargeable_units?: number | null;
  addon_total?: number | string | null;
  is_refundable?: boolean | null;
  status?: string | null;
  payment_status?: string | null;
}

const payChip = (s?: string | null) => {
  switch (s) {
    case 'paid': return 'bg-green-100 text-green-700';
    case 'refunded': return 'bg-rose-100 text-rose-700';
    case 'refund_pending': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};
const payLabel = (s?: string | null) =>
  s === 'paid' ? 'Paid' : s === 'refunded' ? 'Refunded' : s === 'refund_pending' ? 'Refund pending' : 'Pending';

/**
 * Read-only "Add-ons & Upgrades" section shown on the customer + admin booking
 * detail pages. Renders nothing when the booking has no add-ons.
 */
export default function AddonsSummary({
  addons,
  className = '',
}: {
  addons: BookingAddon[] | null | undefined;
  className?: string;
}) {
  if (!addons || addons.length === 0) return null;
  const total = sumBookingAddons(addons as any);

  return (
    <section className={`rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-bold text-gray-900">Add-ons &amp; Upgrades</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {addons.map((a) => {
          const names = Array.isArray(a.selected_passenger_names) ? (a.selected_passenger_names as string[]) : [];
          const cancelled = a.status === 'cancelled';
          return (
            <div key={a.id} className={`px-5 py-3.5 flex items-start gap-3 ${cancelled ? 'opacity-60' : ''}`}>
              <span className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                <AddonIcon iconKey={a.icon_key} className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`text-sm font-semibold text-gray-900 ${cancelled ? 'line-through' : ''}`}>{a.name}</p>
                  {cancelled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">Cancelled</span>}
                  {!a.is_refundable && !cancelled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">Non-refundable</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${payChip(a.payment_status)}`}>{payLabel(a.payment_status)}</span>
                </div>
                {names.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{names.join(', ')}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{calcLabelFromRow(a)}</p>
              </div>
              <span className={`text-sm font-bold text-gray-900 whitespace-nowrap ${cancelled ? 'line-through' : ''}`}>{formatINR(Number(a.addon_total) || 0)}</span>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 bg-gray-50/60 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">Add-on Total</span>
        <span className="text-sm font-extrabold text-gray-900">{formatINR(total)}</span>
      </div>
    </section>
  );
}
