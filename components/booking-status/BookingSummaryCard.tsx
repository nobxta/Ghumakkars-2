'use client';

import { MapPin, Calendar, Users, BadgeCheck, CreditCard, CalendarClock, XCircle, Info } from 'lucide-react';
import type { StatusConfig } from './statusConfig';
import NextSteps from './NextSteps';

export interface PaymentData {
  paidAmount: number;
  remainingAmount: number;
  fullCost: number;
  submittedPending: number;
  dueNow?: number;
  remainingAfterDueNow?: number;
  pendingCash?: boolean;
  couponCode?: string | null;
  couponDiscount: number;
  paymentDueBy?: string | null;
  refundedAmount?: number;
}

interface Props {
  config: StatusConfig;
  shortId: string;
  guests: number;
  tripTitle?: string;
  destination?: string;
  dateRange?: string | null;
  payment: PaymentData;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * The single glass card: Mini Booking Summary + Compact Payment Summary
 * (+ the What-Happens-Next tracker for verification states). One layout, the
 * payment block swaps on `config.paymentVariant`.
 */
export default function BookingSummaryCard({ config, shortId, guests, tripTitle, destination, dateRange, payment }: Props) {
  const { accent, surface, glassShadow } = config;
  const light = surface === 'light';

  return (
    <div
      className="bs-fade-up w-full max-w-[560px] overflow-hidden rounded-[24px] text-left"
      style={
        light
          ? { background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', boxShadow: glassShadow }
          : { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', boxShadow: glassShadow }
      }
    >
      {/* Header: Booking ID / Guests */}
      <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-5 sm:px-8">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#727785]">Booking ID</p>
          <p className="font-mono text-lg font-bold text-[#191b23]">{shortId}</p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#727785]">Guests</p>
          <p className="flex items-center justify-end gap-1.5 text-lg font-bold text-[#191b23]">
            <Users className="h-4 w-4 text-[#727785]" />
            {guests}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
        {/* Trip block */}
        {tripTitle && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>Trip</p>
            <h3 className="text-xl font-bold leading-tight text-[#191b23]">{tripTitle}</h3>
            <div className="mt-2 flex flex-col gap-1.5">
              {destination && (
                <span className="flex items-center gap-2 text-sm text-[#414754]">
                  <MapPin className="h-4 w-4 text-[#727785]" /> {destination}
                </span>
              )}
              {dateRange && (
                <span className="flex items-center gap-2 text-sm text-[#414754]">
                  <Calendar className="h-4 w-4 text-[#727785]" /> {dateRange}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Compact Payment Summary */}
        <PaymentSummary config={config} payment={payment} accent={accent} />

        {/* What happens next */}
        {config.showNextSteps && <NextSteps accent={accent} />}
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, strong }: { label: string; value: string; valueColor?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#414754]">{label}</span>
      <span className={`${strong ? 'text-lg font-extrabold' : 'text-sm font-bold'}`} style={{ color: valueColor || '#191b23' }}>
        {value}
      </span>
    </div>
  );
}

function PaymentSummary({ config, payment, accent }: { config: StatusConfig; payment: PaymentData; accent: string }) {
  const { paymentVariant } = config;
  const { paidAmount, remainingAmount, fullCost, submittedPending, dueNow = 0, remainingAfterDueNow = 0, pendingCash, couponCode, couponDiscount, paymentDueBy, refundedAmount } = payment;

  // Verification pending (pending-with-submission + remaining_submitted)
  if (paymentVariant === 'verifying') {
    return (
      <div className="rounded-2xl p-5" style={{ background: `${accent}0D`, border: `1px solid ${accent}1F` }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5" style={{ color: accent }} />
            <div>
              <p className="text-[13px] font-bold" style={{ color: accent }}>Payment Submitted</p>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#727785]">Verifying</span>
            </div>
          </div>
          <span className="text-xl font-extrabold" style={{ color: accent }}>{inr(submittedPending)}</span>
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-black/[0.06] pt-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} />
          <p className="text-xs leading-relaxed text-[#414754]">
            We&apos;ve received your payment details. Your seat is held while our team verifies it — you&apos;ll get a confirmation shortly.
          </p>
        </div>
      </div>
    );
  }

  // Seat locked — paid deposit + remaining + deadline
  if (paymentVariant === 'seat_locked') {
    return (
      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-5">
        <Row label="Amount Paid" value={inr(paidAmount)} valueColor="#059669" strong />
        <div className="border-t border-black/[0.06]" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#414754]">Remaining Amount</span>
          <span className="text-2xl font-extrabold" style={{ color: accent }}>{inr(remainingAmount)}</span>
        </div>
        {paymentDueBy && (
          <div className="mt-1 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${accent}0D`, border: `1px solid ${accent}1F` }}>
            <CalendarClock className="h-5 w-5 flex-shrink-0" style={{ color: accent }} />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#727785]">Payment Due By</span>
              <span className="text-sm font-bold text-[#191b23]">{paymentDueBy}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Confirmed. Paid-in-full OR confirmed-with-an-offline-balance (Payment Status stays
  // Partial; we never force it to Paid just because the booking is confirmed).
  if (paymentVariant === 'paid') {
    const hasBalance = remainingAmount > 1;
    return (
      <div className="space-y-3 border-t border-black/[0.06] pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${accent}1A` }}>
              <CreditCard className="h-5 w-5" style={{ color: accent }} />
            </div>
            <div>
              <span className="block font-bold text-[#191b23]">{hasBalance ? 'Paid so far' : 'Paid in Full'}</span>
              <span className="block text-xs text-[#727785]">{hasBalance ? 'Balance collected offline' : 'Transaction verified'}</span>
            </div>
          </div>
          <span className="text-2xl font-extrabold" style={{ color: accent }}>{inr(paidAmount || fullCost)}</span>
        </div>
        {hasBalance && (
          <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <span className="text-sm font-semibold text-[#9A3412]">Remaining offline balance</span>
            <span className="text-base font-extrabold text-[#EA580C]">{inr(remainingAmount)}</span>
          </div>
        )}
        {couponDiscount > 0 && couponCode && (
          <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs">
            <span className="font-semibold text-[#059669]">Saved with {couponCode}</span>
            <span className="font-bold text-[#059669]">−{inr(couponDiscount)}</span>
          </div>
        )}
      </div>
    );
  }

  // Payment verification failed (rejected)
  if (paymentVariant === 'failed') {
    return (
      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#414754]">Payment Status</span>
          <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: accent }}>
            <XCircle className="h-4 w-4" /> Failed
          </span>
        </div>
        <div className="border-t border-black/[0.06]" />
        <Row label="Total Amount" value={inr(fullCost || paidAmount)} strong />
      </div>
    );
  }

  // Cancelled
  if (paymentVariant === 'cancelled') {
    return (
      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-5">
        <Row label="Status" value="Cancelled" valueColor={accent} />
        <div className="border-t border-black/[0.06]" />
        <Row label="Amount Refunded" value={inr(refundedAmount || 0)} strong />
      </div>
    );
  }

  // Awaiting payment (pending, nothing submitted yet)
  if (pendingCash) {
    return (
      <div className="space-y-3 rounded-2xl bg-black/[0.02] p-5">
        <Row label="Payment due in person" value={inr(dueNow)} valueColor={accent} strong />
        <div className="border-t border-black/[0.06]" />
        <Row label="Balance after this payment" value={inr(remainingAfterDueNow)} />
        <Row label="Grand total" value={inr(fullCost)} />
        <div className="mt-1 flex items-start gap-2 border-t border-black/[0.06] pt-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} />
          <p className="text-xs leading-relaxed text-[#414754]">Our team will contact you shortly to collect this payment in person and confirm your trip.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-black/[0.02] p-5">
      <Row label="Amount Paid" value={inr(paidAmount)} strong />
      {remainingAmount > 0 && (
        <>
          <div className="border-t border-black/[0.06]" />
          <Row label="Remaining" value={inr(remainingAmount)} valueColor={accent} />
        </>
      )}
      <div className="mt-1 flex items-start gap-2 border-t border-black/[0.06] pt-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: accent }} />
        <p className="text-xs leading-relaxed text-[#414754]">Our team will contact you shortly to collect payment and confirm your trip.</p>
      </div>
    </div>
  );
}
