'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart,
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle,
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Check, X,
  Printer, Copy, FileText, Tag, Shield, MessageCircle, ChevronRight, Wallet, Receipt
} from 'lucide-react';
import { resolveDueDate } from '@/lib/payment-due';

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
  const [cashMode, setCashMode] = useState<'cash' | 'upi'>('cash');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonPreset, setCancelReasonPreset] = useState('');
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [dueDaysBefore, setDueDaysBefore] = useState<number>(5);

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
  const originalPrice = parseFloat(String(booking.total_price || 0));
  const isSeatLock = booking.payment_method === 'seat_lock' || status === 'seat_locked';
  // Full amount the customer owes after coupon + wallet. Seat-lock bookings only
  // store the deposit in total_price/final_amount, so the full cost comes from
  // list price × pax.
  const listGross = (parseFloat(String(booking.trips?.discounted_price || 0)) || 0) * pax;
  const finalAmount = isSeatLock
    ? Math.max(0, listGross - couponDiscountRaw - walletUsed)
    : (parseFloat(String(booking.final_amount || booking.total_price || 0)));
  // Money actually received: verified transactions (online) or amount_paid (offline).
  const txnPaid = (booking.payment_transactions || [])
    .filter((p: any) => p.payment_status === 'verified')
    .reduce((s: number, p: any) => s + parseFloat(String(p.amount || 0)), 0);
  const paidAmount = txnPaid || parseFloat(String(booking.payment_amount || booking.amount_paid || 0));
  const couponDiscount = couponDiscountRaw || Math.max(0, originalPrice - parseFloat(String(booking.final_amount || 0)));
  const totalAmount = finalAmount; // what the customer actually owes
  const remainingAmount = Math.max(0, finalAmount - paidAmount);
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
    <div className="min-h-screen pt-16 pb-24 bg-[#FAFAFA] tabular-nums print:bg-white print:pt-0 print:pb-0">
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
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link href="/admin/bookings" className="inline-flex items-center text-gray-600 hover:text-gray-900 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Bookings</span>
          </Link>
          <button onClick={copyId} title="Copy full booking ID" className="group inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900 hover:text-purple-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1">
            #{shortId}
            <Copy className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-600" />
          </button>
          {(() => {
            const m: Record<string, { l: string; c: string; d: string }> = {
              confirmed: { l: 'Confirmed', c: 'bg-green-50 text-green-700 border-green-200', d: 'bg-green-500' },
              seat_locked: { l: 'Seat Locked', c: 'bg-amber-50 text-amber-700 border-amber-200', d: 'bg-amber-500' },
              remaining_submitted: { l: 'Verifying payment', c: 'bg-blue-50 text-blue-700 border-blue-200', d: 'bg-blue-500' },
              pending: { l: 'Pending', c: 'bg-yellow-50 text-yellow-700 border-yellow-200', d: 'bg-yellow-500' },
              cancelled: { l: 'Cancelled', c: 'bg-red-50 text-red-700 border-red-200', d: 'bg-red-500' },
              rejected: { l: 'Rejected', c: 'bg-red-50 text-red-700 border-red-200', d: 'bg-red-500' },
            };
            const s = m[status] || { l: status, c: 'bg-gray-100 text-gray-700 border-gray-200', d: 'bg-gray-400' };
            return (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${s.c}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.d}`} />{s.l}
              </span>
            );
          })()}
          <button
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Printer className="h-3.5 w-3.5 text-gray-500" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 print:py-3">
        {/* Conditional action banner — only when an admin action is required */}
        {(() => {
          const pendingTxn = (booking.payment_transactions || []).find((t: any) => t.payment_status === 'pending');
          if (pendingTxn) {
            return (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 border-l-4 border-l-amber-500 p-4 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
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
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 border-l-4 border-l-amber-500 p-4 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Lock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-900"><span className="font-bold">₹{remainingAmount.toLocaleString('en-IN')}</span> balance due to confirm this seat. Record it when collected.</p>
                </div>
                <button onClick={() => setShowActionsDrawer(true)} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"><IndianRupee className="h-4 w-4" />Record payment</button>
              </div>
            );
          }
          return null;
        })()}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
          {/* Right rail — Actions + Contact */}
          <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[7.5rem] space-y-4 lg:mb-0">
            {/* Actions */}
            <div className="bg-white border border-[#ECECEE] rounded-xl overflow-hidden print:hidden">
              <p className="px-5 pt-4 pb-1 text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Actions</p>
              {!['cancelled', 'rejected'].includes(status) ? (
                <>
                  <button onClick={() => setShowActionsDrawer(true)} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-800 hover:bg-[#FAFAFA] border-t border-[#ECECEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><span className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-gray-400" />Record payment</span><ChevronRight className="h-4 w-4 text-gray-400" /></button>
                  <button onClick={() => setShowActionsDrawer(true)} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-800 hover:bg-[#FAFAFA] border-t border-[#ECECEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><span className="flex items-center gap-2"><Shield className="h-4 w-4 text-gray-400" />Change status</span><ChevronRight className="h-4 w-4 text-gray-400" /></button>
                  <button onClick={() => typeof window !== 'undefined' && window.print()} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-800 hover:bg-[#FAFAFA] border-t border-[#ECECEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><span className="flex items-center gap-2"><Printer className="h-4 w-4 text-gray-400" />Print / Download PDF</span><ChevronRight className="h-4 w-4 text-gray-400" /></button>
                  <button onClick={() => { setCancelReason(''); setCancelReasonPreset(''); setShowCancelModal(true); }} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-red-600 hover:bg-red-50 border-t border-[#ECECEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><span className="flex items-center gap-2"><XCircle className="h-4 w-4" />Cancel booking</span><ChevronRight className="h-4 w-4 text-red-300" /></button>
                </>
              ) : (
                <>
                  <button disabled={managing} onClick={() => manageBooking({ action: 'set_status', status: 'pending' }, 'Reopen this booking (back to pending)? No email is sent.')} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-800 hover:bg-[#FAFAFA] border-t border-[#ECECEE] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />Reopen (pending)</span><ChevronRight className="h-4 w-4 text-gray-400" /></button>
                  <button onClick={() => typeof window !== 'undefined' && window.print()} className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-800 hover:bg-[#FAFAFA] border-t border-[#ECECEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><span className="flex items-center gap-2"><Printer className="h-4 w-4 text-gray-400" />Print / Download PDF</span><ChevronRight className="h-4 w-4 text-gray-400" /></button>
                </>
              )}
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
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 space-y-4 min-w-0">

            {/* Booking Overview — the hero / first thing admins read */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-5 sm:p-6">
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
                      <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 leading-tight">{booking.trips?.title || 'Trip'}</h1>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-purple-600" />{booking.trips?.destination || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3">
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Departure</p><p className="text-sm font-medium text-gray-900 mt-0.5">{fmtDate(booking.departure_date || booking.trips?.start_date)}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />Pickup</p><p className="text-sm font-medium text-gray-900 mt-0.5">{booking.pickup_point || '—'}</p></div>
                    <div><p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" />Passengers</p><p className="text-sm font-medium text-gray-900 mt-0.5">{booking.number_of_participants || 1}</p></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Traveller Details — primary content */}
            <div className="bg-white rounded-xl border border-[#ECECEE] p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><User className="h-4 w-4 text-purple-600" />Traveller Details</h2>
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

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2 min-w-0"><Phone className="h-4 w-4 text-gray-400 flex-shrink-0" /><span className="text-gray-500 w-14 flex-shrink-0">Phone</span><span className="text-gray-900 truncate">{passengerPhone}</span></div>
                <div className="flex items-center gap-2 min-w-0"><Mail className="h-4 w-4 text-gray-400 flex-shrink-0" /><span className="text-gray-500 w-14 flex-shrink-0">Email</span><span className="text-gray-900 truncate">{passengerEmail}</span></div>
              </div>

              {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
                <div className="mt-4 pt-4 border-t border-[#ECECEE]">
                  <p className="text-[11px] uppercase tracking-wide font-medium text-gray-500 flex items-center gap-1.5 mb-1"><Heart className="h-3 w-3 text-pink-500" />Emergency contact</p>
                  <p className="text-sm text-gray-900">{booking.emergency_contact_name || '—'}{booking.emergency_contact_phone ? <span className="text-gray-500"> · {booking.emergency_contact_phone}</span> : ''}</p>
                </div>
              )}

              <details className="mt-4 pt-4 border-t border-[#ECECEE] group" {...(booking.passengers && booking.passengers.length > 0 ? { open: true } : {})}>
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
            <div className="bg-white rounded-xl border border-[#ECECEE] p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Wallet className="h-4 w-4 text-purple-600" />Booking Summary</h2>
              <dl className="space-y-3">
                <div className="flex items-baseline justify-between"><dt className="text-sm text-gray-500">Base Trip Amount</dt><dd className="text-base font-medium text-gray-900">₹{listGross.toLocaleString('en-IN')}</dd></div>
                {couponDiscountRaw > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-green-600">Coupon Discount {booking.coupon_code ? `(${booking.coupon_code})` : ''}</dt><dd className="text-base font-medium text-green-600">-₹{couponDiscountRaw.toLocaleString('en-IN')}</dd></div>
                )}
                {walletUsed > 0 && (
                  <div className="flex items-baseline justify-between"><dt className="text-sm text-green-600">Wallet Used</dt><dd className="text-base font-medium text-green-600">-₹{walletUsed.toLocaleString('en-IN')}</dd></div>
                )}
                <div className="flex items-baseline justify-between pt-2 border-t border-[#ECECEE]"><dt className="text-sm font-medium text-gray-700">Net Trip Price</dt><dd className="text-base font-semibold text-gray-900">₹{finalAmount.toLocaleString('en-IN')}</dd></div>
                <div className="flex items-baseline justify-between"><dt className="text-sm text-gray-500">Amount Paid {isSeatLock ? '(Seat Locked)' : ''}</dt><dd className="text-base font-semibold text-green-700">₹{paidAmount.toLocaleString('en-IN')}</dd></div>
                <div className="flex items-baseline justify-between pt-3 border-t border-[#ECECEE]"><dt className="text-sm font-medium text-gray-700">Remaining Balance</dt><dd className={remainingAmount > 0 ? 'text-2xl font-bold text-orange-600' : 'text-base font-bold text-green-700'}>{remainingAmount > 0 ? `₹${remainingAmount.toLocaleString('en-IN')}` : 'Cleared'}</dd></div>
              </dl>
              {status === 'seat_locked' && remainingAmount > 0 && (() => {
                const due = resolveDueDate(booking.departure_date || booking.trips?.start_date, booking.trips?.payment_due_days_before, dueDaysBefore);
                const pb = due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                return pb ? <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"><Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />Pay before <strong>{pb}</strong> to confirm the seat.</div> : null;
              })()}
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
                            #{i + 1} · {t.payment_type === 'seat_lock' ? 'Seat Lock' : t.payment_type === 'remaining' ? 'Remaining' : 'Full Payment'}
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

      {/* Actions drawer — record payment + change status (progressive disclosure) */}
      {showActionsDrawer && !['cancelled', 'rejected'].includes(status) && (
        <div className="fixed inset-0 z-50 print:hidden" onClick={() => setShowActionsDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl overflow-y-auto animate-[toast-in_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#ECECEE] px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-base font-semibold text-gray-900">Booking actions</h2>
              <button onClick={() => setShowActionsDrawer(false)} className="p-1.5 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"><X className="h-5 w-5 text-gray-600" /></button>
            </div>
            <div className="p-5 space-y-6">
              {/* Record payment */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Record a payment taken in person</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IndianRupee className="h-4 w-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input type="number" min="1" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Amount" className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" />
                  </div>
                  <select value={cashMode} onChange={(e) => setCashMode(e.target.value as 'cash' | 'upi')} className="px-2.5 py-2 text-sm font-semibold border border-gray-300 rounded-lg bg-white text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
                <button disabled={managing || !cashAmount} onClick={async () => { await manageBooking({ action: 'record_payment', amount: cashAmount, mode: cashMode }); setShowActionsDrawer(false); }} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"><Check className="h-4 w-4" />Record &amp; update</button>
                <p className="text-[11px] text-gray-400 mt-1.5">If it covers the balance ({remainingAmount > 0 ? `₹${remainingAmount.toLocaleString('en-IN')} due` : 'fully paid'}), the booking is confirmed and the traveller is emailed. Otherwise it stays seat-locked.</p>
              </div>

              {/* Change status */}
              <div className="pt-5 border-t border-[#ECECEE]">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Change status</p>
                <div className="flex flex-col gap-2">
                  {status !== 'confirmed' && <button disabled={managing} onClick={async () => { await manageBooking({ action: 'set_status', status: 'confirmed' }, 'Mark this booking as CONFIRMED and email the traveller?'); setShowActionsDrawer(false); }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"><CheckCircle className="h-4 w-4" />Mark confirmed</button>}
                  {status !== 'seat_locked' && <button disabled={managing} onClick={async () => { await manageBooking({ action: 'set_status', status: 'seat_locked' }, 'Move this booking to SEAT LOCKED and email the traveller?'); setShowActionsDrawer(false); }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"><Lock className="h-4 w-4" />Move to seat locked</button>}
                  <button disabled={managing} onClick={() => { setShowActionsDrawer(false); setCancelReason(''); setCancelReasonPreset(''); setShowCancelModal(true); }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><XCircle className="h-4 w-4" />Cancel booking</button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Refunds are manual in Razorpay — cancelling only frees the seat and notifies the traveller.</p>
              </div>
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

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
                This frees the seat, removes the booking from revenue, and emails the traveller. <strong>Any refund must be issued separately in Razorpay</strong> — this does not move money.
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
                    await manageBooking({ action: 'set_status', status: 'cancelled', reason: cancelReason.trim() });
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
    </div>
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

