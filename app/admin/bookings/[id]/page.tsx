'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart,
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle,
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Check, X,
  Printer, Copy, FileText, Tag, Shield, MessageCircle, ChevronRight, Wallet, Receipt,
  Gift, StickyNote, RotateCcw, Bell
} from 'lucide-react';
import { resolveDueDate } from '@/lib/payment-due';
import { moneyOf } from '@/lib/booking-money';
import { bookingStatusLabel, paymentStatusLabel, bookingStatusChip, paymentStatusChip, MANUAL_STATUSES, effectiveBookingStatus } from '@/lib/booking-status-labels';

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
        const rzp = (booking.payment_transactions || []).find((t: any) => t.payment_mode === 'razorpay' && ['verified', 'partially_refunded'].includes(t.payment_status));
        if (!rzp) throw new Error('No Razorpay payment found to refund online. Use a cash refund instead.');
        const res = await fetch(`/api/admin/payments/${rzp.id}/refund`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amt, reason: refundNotes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Razorpay refund failed');
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
    const { data: { user } } = await supabase.auth.getUser();
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
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 px-4">
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
  const listGross = (parseFloat(String(booking.trips?.discounted_price || 0)) || 0) * pax;
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

  return (
    <div className="min-h-screen pb-8 bg-[#FAFAFA] tabular-nums print:bg-white print:pt-0 print:pb-0">
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

      {/* Sticky top header — the only place booking status appears */}
      <div className="sticky top-16 z-30 bg-white/90 backdrop-blur border-b border-[#ECECEE] print:hidden">
        <div className="w-full h-14 flex items-center gap-3">
          <Link href="/admin/bookings" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Bookings</span>
          </Link>
          <button onClick={copyId} title="Copy full booking ID" className="group inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900 hover:text-purple-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1">
            #{shortId}
            <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-600" />
          </button>
          {/* Booking Status and Payment Status are independent — show both. */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${bookingStatusChip(displayStatus)}`} title="Booking status">
            <Shield className="h-3 w-3" />{bookingStatusLabel(displayStatus)}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${paymentStatusChip(paymentStatus)}`} title="Payment status">
            <IndianRupee className="h-3 w-3" />{paymentStatusLabel(paymentStatus)}
          </span>
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Printer className="h-3.5 w-3.5 text-gray-500" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      <div className="w-full py-3 sm:py-4 print:py-3">
        {/* Conditional action banner — only when an admin action is required */}
        {(() => {
          const pendingTxn = (booking.payment_transactions || []).find((t: any) => t.payment_status === 'pending');
          if (pendingTxn) {
            return (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 border-l-4 border-l-amber-500 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900">
                    <span className="font-bold">₹{parseFloat(String(pendingTxn.amount || 0)).toLocaleString('en-IN')}</span> {pendingTxn.payment_type === 'remaining' ? 'remaining payment' : pendingTxn.payment_type === 'seat_lock' ? 'seat-lock payment' : 'payment'} is awaiting your approval.
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={reviewing} onClick={() => handleReviewPayment(pendingTxn, 'verified')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"><CheckCircle className="h-4 w-4" /> Approve</button>
                  <button disabled={reviewing} onClick={() => openTransactionModal(pendingTxn)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><XCircle className="h-4 w-4" /> Reject</button>
                </div>
              </div>
            );
          }
          if (status === 'seat_locked' && remainingAmount > 0) {
            return (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 border-l-4 border-l-amber-500 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900"><span className="font-bold">₹{remainingAmount.toLocaleString('en-IN')}</span> balance due to confirm this seat. Record it when collected.</p>
                </div>
                <button onClick={() => setDrawerMode('payment')} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"><IndianRupee className="h-4 w-4" />Record payment</button>
              </div>
            );
          }
          return null;
        })()}

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
          {/* Right rail — Actions + Contact */}
          <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[7.5rem] space-y-6 lg:mb-0">
            {/* Actions — each opens its own focused panel */}
            <div className="bg-white border border-[#ECECEE] rounded-2xl overflow-hidden print:hidden shadow-sm">
              <p className="px-5 pt-4 pb-2 text-[11px] uppercase tracking-wider font-semibold text-gray-400 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Actions</p>
              <div className="px-2 pb-2 space-y-0.5">
                {!isCancelled ? (
                  <>
                    <ActionRow onClick={() => setDrawerMode('payment')} icon={<IndianRupee className="h-4 w-4" />} tone="green" label="Record payment" sub="Cash, UPI, card, bank…" />
                    <ActionRow onClick={() => { setStatusChoice((MANUAL_STATUSES as readonly string[]).includes(status) ? status : 'confirmed'); setStatusNotify(true); setDrawerMode('status'); }} icon={<Shield className="h-4 w-4" />} tone="purple" label="Change status" sub="Seat Locked / Confirmed" />
                    <ActionRow onClick={() => setDrawerMode('referral')} icon={<Gift className="h-4 w-4" />} tone="indigo" label="Refer to partner" sub="Hand off · record commission" />
                    <ActionRow onClick={() => typeof window !== 'undefined' && window.print()} icon={<Printer className="h-4 w-4" />} tone="gray" label="Print / Download PDF" />
                    <ActionRow onClick={() => { setCancelReason(''); setCancelReasonPreset(''); setCancelNotify(true); setShowCancelModal(true); }} icon={<XCircle className="h-4 w-4" />} tone="red" label="Cancel booking" />
                  </>
                ) : (
                  <>
                    <ActionRow onClick={() => { setStatusChoice('seat_locked'); setStatusNotify(false); manageBooking({ action: 'set_status', status: 'seat_locked', notify: false }, 'Reopen this booking (back to Seat Locked)? No notification is sent.'); }} icon={<RotateCcw className="h-4 w-4" />} tone="purple" label="Reopen booking" />
                    {paidAmount > money.refunded && (
                      <ActionRow onClick={() => { setRefundAmount(String(Math.max(0, paidAmount))); setRefundMethod('cash'); setRefundNotes(''); setShowRefundModal(true); }} icon={<RotateCcw className="h-4 w-4" />} tone="rose" label="Record / issue refund" sub="Booking cancelled" />
                    )}
                    <ActionRow onClick={() => typeof window !== 'undefined' && window.print()} icon={<Printer className="h-4 w-4" />} tone="gray" label="Print / Download PDF" />
                  </>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white border border-[#ECECEE] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><User className="h-4 w-4 text-purple-600" />Contact</h2>
              <p className="font-semibold text-gray-900">{passengerName}</p>
              {passengerPhone !== 'N/A' && (
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="flex items-center gap-2 text-sm text-gray-700 min-w-0"><Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{passengerPhone}</span></span>
                  <span className="flex gap-1.5 flex-shrink-0">
                    <a href={`tel:${passengerPhone}`} title="Call" className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"><Phone className="h-3.5 w-3.5" /></a>
                    <a href={`https://wa.me/91${String(passengerPhone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"><MessageCircle className="h-3.5 w-3.5" /></a>
                  </span>
                </div>
              )}
              <p className="flex items-center gap-2 text-sm text-gray-700 mt-1.5 min-w-0"><Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{passengerEmail}</span></p>
            </div>
          </aside>

          {/* Main column */}
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 space-y-6 min-w-0">

            {/* Booking Overview — the hero / first thing admins read */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                {(() => {
                  const cover = booking.trips?.cover_image_url || booking.trips?.image_url;
                  return cover ? (
                    <img src={cover} alt={booking.trips?.title || ''} className="w-full sm:w-40 h-32 sm:h-28 rounded-lg object-cover flex-shrink-0 border border-[#ECECEE]" />
                  ) : (
                    <div className="w-full sm:w-40 h-32 sm:h-28 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center flex-shrink-0"><MapPin className="h-6 w-6 text-purple-300" /></div>
                  );
                })()}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{booking.trips?.title || 'Trip'}</h1>
                      <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-purple-600" />{booking.trips?.destination || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5">
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Departure</p><p className="text-sm font-medium text-gray-900 mt-0.5">{fmtDate(booking.departure_date || booking.trips?.start_date)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />Pickup</p><p className="text-sm font-medium text-gray-900 mt-0.5">{booking.pickup_point || '—'}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" />Passengers</p><p className="text-sm font-medium text-gray-900 mt-0.5">{booking.number_of_participants || 1}</p></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Traveller Details — primary content */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-purple-600" />Traveller Details</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg flex-shrink-0">{(passengerName[0] || '?').toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">{passengerName}</p>
                    <p className="text-sm text-gray-500">{booking.primary_passenger_age ? `${booking.primary_passenger_age} yrs` : ''}{booking.primary_passenger_age && booking.primary_passenger_gender ? ' • ' : ''}<span className="capitalize">{booking.primary_passenger_gender || ''}</span></p>
                  </div>
                </div>
                {passengerPhone !== 'N/A' && (
                  <div className="flex gap-2 flex-shrink-0 print:hidden">
                    <a href={`tel:${passengerPhone}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-100 transition-colors"><Phone className="h-4 w-4" />Call</a>
                    <a href={`https://wa.me/91${String(passengerPhone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0"><Phone className="h-4 w-4 text-gray-400 flex-shrink-0" /><span className="text-gray-500 w-14 flex-shrink-0">Phone</span><span className="text-gray-900 truncate">{passengerPhone}</span></div>
                <div className="flex items-center gap-2 min-w-0"><Mail className="h-4 w-4 text-gray-400 flex-shrink-0" /><span className="text-gray-500 w-14 flex-shrink-0">Email</span><span className="text-gray-900 truncate">{passengerEmail}</span></div>
              </div>

              {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
                <div className="mt-3 pt-3 border-t border-[#ECECEE]">
                  <p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1.5 mb-1"><Heart className="h-3 w-3 text-pink-500" />Emergency contact</p>
                  <p className="text-sm text-gray-900">{booking.emergency_contact_name || '—'}{booking.emergency_contact_phone ? <span className="text-gray-500"> · {booking.emergency_contact_phone}</span> : ''}</p>
                </div>
              )}

              <details className="mt-3 pt-3 border-t border-[#ECECEE] group" {...(booking.passengers && booking.passengers.length > 0 ? { open: true } : {})}>
                <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Co-passengers ({booking.passengers?.length || 0})
                </summary>
                {booking.passengers && booking.passengers.length > 0 ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {booking.passengers.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-[#FAFAFA] rounded-lg px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{((p.name || 'P')[0]).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name || `Passenger ${i + 1}`}</p>
                          <p className="text-xs text-gray-500">{[p.age && `${p.age} yrs`, p.gender, p.phone].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">No additional travellers on this booking.</p>
                )}
              </details>
            </div>

            {/* Booking Summary — the ONLY place totals appear */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-purple-600" />Booking Summary</h2>
              <dl className="space-y-2">
                <div className="flex items-baseline justify-between"><dt className="text-sm text-gray-500">Base Trip Amount</dt><dd className="text-base font-medium text-gray-900">₹{listGross.toLocaleString('en-IN')}</dd></div>
                {couponDiscountRaw > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-green-600">Coupon Discount {booking.coupon_code ? `(${booking.coupon_code})` : ''}</dt><dd className="text-base font-medium text-green-600">-₹{couponDiscountRaw.toLocaleString('en-IN')}</dd></div>
                )}
                {walletUsed > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-green-600">Wallet Used</dt><dd className="text-base font-medium text-green-600">-₹{walletUsed.toLocaleString('en-IN')}</dd></div>
                )}
                <div className="flex items-baseline justify-between pt-2 border-t border-[#ECECEE]"><dt className="text-sm font-medium text-gray-700">Net Trip Price</dt><dd className="text-base font-semibold text-gray-900">₹{finalAmount.toLocaleString('en-IN')}</dd></div>
                <div className="flex items-baseline justify-between"><dt className="text-sm text-gray-500">Paid</dt><dd className="text-base font-semibold text-green-700">₹{paidAmount.toLocaleString('en-IN')}</dd></div>
                {waivedAmount > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-gray-500 flex items-center gap-1.5">Written off <button onClick={() => settleBalance(true)} className="text-[11px] font-semibold text-purple-600 hover:underline">(undo)</button></dt><dd className="text-base font-medium text-gray-500">-₹{waivedAmount.toLocaleString('en-IN')}</dd></div>
                )}
                {money.refunded > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-rose-600">Refunded</dt><dd className="text-base font-medium text-rose-600">-₹{money.refunded.toLocaleString('en-IN')}</dd></div>
                )}
                <div className="flex items-baseline justify-between pt-3 border-t border-[#ECECEE]"><dt className="text-sm font-medium text-gray-700">Remaining Offline Balance</dt><dd className={remainingAmount > 0 ? 'text-2xl font-bold text-orange-600' : 'text-base font-bold text-green-700'}>{remainingAmount > 0 ? `₹${remainingAmount.toLocaleString('en-IN')}` : waivedAmount > 0 ? 'Settled' : 'None'}</dd></div>
              </dl>
              {/* Payment Status is independent of Booking Status — a confirmed booking can still owe a balance. */}
              {remainingAmount > 0 && !['cancelled', 'rejected'].includes(status) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
                  <IndianRupee className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span><strong>₹{remainingAmount.toLocaleString('en-IN')}</strong> to be collected offline during the trip.
                  {(() => {
                    const due = resolveDueDate(booking.departure_date || booking.trips?.start_date, booking.trips?.payment_due_days_before, dueDaysBefore);
                    const pb = status === 'seat_locked' && due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                    return pb ? <> Due by <strong>{pb}</strong>.</> : null;
                  })()}
                  </span>
                </div>
              )}
            </div>

        {/* Payment history — what happened, no totals */}
        {booking.payment_transactions && booking.payment_transactions.length > 0 ? (
          <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden print:shadow-none">
            <div className="px-4 sm:px-5 py-3 border-b border-[#ECECEE] flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Receipt className="h-4 w-4 text-purple-600" />Payment History</h2>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {booking.payment_transactions
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((t: any, i: number) => {
                  const isVerified = t.payment_status === 'verified';
                  const isRejected = t.payment_status === 'rejected';
                  const last = i === booking.payment_transactions.length - 1;
                  return (
                    <div key={t.id} className="relative flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
                        <span className={`h-3 w-3 rounded-full ring-4 ring-white ${isVerified ? 'bg-green-500' : isRejected ? 'bg-red-500' : 'bg-amber-500'}`} />
                        {!last && <span className="w-px flex-1 bg-[#ECECEE] my-1" />}
                      </div>
                      <div
                        className={`flex-1 min-w-0 rounded-xl border p-3 sm:p-4 ${
                          isVerified ? 'border-green-200 bg-green-50/60'
                          : isRejected ? 'border-red-200 bg-red-50/60'
                          : 'border-yellow-200 bg-yellow-50/60'
                        }`}
                      >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-md bg-white border ${
                            isVerified ? 'border-green-200 text-green-700'
                            : isRejected ? 'border-red-200 text-red-700'
                            : 'border-yellow-200 text-yellow-700'
                          }`}>
                            #{i + 1} · {(t.payment_mode || t.payment_type || 'payment').toString().replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                          <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isVerified ? 'bg-green-600 text-white'
                            : isRejected ? 'bg-red-600 text-white'
                            : 'bg-yellow-500 text-white'
                          }`}>
                            {t.payment_status}
                          </span>
                        </div>
                        {isVerified ? (
                          <p className="font-bold text-gray-900 flex items-baseline whitespace-nowrap"><IndianRupee className="h-4 w-4" />{parseFloat(String(t.amount)).toLocaleString('en-IN')}</p>
                        ) : (
                          <span className="text-xs text-gray-400 whitespace-nowrap">{isRejected ? 'not collected' : 'awaiting payment'}</span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm text-gray-700">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 font-medium min-w-[80px]">Txn ID:</span>
                          <span className="font-mono break-all">{t.transaction_id}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 font-medium min-w-[80px]">Paid at:</span>
                          <span>{fmtDateTime(t.created_at)}</span>
                        </div>
                        {t.payment_reviewed_at && (
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500 font-medium min-w-[80px]">Reviewed:</span>
                            <span>{fmtDateTime(t.payment_reviewed_at)}</span>
                          </div>
                        )}
                        {t.rejection_reason && (
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500 font-medium min-w-[80px]">Reason:</span>
                            <span className="text-red-700 font-semibold">{t.rejection_reason}</span>
                          </div>
                        )}
                      </div>
                      {t.payment_status === 'pending' && (
                        <button
                          onClick={() => openTransactionModal(t)}
                          className="mt-3 w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-purple-700 transition-colors print:hidden"
                        >
                          Review payment
                        </button>
                      )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#ECECEE] p-8 text-center">
            <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-1">No payments recorded yet.</p>
            <p className="text-xs text-gray-400">Use Actions → Record payment when you collect one.</p>
          </div>
        )}

        {/* Referral details — ADMIN ONLY (never sent to the customer) */}
        {isReferred && (
          <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden print:hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-indigo-100 bg-indigo-50/60 flex items-center gap-2">
              <Gift className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-900">Referral <span className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide">admin-only</span></h2>
            </div>
            <dl className="px-4 sm:px-5 py-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Referred to</dt><dd className="font-semibold text-gray-900">{booking.referral_partner || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Commission / profit</dt><dd className="font-semibold text-green-700">₹{(parseFloat(String(booking.referral_commission || 0)) || 0).toLocaleString('en-IN')}</dd></div>
              {booking.referral_notes && <div className="pt-2 border-t border-gray-100"><dt className="text-gray-500 mb-1">Notes</dt><dd className="text-gray-800 whitespace-pre-wrap">{booking.referral_notes}</dd></div>}
            </dl>
          </div>
        )}

        {/* Internal notes — ADMIN ONLY */}
        <div className="bg-white rounded-xl border border-[#ECECEE] overflow-hidden print:hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-[#ECECEE] flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Internal notes <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">admin-only</span></h2>
          </div>
          <div className="p-4 sm:p-5">
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Customer will pay cash while boarding. Requested front seats. Called and confirmed."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">Never shown to the customer.</p>
              <button onClick={saveInternalNotes} disabled={savingNotes || internalNotes === (booking.internal_notes || '')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-40"><Check className="h-3.5 w-3.5" />{savingNotes ? 'Saving…' : 'Save notes'}</button>
            </div>
          </div>
        </div>

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
                {drawerMode === 'payment' ? <IndianRupee className="h-4.5 w-4.5" /> : drawerMode === 'status' ? <Shield className="h-4.5 w-4.5" /> : <Gift className="h-4.5 w-4.5" />}
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
  green: { tile: 'bg-green-50 text-green-600', label: 'text-gray-800', hover: 'hover:bg-green-50/60' },
  purple: { tile: 'bg-purple-50 text-purple-600', label: 'text-gray-800', hover: 'hover:bg-purple-50/60' },
  indigo: { tile: 'bg-indigo-50 text-indigo-600', label: 'text-gray-800', hover: 'hover:bg-indigo-50/60' },
  gray: { tile: 'bg-gray-100 text-gray-500', label: 'text-gray-800', hover: 'hover:bg-gray-50' },
  red: { tile: 'bg-red-50 text-red-600', label: 'text-red-600', hover: 'hover:bg-red-50/70' },
  rose: { tile: 'bg-rose-50 text-rose-600', label: 'text-rose-600', hover: 'hover:bg-rose-50/70' },
};

function ActionRow({ onClick, icon, tone, label, sub, disabled }: { onClick: () => void; icon: React.ReactNode; tone: keyof typeof ACTION_TONES | string; label: string; sub?: string; disabled?: boolean }) {
  const t = ACTION_TONES[tone] || ACTION_TONES.gray;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${t.hover}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${t.tile}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${t.label}`}>{label}</span>
        {sub && <span className="block text-[11px] text-gray-400 truncate">{sub}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
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

