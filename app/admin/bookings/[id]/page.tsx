'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, getSessionUser } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart,
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle,
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Check, X,
  Printer, Copy, FileText, Tag, Shield, MessageCircle, ChevronRight, Wallet, Receipt,
  Gift, StickyNote, RotateCcw, Bell
} from 'lucide-react';
import { resolveDueDate } from '@/lib/payment-due';
import { moneyOf, seatLockBaseOf } from '@/lib/booking-money';
import { bookingStatusLabel, paymentStatusLabel, bookingStatusChip, paymentStatusChip, MANUAL_STATUSES, effectiveBookingStatus } from '@/lib/booking-status-labels';
import AdminBookingAddons from '@/components/admin/AdminBookingAddons';
import AddonsSummary from '@/components/booking/AddonsSummary';
import { AdminDetailSkeleton } from '@/components/ui/Skeleton';

export default function AdminBookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('fake_payment');
  const [managing, setManaging] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonPreset, setCancelReasonPreset] = useState('');
  // Each action opens its OWN focused panel (not one big stacked drawer).
  const [drawerMode, setDrawerMode] = useState<null | 'payment' | 'status' | 'referral'>(null);
  const [dueDaysBefore, setDueDaysBefore] = useState<number>(5);
  // Record-payment form
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card' | 'bank' | 'online'>('cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  // Change-status form
  const [statusChoice, setStatusChoice] = useState<string>('');
  const [statusNotify, setStatusNotify] = useState(true);
  // Referral form
  const [refPartner, setRefPartner] = useState('');
  const [refCommission, setRefCommission] = useState('');
  const [refNotes, setRefNotes] = useState('');
  // Internal notes
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // Refund modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'razorpay'>('cash');
  const [refundNotes, setRefundNotes] = useState('');
  // Cancel modal extras
  const [cancelNotify, setCancelNotify] = useState(true);

  const cancelReasonPresets = [
    'Customer requested cancellation',
    'Payment not completed in time',
    'Trip postponed / rescheduled',
    'Duplicate or test booking',
    'Traveller details could not be verified',
  ];

  const manageBooking = async (payload: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setManaging(true);
    try {
      const res = await fetch(`/api/admin/bookings/${(params as any).id}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update booking');
      await fetchBooking();
      setCashAmount('');
      alert(data.message || 'Done');
    } catch (e: any) {
      alert(e.message || 'Something went wrong');
    } finally {
      setManaging(false);
    }
  };

  // "They paid X and nothing more is due" — write off the remaining balance so it
  // reads Paid with no offline balance. Pass clear=true to undo.
  const settleBalance = async (clear = false) => {
    const msg = clear
      ? 'Remove the write-off and make the full balance due again?'
      : `Mark this booking as settled — write off the remaining ₹${remainingAmount.toLocaleString('en-IN')}? It will show as paid in full with nothing due.`;
    await manageBooking({ action: 'settle_balance', clear }, msg);
  };

  const saveInternalNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/bookings/${(params as any).id}/manage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_internal_notes', notes: internalNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save notes');
      await fetchBooking();
    } catch (e: any) {
      alert(e.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // Refund — cash is recorded manually; Razorpay is issued online via the gateway.
  // Both require an explicit second confirmation (double confirm) before money moves.
  const handleRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { alert('Enter a valid refund amount'); return; }
    if (!window.confirm(`Refund ₹${amt.toLocaleString('en-IN')} via ${refundMethod === 'razorpay' ? 'Razorpay (online, irreversible)' : 'cash (manual record)'}? This cannot be undone.`)) return;
    setManaging(true);
    try {
      if (refundMethod === 'razorpay') {
        // A booking can have several Razorpay payments (seat lock + balance). Spread
        // the refund across them, newest first, each up to what it still has.
        const rzps = (booking.payment_transactions || [])
          .filter((t: any) => t.payment_mode === 'razorpay' && ['verified', 'partially_refunded'].includes(t.payment_status))
          .map((t: any) => ({ id: t.id, left: Math.max(0, Number(t.amount || 0) - Number(t.amount_refunded || 0)), at: t.created_at }))
          .filter((t: any) => t.left > 0.001)
          .sort((a: any, b: any) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
        if (rzps.length === 0) throw new Error('No Razorpay payment found to refund online. Use a cash refund instead.');
        const refundable = rzps.reduce((s: number, t: any) => s + t.left, 0);
        if (amt > refundable + 0.001) throw new Error(`Only ₹${refundable.toLocaleString('en-IN')} can be refunded online via Razorpay.`);
        let left = amt;
        let done = 0;
        for (const t of rzps) {
          if (left <= 0.001) break;
          const part = Math.round(Math.min(left, t.left) * 100) / 100;
          const res = await fetch(`/api/admin/payments/${t.id}/refund`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: part, reason: refundNotes }),
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = data.error || 'Razorpay refund failed';
            throw new Error(done > 0 ? `₹${done.toLocaleString('en-IN')} was refunded, but the rest failed: ${msg}` : msg);
          }
          left -= part;
          done += part;
        }
      } else {
        const res = await fetch(`/api/admin/bookings/${(params as any).id}/manage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'record_refund', amount: amt, method: 'cash', notes: refundNotes, confirm: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Refund failed');
      }
      await fetchBooking();
      setShowRefundModal(false);
      alert('Refund recorded.');
    } catch (e: any) {
      alert(e.message || 'Refund failed');
      fetchBooking();
    } finally {
      setManaging(false);
    }
  };

  const rejectionReasons = [
    { value: 'fake_payment', label: 'Fake Payment / Invalid Transaction ID' },
    { value: 'fake_details', label: 'Fake Details / Invalid Information' },
    { value: 'seats_full', label: 'Seats Full' },
    { value: 'other', label: 'Other (specify in notes)' },
  ];

  useEffect(() => {
    checkUser();
    fetchBooking();
    fetch('/api/payment/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.dueDaysBefore != null) setDueDaysBefore(Number(d.dueDaysBefore)); })
      .catch(() => {});
  }, [params.id]);

  // Seed the editable admin-only fields whenever the booking (re)loads.
  useEffect(() => {
    if (!booking) return;
    setInternalNotes(booking.internal_notes || '');
    setRefPartner(booking.referral_partner || '');
    setRefCommission(booking.referral_commission != null && Number(booking.referral_commission) > 0 ? String(booking.referral_commission) : '');
    setRefNotes(booking.referral_notes || '');
    setStatusChoice(booking.booking_status || 'pending');
  }, [booking?.id]);

  const checkUser = async () => {
    const { data: { user } } = await getSessionUser(supabase);
    if (!user) {
      router.push('/auth/signin?redirect=/admin/bookings');
      return;
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  const fetchBooking = async () => {
    try {
      const response = await fetch('/api/admin/bookings');
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }

      const { bookings } = await response.json();
      const foundBooking = bookings.find((b: any) => b.id === params.id);

      if (!foundBooking) {
        setError('Booking not found');
        return;
      }

      setBooking(foundBooking);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      setError(error.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'seat_locked':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'seat_locked':
        return <Lock className="h-5 w-5 text-orange-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleReviewPayment = async (transaction: any, status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason) {
      alert('Please select a rejection reason');
      return;
    }

    if (!transaction || !transaction.id) {
      alert('Invalid transaction data');
      return;
    }
    
    setReviewing(true);
    try {
      const reviewResponse = await fetch('/api/admin/bookings/review-payment-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          status: status,
          reviewNotes: reviewNotes || null,
          rejectionReason: status === 'rejected' 
            ? (rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason)
            : null,
        }),
      });

      const reviewData = await reviewResponse.json();

      if (!reviewResponse.ok) {
        throw new Error(reviewData.error || 'Failed to review payment');
      }

      // Refresh booking
      await fetchBooking();
      setShowPaymentModal(false);
      setSelectedTransaction(null);
      setReviewNotes('');
      setRejectionReason('fake_payment');
      
      alert(`Payment transaction ${status === 'verified' ? 'verified' : 'rejected'} successfully!`);
    } catch (error: any) {
      console.error('Error reviewing payment:', error);
      alert(error.message || 'Failed to update payment status');
    } finally {
      setReviewing(false);
    }
  };

  const openTransactionModal = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowPaymentModal(true);
    setReviewNotes('');
    setRejectionReason('fake_payment');
  };

  if (loading) {
    return <AdminDetailSkeleton label="Loading booking" />;
  }

  if (error && !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/admin/bookings"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Bookings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const status = booking.booking_status || 'pending';
  const pax = Number(booking.number_of_participants) || 1;
  const couponDiscountRaw = parseFloat(String(booking.coupon_discount || 0)) || 0;
  const walletUsed = parseFloat(String(booking.wallet_amount_used || 0)) || 0;
  const isSeatLock = booking.payment_method === 'seat_lock' || status === 'seat_locked';
  // Base price at the time of booking — not the trip's current price.
  const listGross = isSeatLock
    ? seatLockBaseOf(booking, booking.trips)
    : (parseFloat(String(booking.total_price || 0)) || (parseFloat(String(booking.trips?.discounted_price || 0)) || 0) * pax);
  // Single source of truth for money (independent of booking status).
  const money = moneyOf(booking, booking.trips);
  const finalAmount = money.fullPrice; // net trip price (before any write-off)
  const waivedAmount = money.waived;
  const paidAmount = money.paid;
  const remainingAmount = money.remaining;
  const paymentStatus = money.status; // 'pending' | 'partial' | 'paid' | 'refunded'
  const isReferred = status === 'referred';
  const isCancelled = ['cancelled', 'rejected'].includes(status);
  // On Trip / Completed are auto-derived from the trip dates — never set by hand.
  const effStartDate = (booking.trips?.is_recurring && booking.departure_date) ? booking.departure_date : booking.trips?.start_date;
  const effEndDate = booking.trips?.end_date || effStartDate;
  const displayStatus = effectiveBookingStatus(status, effStartDate, effEndDate);
  const shortId = booking.id.substring(0, 8).toUpperCase();
  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const fmtDateTime = (d?: string) =>
    d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const passengerName = booking.primary_passenger_name || (booking.profiles ? `${(booking.profiles.first_name || '')} ${(booking.profiles.last_name || '')}`.trim() : '') || 'N/A';
  const passengerEmail = booking.primary_passenger_email || booking.profiles?.email || 'N/A';
  const passengerPhone = booking.primary_passenger_phone || booking.profiles?.phone || 'N/A';

  const copyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(booking.id);
    }
  };

  // The primary traveller is often stored in `passengers` too — only list the others.
  const extraPassengers = (booking.passengers || []).filter((p: any, i: number) => {
    if (p?.is_primary === true) return false;
    const samePerson =
      String(p?.name || '').trim().toLowerCase() === String(passengerName).trim().toLowerCase() &&
      (!p?.phone || String(p.phone).replace(/\D/g, '').slice(-10) === String(passengerPhone).replace(/\D/g, '').slice(-10));
    return !(i === 0 && samePerson);
  });
  const waLink = `https://wa.me/91${String(passengerPhone).replace(/\D/g, '').slice(-10)}`;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  // One payment instruction, used by both the banner and the summary.
  const dueDate = (() => {
    const due = resolveDueDate(booking.departure_date || booking.trips?.start_date, booking.trips?.payment_due_days_before, dueDaysBefore);
    return due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  })();
  const showDue = !isReferred && remainingAmount > 0 && !isCancelled;
  const dueText = status === 'seat_locked'
    ? <>Collect <strong>{inr(remainingAmount)}</strong>{dueDate ? <> by <strong>{dueDate}</strong></> : null} to confirm this seat.</>
    : <>Collect <strong>{inr(remainingAmount)}</strong>{dueDate ? <> by <strong>{dueDate}</strong></> : null}.</>;
  const hasNotes = !!(booking.internal_notes || '').trim();
  const sortedTxns = [...(booking.payment_transactions || [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const Line = ({ label, value, tone = 'text-gray-900', strong = false }: { label: React.ReactNode; value: React.ReactNode; tone?: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[13px] ${strong ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{label}</dt>
      <dd className={`text-sm ${strong ? 'font-semibold' : 'font-medium'} ${tone}`}>{value}</dd>
    </div>
  );

  // Financial summary — the ONLY place totals appear. Lives at the top of the sidebar
  // (desktop) / right under the trip header (mobile) so it never needs scrolling to.
  const financeCard = (
    <div className="bg-white rounded-xl border border-[#ECECEE] p-4">
      <h2 className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-gray-500" />Payment summary</h2>
      {isReferred ? (
        <dl className="space-y-1.5">
          <Line label="Handed to partner" value={booking.referral_partner || '—'} />
          <div className="pt-2 mt-1 border-t border-[#ECECEE]">
            <Line strong label="Our commission" value={inr(parseFloat(String(booking.referral_commission || 0)) || 0)} />
          </div>
          <Line label="Dues" value="None" tone="text-green-700" />
        </dl>
      ) : (
        <>
          <dl className="space-y-1.5">
            <Line label="Trip price" value={inr(listGross)} />
            {couponDiscountRaw > 0 && <Line label={`Coupon${booking.coupon_code ? ` (${booking.coupon_code})` : ''}`} value={`−${inr(couponDiscountRaw)}`} />}
            {walletUsed > 0 && <Line label="Wallet used" value={`−${inr(walletUsed)}`} />}
            {money.addonsTotal > 0 && <Line label="Add-ons" value={`+${inr(money.addonsTotal)}`} />}
            <div className="pt-2 mt-1 border-t border-[#ECECEE]">
              <Line strong label="Total" value={inr(finalAmount)} />
            </div>
            <Line label="Paid" value={inr(paidAmount)} tone="text-green-700" />
            {waivedAmount > 0 && (
              <Line
                label={<span className="flex items-center gap-1.5">Written off <button onClick={() => settleBalance(true)} className="text-[11px] font-semibold text-purple-700 hover:underline print:hidden">undo</button></span>}
                value={`−${inr(waivedAmount)}`}
                tone="text-gray-600"
              />
            )}
            {money.refunded > 0 && <Line label="Refunded" value={`−${inr(money.refunded)}`} tone="text-red-600" />}
          </dl>
          <div className={`mt-3 rounded-lg px-3 py-2.5 flex items-baseline justify-between gap-3 ${remainingAmount > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
            <span className={`text-[13px] font-medium ${remainingAmount > 0 ? 'text-amber-900' : 'text-green-800'}`}>Balance due</span>
            <span className={`text-xl font-bold ${remainingAmount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {remainingAmount > 0 ? inr(remainingAmount) : waivedAmount > 0 ? 'Settled' : 'None'}
            </span>
          </div>
          {showDue && <p className="mt-2 text-xs text-gray-600">{dueText}</p>}
        </>
      )}
    </div>
  );

  return (
    <div className="pb-8 tabular-nums print:bg-white print:pt-0 print:pb-0">
      {/* Print-only header */}
      <div className="hidden print:block max-w-4xl mx-auto px-6 pt-6 pb-4 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold text-gray-900">Ghumakkars</p>
            <p className="text-xs text-gray-500">Trip Booking Receipt</p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Printed on {new Date().toLocaleString('en-IN')}</p>
            <p className="font-mono">Ref: {shortId}</p>
          </div>
        </div>
      </div>

      {/* Sticky booking toolbar (48px) — sits flush under the global header. The
          only place booking status appears. */}
      <div className="sticky top-14 md:top-16 z-30 -mx-3 sm:-mx-6 -mt-4 sm:-mt-6 px-3 sm:px-6 bg-white/90 backdrop-blur border-b border-[#ECECEE] print:hidden">
        <div className="w-full h-12 flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/admin/bookings" title="Back to bookings" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Bookings</span>
          </Link>
          <span className="h-4 w-px bg-gray-200" />
          <button onClick={copyId} title="Copy full booking ID" className="group inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-gray-900 hover:text-purple-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1">
            #{shortId}
            <Copy className="h-3 w-3 text-gray-500 group-hover:text-purple-600" />
          </button>
          {/* Booking Status and Payment Status are independent — show both. */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${bookingStatusChip(displayStatus)}`} title="Booking status">
            <Shield className="h-3 w-3" />{bookingStatusLabel(displayStatus)}
          </span>
          {isReferred ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap bg-indigo-100 text-indigo-700" title="Payment status">
              <Gift className="h-3 w-3" />Settled
            </span>
          ) : (
            <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${paymentStatusChip(paymentStatus)}`} title="Payment status">
              <IndianRupee className="h-3 w-3" />{paymentStatusLabel(paymentStatus)}
            </span>
          )}
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="ml-auto inline-flex items-center gap-1.5 h-8 px-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Printer className="h-3.5 w-3.5 text-gray-500" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      <div className="w-full pt-4 print:py-3">
        {/* Conditional action banner — only when an admin action is required */}
        {(() => {
          const pendingTxn = sortedTxns.find((t: any) => t.payment_status === 'pending');
          if (pendingTxn) {
            return (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    <span className="font-semibold">{inr(parseFloat(String(pendingTxn.amount || 0)))}</span> {pendingTxn.payment_type === 'remaining' ? 'remaining payment' : pendingTxn.payment_type === 'seat_lock' ? 'seat-lock payment' : 'payment'} is awaiting your approval.
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={reviewing} onClick={() => handleReviewPayment(pendingTxn, 'verified')} className="inline-flex items-center gap-1.5 h-8 px-3 bg-purple-600 text-white rounded-lg text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><CheckCircle className="h-3.5 w-3.5" /> Approve</button>
                  <button disabled={reviewing} onClick={() => openTransactionModal(pendingTxn)} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white text-red-600 border border-red-200 rounded-lg text-[13px] font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                </div>
              </div>
            );
          }
          if (status === 'seat_locked' && showDue) {
            return (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900">{dueText}</p>
                </div>
                <button onClick={() => setDrawerMode('payment')} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 bg-purple-600 text-white rounded-lg text-[13px] font-semibold hover:bg-purple-700 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><IndianRupee className="h-3.5 w-3.5" />Record payment</button>
              </div>
            );
          }
          return null;
        })()}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_312px] lg:items-start">
          {/* Sidebar — payment summary + actions */}
          <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-32 space-y-4">
            <div className="hidden lg:block">{financeCard}</div>

            <div className="bg-white border border-[#ECECEE] rounded-xl overflow-hidden print:hidden">
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Actions</p>
              <div className="px-1.5 pb-1.5">
                {!isCancelled ? (
                  <>
                    <ActionRow onClick={() => setDrawerMode('payment')} icon={<IndianRupee className="h-4 w-4" />} tone="purple" label="Record payment" sub="Cash, UPI, card, bank…" />
                    <ActionRow onClick={() => { setStatusChoice((MANUAL_STATUSES as readonly string[]).includes(status) ? status : 'confirmed'); setStatusNotify(true); setDrawerMode('status'); }} icon={<Shield className="h-4 w-4" />} tone="gray" label="Change status" sub="Seat Locked / Confirmed" />
                    <ActionRow onClick={() => setDrawerMode('referral')} icon={<Gift className="h-4 w-4" />} tone="gray" label="Refer to partner" sub="Hand off · record commission" />
                    <ActionRow onClick={() => typeof window !== 'undefined' && window.print()} icon={<Printer className="h-4 w-4" />} tone="gray" label="Print / Download PDF" />
                    <ActionRow onClick={() => { setCancelReason(''); setCancelReasonPreset(''); setCancelNotify(true); setShowCancelModal(true); }} icon={<XCircle className="h-4 w-4" />} tone="red" label="Cancel booking" />
                  </>
                ) : (
                  <>
                    <ActionRow onClick={() => { setStatusChoice('seat_locked'); setStatusNotify(false); manageBooking({ action: 'set_status', status: 'seat_locked', notify: false }, 'Reopen this booking (back to Seat Locked)? No notification is sent.'); }} icon={<RotateCcw className="h-4 w-4" />} tone="purple" label="Reopen booking" />
                    {paidAmount > money.refunded && (
                      <ActionRow onClick={() => { setRefundAmount(String(Math.max(0, paidAmount))); setRefundMethod('cash'); setRefundNotes(''); setShowRefundModal(true); }} icon={<RotateCcw className="h-4 w-4" />} tone="red" label="Record / issue refund" sub="Booking cancelled" />
                    )}
                    <ActionRow onClick={() => typeof window !== 'undefined' && window.print()} icon={<Printer className="h-4 w-4" />} tone="gray" label="Print / Download PDF" />
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* Main column */}
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 space-y-4 min-w-0">

            {/* Trip overview — compact */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
              {(() => {
                const cover = booking.trips?.cover_image_url || booking.trips?.image_url;
                return cover ? (
                  <img src={cover} alt={booking.trips?.title || ''} className="w-20 h-[60px] sm:w-24 sm:h-[72px] rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-[60px] sm:w-24 sm:h-[72px] rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><MapPin className="h-5 w-5 text-gray-400" /></div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug truncate">{booking.trips?.title || 'Trip'}</h1>
                <p className="text-[13px] text-gray-600 truncate">{booking.trips?.destination || '—'}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray-700">
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-gray-500" />{fmtDate(booking.departure_date || booking.trips?.start_date)}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-500" />{booking.pickup_point || 'No pickup set'}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-500" />{pax} {pax === 1 ? 'traveller' : 'travellers'}</span>
                </div>
              </div>
            </div>

            {/* Mobile: money right under the trip header */}
            <div className="lg:hidden">{financeCard}</div>

            {/* Traveller — the single place contact details + Call/WhatsApp live */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">{(passengerName[0] || '?').toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-gray-900 truncate">{passengerName}</p>
                  <p className="text-xs text-gray-600">
                    Primary traveller
                    {booking.primary_passenger_age ? ` · ${booking.primary_passenger_age} yrs` : ''}
                    {booking.primary_passenger_gender ? <span className="capitalize"> · {booking.primary_passenger_gender}</span> : null}
                  </p>
                </div>
                {passengerPhone !== 'N/A' && (
                  <div className="flex gap-1.5 flex-shrink-0 print:hidden">
                    <a href={`tel:${passengerPhone}`} title="Call" className="inline-flex items-center gap-1.5 h-8 px-2.5 border border-gray-200 text-gray-700 rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors"><Phone className="h-3.5 w-3.5" /><span className="hidden sm:inline">Call</span></a>
                    <a href={waLink} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="inline-flex items-center gap-1.5 h-8 px-2.5 border border-gray-200 text-gray-700 rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors"><MessageCircle className="h-3.5 w-3.5 text-green-600" /><span className="hidden sm:inline">WhatsApp</span></a>
                  </div>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2 min-w-0"><dt className="text-gray-600 w-16 flex-shrink-0 text-[13px]">Phone</dt><dd className="text-gray-900 truncate">{passengerPhone}</dd></div>
                <div className="flex items-center gap-2 min-w-0"><dt className="text-gray-600 w-16 flex-shrink-0 text-[13px]">Email</dt><dd className="text-gray-900 truncate">{passengerEmail}</dd></div>
                {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
                  <div className="flex items-center gap-2 min-w-0 sm:col-span-2"><dt className="text-gray-600 w-16 flex-shrink-0 text-[13px]">Emergency</dt><dd className="text-gray-900 truncate">{booking.emergency_contact_name || '—'}{booking.emergency_contact_phone ? <span className="text-gray-600"> · {booking.emergency_contact_phone}</span> : ''}</dd></div>
                )}
              </dl>

              {extraPassengers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#ECECEE]">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2">Other travellers ({extraPassengers.length})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {extraPassengers.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 bg-[#FAFAFA] rounded-lg px-2.5 py-1.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{((p.name || 'P')[0]).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-gray-900 truncate">{p.name || `Passenger ${i + 2}`}</p>
                          <p className="text-xs text-gray-600 truncate">{[p.age && `${p.age} yrs`, p.gender, p.phone].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

        {/* Payment history — one compact row per payment; details on expand */}
        <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden print:shadow-none">
          <div className="px-4 py-2.5 border-b border-[#ECECEE]">
            <h2 className="text-[13px] font-semibold text-gray-900 flex items-center gap-2"><Receipt className="h-4 w-4 text-gray-500" />Payment history</h2>
          </div>
          {sortedTxns.length > 0 ? (
            <div className="divide-y divide-[#F1F1F3]">
              {sortedTxns.map((t: any, i: number) => {
                const isVerified = ['verified', 'partially_refunded', 'refunded'].includes(t.payment_status);
                const isRejected = t.payment_status === 'rejected';
                const isPending = t.payment_status === 'pending';
                const method = (t.payment_mode || t.payment_type || 'payment').toString().replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                const chip = isVerified ? 'bg-green-50 text-green-700' : isRejected ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';
                return (
                  <details key={t.id} className="group" open={isPending || undefined}>
                    <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/70 focus-visible:outline-none focus-visible:bg-gray-50">
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0 print:hidden" />
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-gray-900">#{i + 1} · {method}</span>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded capitalize ${chip}`}>{String(t.payment_status || '').replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-600 w-full sm:w-auto">{fmtDateTime(t.created_at)}</span>
                      </div>
                      {isVerified ? (
                        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{inr(parseFloat(String(t.amount)) || 0)}</span>
                      ) : (
                        <span className="text-xs text-gray-600 whitespace-nowrap">{isRejected ? 'not collected' : `${inr(parseFloat(String(t.amount)) || 0)} pending`}</span>
                      )}
                    </summary>
                    <dl className="px-4 pb-3 pl-[42px] space-y-1 text-[13px]">
                      <div className="flex gap-2"><dt className="text-gray-600 w-20 flex-shrink-0">Txn ID</dt><dd className="font-mono text-gray-900 break-all">{t.transaction_id || '—'}</dd></div>
                      {t.payment_reviewed_at && <div className="flex gap-2"><dt className="text-gray-600 w-20 flex-shrink-0">Reviewed</dt><dd className="text-gray-900">{fmtDateTime(t.payment_reviewed_at)}</dd></div>}
                      {Number(t.amount_refunded) > 0 && <div className="flex gap-2"><dt className="text-gray-600 w-20 flex-shrink-0">Refunded</dt><dd className="text-red-700">{inr(Number(t.amount_refunded))}</dd></div>}
                      {t.rejection_reason && <div className="flex gap-2"><dt className="text-gray-600 w-20 flex-shrink-0">Reason</dt><dd className="text-red-700 font-medium">{t.rejection_reason}</dd></div>}
                      {isPending && (
                        <button onClick={() => openTransactionModal(t)} className="mt-1.5 h-8 px-3 bg-purple-600 text-white rounded-lg text-[13px] font-semibold hover:bg-purple-700 transition-colors print:hidden">Review payment</button>
                      )}
                    </dl>
                  </details>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-600">No payments recorded yet. Use <span className="font-medium text-gray-800">Record payment</span> when you collect one.</p>
          )}
        </div>

        {/* Add-ons & Upgrades — view + manage (only when the booking has any) */}
        {Array.isArray(booking.booking_addons) && booking.booking_addons.length > 0 && (
          <div className="print:hidden">
            <AdminBookingAddons
              bookingId={booking.id}
              tripId={booking.trip_id}
              addons={booking.booking_addons}
              passengers={(booking.passengers || []).map((p: any, i: number) => ({
                pid: p.pid || (p.is_primary ? 'primary' : `pax_idx_${i - 1}`),
                name: p.name,
                is_primary: p.is_primary,
              }))}
              onChanged={fetchBooking}
            />
          </div>
        )}
        {/* Read-only add-on summary for the printed/PDF copy */}
        {Array.isArray(booking.booking_addons) && booking.booking_addons.length > 0 && (
          <div className="hidden print:block">
            <AddonsSummary addons={booking.booking_addons} />
          </div>
        )}

        {/* Referral details — ADMIN ONLY (never sent to the customer) */}
        {isReferred && (
          <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden print:hidden">
            <div className="px-4 py-2.5 border-b border-[#ECECEE] flex items-center gap-2">
              <Gift className="h-4 w-4 text-gray-500" />
              <h2 className="text-[13px] font-semibold text-gray-900">Referral <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">admin-only</span></h2>
            </div>
            <dl className="px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-600">Referred to</dt><dd className="font-semibold text-gray-900">{booking.referral_partner || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-600">Commission / profit</dt><dd className="font-semibold text-gray-900">{inr(parseFloat(String(booking.referral_commission || 0)) || 0)}</dd></div>
              {booking.referral_notes && <div className="pt-2 border-t border-gray-100"><dt className="text-gray-600 mb-1">Notes</dt><dd className="text-gray-800 whitespace-pre-wrap">{booking.referral_notes}</dd></div>}
            </dl>
          </div>
        )}

        {/* Internal notes — ADMIN ONLY. Collapsed to one line until there's something to say. */}
        {!hasNotes && !notesOpen ? (
          <button
            onClick={() => setNotesOpen(true)}
            className="w-full bg-white rounded-xl border border-dashed border-gray-300 px-4 py-2.5 flex items-center gap-2 text-[13px] font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors print:hidden"
          >
            <StickyNote className="h-4 w-4 text-gray-500" />Add internal note
            <span className="ml-auto text-[11px] font-normal text-gray-500">Never shown to the customer</span>
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-[#ECECEE] p-4 print:hidden">
            <h2 className="text-[13px] font-semibold text-gray-900 mb-2 flex items-center gap-2"><StickyNote className="h-4 w-4 text-gray-500" />Internal notes <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">admin-only</span></h2>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              autoFocus={!hasNotes}
              placeholder="e.g. Customer will pay cash while boarding. Requested front seats."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-500">Never shown to the customer.</p>
              <div className="flex gap-2">
                {!hasNotes && (
                  <button onClick={() => { setInternalNotes(''); setNotesOpen(false); }} className="h-8 px-3 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100">Cancel</button>
                )}
                <button onClick={saveInternalNotes} disabled={savingNotes || internalNotes === (booking.internal_notes || '')} className="inline-flex items-center gap-1.5 h-8 px-3 bg-purple-600 text-white rounded-lg text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-40"><Check className="h-3.5 w-3.5" />{savingNotes ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

          </div>
        </div>

        {/* Print footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
          <p>Generated from Ghumakkars Admin · support@ghumakkars.in</p>
        </div>
      </div>

      {/* Print CSS — hide chrome, force light backgrounds for ink */}
      <style jsx global>{`
        @media print {
          @page { margin: 14mm; size: A4; }
          html, body { background: white !important; }
          nav, header, footer, [role="navigation"] { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:!text-white { color: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-gray-300 { border-color: #d1d5db !important; }
          .print\\:bg-purple-700 { background: #6b21a8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
          .print\\:pt-0 { padding-top: 0 !important; }
          .print\\:pb-0 { padding-bottom: 0 !important; }
          .print\\:block { display: block !important; }
          a { color: #1f2937 !important; text-decoration: none !important; }
          .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>

      {/* Focused action panel — shows ONLY the action the admin picked */}
      {drawerMode && !isCancelled && (
        <div className="fixed inset-0 z-50 print:hidden" onClick={() => setDrawerMode(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl overflow-y-auto animate-[toast-in_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#ECECEE] px-5 py-4 flex items-center gap-3 z-10">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${drawerMode === 'payment' ? 'bg-green-50 text-green-600' : drawerMode === 'status' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {drawerMode === 'payment' ? <IndianRupee className="h-[18px] w-[18px]" /> : drawerMode === 'status' ? <Shield className="h-[18px] w-[18px]" /> : <Gift className="h-[18px] w-[18px]" />}
              </span>
              <h2 className="text-base font-bold text-gray-900 flex-1">{drawerMode === 'payment' ? 'Record a payment' : drawerMode === 'status' ? 'Change booking status' : 'Refer to a partner'}</h2>
              <button onClick={() => setDrawerMode(null)} className="p-1.5 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><X className="h-5 w-5 text-gray-600" /></button>
            </div>

            <div className="p-5">
              {/* ── Record Payment ── */}
              {drawerMode === 'payment' && (
                <div>
                  <div className="space-y-2.5">
                    <div className="relative">
                      <IndianRupee className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="number" min="1" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Amount" className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" />
                    </div>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)} className="w-full px-3 py-2.5 text-sm font-medium border border-gray-300 rounded-xl bg-white text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="online">Online</option>
                    </select>
                    <input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Reference ID (optional)" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" />
                    <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} placeholder="Notes (optional) — e.g. Collected while boarding" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500" />
                  </div>
                  <button disabled={managing || !cashAmount} onClick={async () => { await manageBooking({ action: 'record_payment', amount: cashAmount, method: payMethod, reference: payReference, notes: payNotes }); setPayReference(''); setPayNotes(''); setDrawerMode(null); }} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-green-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"><Check className="h-4 w-4" />Record payment</button>
                  <p className="text-[11px] text-gray-400 mt-2 text-center">Updates Paid, Remaining and Payment Status automatically. Booking status is never changed.</p>

                  {/* Settle — when the amount already collected is the final deal and nothing more is due. */}
                  {remainingAmount > 0 && (
                    <div className="mt-4 pt-4 border-t border-dashed border-[#ECECEE]">
                      <button disabled={managing} onClick={async () => { await settleBalance(false); setDrawerMode(null); }} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"><Check className="h-4 w-4" />Nothing more due — settle at ₹{paidAmount.toLocaleString('en-IN')}</button>
                      <p className="text-[11px] text-gray-400 mt-1.5 text-center">Writes off the remaining ₹{remainingAmount.toLocaleString('en-IN')}. Marks the booking paid in full.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Change Status (Seat Locked / Confirmed only) ── */}
              {drawerMode === 'status' && (
                <div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {MANUAL_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusChoice(s)}
                        className={`px-3 py-3 rounded-xl text-sm font-bold border-2 transition-all ${statusChoice === s ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                      >
                        {s === 'seat_locked' ? <Lock className="h-4 w-4 mx-auto mb-1" /> : <CheckCircle className="h-4 w-4 mx-auto mb-1" />}
                        {bookingStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] text-blue-700">
                    <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span><strong>On Trip</strong> and <strong>Completed</strong> are set automatically from the trip dates — you don&apos;t need to switch them by hand.</span>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={statusNotify} onChange={(e) => setStatusNotify(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    <Bell className="h-3.5 w-3.5 text-gray-400" /> Notify customer (WhatsApp + email)
                  </label>
                  <button
                    disabled={managing || statusChoice === status || !MANUAL_STATUSES.includes(statusChoice as any)}
                    onClick={async () => {
                      await manageBooking({ action: 'set_status', status: statusChoice, notify: statusNotify }, `Set booking status to "${bookingStatusLabel(statusChoice)}"?${statusNotify ? ' The customer will be notified.' : ' No notification will be sent.'}`);
                      setDrawerMode(null);
                    }}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    <Check className="h-4 w-4" />Update status
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2 text-center">Payment amounts are never affected.</p>
                </div>
              )}

              {/* ── Refer to a partner ── */}
              {drawerMode === 'referral' && (
                <div>
                  <div className="space-y-2.5">
                    <input value={refPartner} onChange={(e) => setRefPartner(e.target.value)} placeholder="Partner / company name" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                    <div className="relative">
                      <IndianRupee className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="number" min="0" value={refCommission} onChange={(e) => setRefCommission(e.target.value)} placeholder="Commission / profit" className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                    </div>
                    <textarea value={refNotes} onChange={(e) => setRefNotes(e.target.value)} rows={3} placeholder="Internal referral notes (never shown to the customer)" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-900 bg-white resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                  </div>
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-[11px] text-indigo-700">
                    <Gift className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Revenue counts your <strong>commission</strong> instead of the trip price. The customer keeps a normal status and never sees any of this.</span>
                  </div>
                  <button disabled={managing} onClick={async () => { await manageBooking({ action: 'set_referral', partner: refPartner, commission: refCommission, notes: refNotes }, `Mark this booking as REFERRED to "${refPartner || 'partner'}"?`); setDrawerMode(null); }} className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Gift className="h-4 w-4" />{isReferred ? 'Update referral' : 'Mark as referred'}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Review Modal */}
      {showPaymentModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl border border-purple-200 shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-purple-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Review Payment Transaction</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedTransaction(null);
                  setReviewNotes('');
                  setRejectionReason('fake_payment');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction ID</label>
                <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <p className="font-mono text-lg font-bold text-gray-900 break-all">
                    {selectedTransaction.transaction_id}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Review Notes (Optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                  placeholder="Add any notes about this payment review..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rejection Reason (Required for rejection)
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                >
                  {rejectionReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleReviewPayment(selectedTransaction, 'verified')}
                  disabled={reviewing}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Check className="h-5 w-5" />
                  <span>Verify Payment</span>
                </button>
                <button
                  onClick={() => handleReviewPayment(selectedTransaction, 'rejected')}
                  disabled={reviewing || !rejectionReason}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <X className="h-5 w-5" />
                  <span>Reject Payment</span>
                </button>
              </div>

              {reviewing && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent mx-auto"></div>
                  <p className="text-sm text-gray-600 mt-2">Processing...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel booking modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !managing && setShowCancelModal(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Cancel this booking?</h2>
                <p className="text-xs text-gray-500">{passengerName} · {booking.trips?.title || 'Trip'}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reason for cancellation</p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {cancelReasonPresets.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setCancelReasonPreset(r); setCancelReason(r); }}
                      className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        cancelReasonPreset === r ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  value={cancelReason}
                  onChange={(e) => { setCancelReason(e.target.value); setCancelReasonPreset(''); }}
                  rows={3}
                  placeholder="Add or edit the reason (saved in your records and sent to the traveller)…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={cancelNotify} onChange={(e) => setCancelNotify(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
                <Bell className="h-3.5 w-3.5 text-gray-400" /> Send cancellation notification to customer
              </label>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
                This frees the seat and removes the booking from revenue. It does <strong>not</strong> change the payment status or move money — if a refund is due, record it separately from Actions → Refund.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={managing}
                  className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Keep booking
                </button>
                <button
                  onClick={async () => {
                    await manageBooking({ action: 'set_status', status: 'cancelled', reason: cancelReason.trim(), notify: cancelNotify, confirm: true }, 'This will cancel the booking and free the seat. Continue?');
                    setShowCancelModal(false);
                  }}
                  disabled={managing || !cancelReason.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" /> {managing ? 'Cancelling…' : 'Cancel booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden" onClick={() => !managing && setShowRefundModal(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center"><RotateCcw className="h-5 w-5 text-rose-600" /></div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Refund payment</h2>
                <p className="text-xs text-gray-500">Collected so far: ₹{paidAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRefundMethod('cash')} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${refundMethod === 'cash' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>Cash (manual)</button>
                  <button onClick={() => setRefundMethod('razorpay')} className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${refundMethod === 'razorpay' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>Razorpay (online)</button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount</p>
                <div className="relative">
                  <IndianRupee className="h-4 w-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input type="number" min="1" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" />
                </div>
              </div>
              <textarea value={refundNotes} onChange={(e) => setRefundNotes(e.target.value)} rows={2} placeholder="Reason / notes (optional)" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" />
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-xs text-rose-800 leading-relaxed">
                {refundMethod === 'razorpay'
                  ? 'This issues a real refund through Razorpay to the customer — it cannot be undone.'
                  : 'This records a cash refund you have handed back. It does not move money through any gateway.'}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowRefundModal(false)} disabled={managing} className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handleRefund} disabled={managing || !refundAmount} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />{managing ? 'Processing…' : 'Confirm refund'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_TONES: Record<string, { tile: string; label: string; hover: string }> = {
  purple: { tile: 'bg-purple-50 text-purple-700', label: 'text-gray-900', hover: 'hover:bg-gray-50' },
  gray: { tile: 'bg-gray-100 text-gray-600', label: 'text-gray-900', hover: 'hover:bg-gray-50' },
  red: { tile: 'bg-red-50 text-red-600', label: 'text-red-600', hover: 'hover:bg-red-50/70' },
};

function ActionRow({ onClick, icon, tone, label, sub, disabled }: { onClick: () => void; icon: React.ReactNode; tone: keyof typeof ACTION_TONES | string; label: string; sub?: string; disabled?: boolean }) {
  const t = ACTION_TONES[tone] || ACTION_TONES.gray;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group w-full min-h-[48px] flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${t.hover}`}
    >
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 ${t.tile}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-medium leading-tight ${t.label}`}>{label}</span>
        {sub && <span className="block text-[11px] text-gray-600 truncate mt-0.5">{sub}</span>}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
    </button>
  );
}

function SectionCard({
  icon,
  title,
  iconBg = 'bg-purple-100',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  iconBg?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <h2 className="text-sm sm:text-base font-bold text-gray-900">{title}</h2>
      </div>
      <dl className="px-4 sm:px-5 py-2 sm:py-3 divide-y divide-gray-100">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2 sm:py-2.5 flex items-start gap-3">
      <dt className="text-xs sm:text-sm text-gray-500 font-medium min-w-[88px] sm:min-w-[100px] flex-shrink-0">{label}</dt>
      <dd className="text-xs sm:text-sm font-semibold text-gray-900 min-w-0 flex-1">{value}</dd>
    </div>
  );
}

