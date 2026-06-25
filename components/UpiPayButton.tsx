'use client';

import { useState } from 'react';
import { Smartphone, Monitor, ArrowDown } from 'lucide-react';
import { generateUpiLink, openUpiApp, isMobileDevice, UPI_PAYEE_VPA } from '@/lib/upi';

const PURPLE_GRAD = 'linear-gradient(135deg,#7C3AED,#9333EA)';

/**
 * "Pay directly" via a native UPI deep link. On mobile it opens the installed UPI
 * app pre-filled with our VPA, the amount and a unique note. On desktop it tells
 * the user to pay from their phone (and to use the QR shown alongside).
 *
 * No gateway, SDK or API — this only builds and opens the upi:// link.
 */
export default function UpiPayButton({
  amount,
  note,
  upiId,
}: {
  amount: number;
  note: string;
  /** Configured collecting UPI ID; falls back to the default VPA. */
  upiId?: string;
}) {
  const [error, setError] = useState('');
  const vpa = upiId || UPI_PAYEE_VPA;
  const link = generateUpiLink(amount, note, vpa);
  const mobile = isMobileDevice();

  if (!mobile) {
    return (
      <div className="rounded-[14px] border border-[#E2E8F0] bg-[#FAFAFC] px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#475569]">
          <Monitor className="h-4 w-4" /> Pay from your phone
        </div>
        <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
          UPI apps open only on mobile. Open this page on your phone to pay directly, or scan the QR below from any UPI app.
        </p>
        <p className="text-xs text-[#475569] mt-2">
          UPI ID <span className="font-mono font-bold text-[#7C3AED]">{vpa}</span> · Amount{' '}
          <span className="font-bold">₹{amount.toLocaleString('en-IN')}</span>
        </p>
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] font-medium text-[#94a3b8]">
          <ArrowDown className="h-3 w-3" /> Scan the QR below
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => { setError(''); openUpiApp(link, () => setError('No UPI app found. Please install any UPI app or scan the QR code below.')); }}
        className="w-full h-12 rounded-[12px] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-[0.99]"
        style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}
      >
        <Smartphone className="h-4 w-4" /> Open UPI App · ₹{amount.toLocaleString('en-IN')}
      </button>
      <p className="text-center text-xs text-[#64748B] mt-2">
        Choose your preferred app — GPay, PhonePe, Paytm &amp; more
      </p>
      {error && <p className="mt-2 text-xs text-red-600 text-center font-medium">{error}</p>}
    </div>
  );
}
