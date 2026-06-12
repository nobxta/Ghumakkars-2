'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart,
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle,
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Check, X,
  Printer, Copy, FileText, Tag, Shield
} from 'lucide-react';

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

  const rejectionReasons = [
    { value: 'fake_payment', label: 'Fake Payment / Invalid Transaction ID' },
    { value: 'fake_details', label: 'Fake Details / Invalid Information' },
    { value: 'seats_full', label: 'Seats Full' },
    { value: 'other', label: 'Other (specify in notes)' },
  ];

  useEffect(() => {
    checkUser();
    fetchBooking();
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

  // total_price = original price, final_amount = price after coupon
  // The user only owes final_amount. Don't show remaining for unpaid coupon discount.
  const originalPrice = parseFloat(String(booking.total_price || 0));
  const finalAmount = parseFloat(String(booking.final_amount || booking.total_price || 0));
  const paidAmount = parseFloat(String(booking.payment_amount || booking.amount_paid || 0));
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || Math.max(0, originalPrice - finalAmount);
  const totalAmount = finalAmount; // what the customer actually owes
  const remainingAmount = Math.max(0, finalAmount - paidAmount);
  const status = booking.booking_status || 'pending';
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
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-b from-purple-50/40 via-white to-white print:bg-white print:pt-0 print:pb-0">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 print:py-3">
        {/* Top actions */}
        <div className="mb-5 sm:mb-6 print:hidden flex items-center justify-between gap-2 flex-wrap">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center text-purple-700 hover:text-purple-900 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>All Bookings</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={copyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-semibold hover:border-purple-300 hover:text-purple-700 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy ID</span>
            </button>
            <button
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Hero / receipt header */}
        <div className="rounded-2xl overflow-hidden shadow-md border border-purple-100 bg-white mb-5 sm:mb-6 print:shadow-none print:border-gray-300">
          <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-fuchsia-700 text-white p-5 sm:p-6 print:bg-purple-700 print:!text-white">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-purple-200 font-semibold mb-1">Booking Receipt</p>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight truncate">
                  {booking.trips?.title || 'Trip'}
                </h1>
                <p className="text-sm text-purple-100 mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {booking.trips?.destination || 'N/A'}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white shadow-sm whitespace-nowrap ${
                status === 'confirmed' ? 'text-green-700'
                : status === 'seat_locked' ? 'text-orange-700'
                : status === 'pending' ? 'text-yellow-700'
                : 'text-red-700'
              }`}>
                {getStatusIcon(status)}
                <span>
                  {status === 'seat_locked' ? 'Seat Locked' : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
              <div>
                <p className="text-purple-200 uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Ref</p>
                <p className="font-mono font-bold mt-0.5">{shortId}</p>
              </div>
              <div>
                <p className="text-purple-200 uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Dates</p>
                <p className="font-semibold mt-0.5 truncate">{fmtDate(booking.trips?.start_date)}{booking.trips?.end_date ? ` → ${fmtDate(booking.trips?.end_date)}` : ''}</p>
              </div>
              <div>
                <p className="text-purple-200 uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Guests</p>
                <p className="font-semibold mt-0.5">{booking.number_of_participants || 1}</p>
              </div>
            </div>
          </div>

          {/* Payment KPI strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-200 bg-white">
            <div className="p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Payable</p>
              <p className="text-base sm:text-xl font-extrabold text-gray-900 mt-0.5 flex items-baseline justify-center">
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />{finalAmount.toLocaleString('en-IN')}
              </p>
              {couponDiscount > 0 && (
                <p className="text-[10px] text-gray-400 line-through mt-0.5">₹{originalPrice.toLocaleString('en-IN')}</p>
              )}
            </div>
            <div className="p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Paid</p>
              <p className="text-base sm:text-xl font-extrabold text-green-700 mt-0.5 flex items-baseline justify-center">
                <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />{paidAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 sm:p-4 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">{remainingAmount > 0 ? 'Due' : 'Saved'}</p>
              {remainingAmount > 0 ? (
                <p className="text-base sm:text-xl font-extrabold mt-0.5 flex items-baseline justify-center text-orange-600">
                  <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />{remainingAmount.toLocaleString('en-IN')}
                </p>
              ) : couponDiscount > 0 ? (
                <p className="text-base sm:text-xl font-extrabold mt-0.5 flex items-baseline justify-center text-green-700">
                  <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />{couponDiscount.toLocaleString('en-IN')}
                </p>
              ) : (
                <p className="text-base sm:text-xl font-extrabold mt-0.5 text-gray-400">—</p>
              )}
              {!remainingAmount && couponDiscount > 0 && booking.coupon_code && (
                <p className="text-[10px] text-green-700 font-semibold mt-0.5">{booking.coupon_code}</p>
              )}
            </div>
          </div>
        </div>

        {/* Two-column grid on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {/* Trip details */}
          <SectionCard icon={<Calendar className="h-4 w-4 text-purple-700" />} title="Trip Details">
            {booking.departure_date
              ? <Row label="Departure" value={fmtDate(booking.departure_date)} />
              : <Row label="Start" value={fmtDate(booking.trips?.start_date)} />}
            {!booking.departure_date && <Row label="End" value={fmtDate(booking.trips?.end_date)} />}
            {booking.pickup_point && <Row label="Pickup point" value={booking.pickup_point} />}
            <Row label="Booked on" value={fmtDateTime(booking.created_at)} />
            <Row label="Booking ID" value={<span className="font-mono text-xs break-all">{booking.id}</span>} />
          </SectionCard>

          {/* Primary passenger */}
          <SectionCard icon={<User className="h-4 w-4 text-purple-700" />} title="Primary Passenger">
            <Row label="Name" value={passengerName} />
            <Row label="Email" value={<span className="break-all">{passengerEmail}</span>} />
            <Row label="Phone" value={<a href={`tel:${passengerPhone}`} className="text-purple-700 hover:underline">{passengerPhone}</a>} />
            <Row label="Age / Gender" value={`${booking.primary_passenger_age || '—'} · ${booking.primary_passenger_gender || '—'}`} />
            {booking.college && <Row label="College" value={booking.college} />}
          </SectionCard>

          {/* Emergency contact */}
          {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
            <SectionCard icon={<Heart className="h-4 w-4 text-pink-600" />} title="Emergency Contact" iconBg="bg-pink-100">
              <Row label="Name" value={booking.emergency_contact_name || 'N/A'} />
              <Row label="Phone" value={
                <a href={`tel:${booking.emergency_contact_phone}`} className="text-purple-700 hover:underline">
                  {booking.emergency_contact_phone || 'N/A'}
                </a>
              } />
            </SectionCard>
          )}

          {/* Discount/coupon (if any) */}
          {booking.coupon_code && (
            <SectionCard icon={<Tag className="h-4 w-4 text-green-700" />} title="Discount" iconBg="bg-green-100">
              <Row label="Coupon" value={<span className="font-mono font-bold text-green-700">{booking.coupon_code}</span>} />
              {booking.coupon_discount && (
                <Row label="Saved" value={
                  <span className="text-green-700 font-bold inline-flex items-baseline">
                    <IndianRupee className="h-3.5 w-3.5" />{parseFloat(String(booking.coupon_discount)).toLocaleString('en-IN')}
                  </span>
                } />
              )}
            </SectionCard>
          )}
        </div>

        {/* Additional passengers — full width */}
        {booking.passengers && booking.passengers.length > 0 && (
          <div className="mt-4 sm:mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-purple-700" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Additional Passengers ({booking.passengers.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {booking.passengers.map((p: any, i: number) => (
                <div key={i} className="px-4 sm:px-5 py-3 sm:py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Passenger {i + 1}</p>
                    <p className="font-bold text-gray-900 mt-0.5">{p.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Phone</p>
                    <p className="text-gray-900 mt-0.5">{p.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Age</p>
                    <p className="text-gray-900 mt-0.5">{p.age || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Gender</p>
                    <p className="text-gray-900 mt-0.5 capitalize">{p.gender || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment timeline */}
        {booking.payment_transactions && booking.payment_transactions.length > 0 && (
          <div className="mt-4 sm:mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-purple-700" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Payment Timeline</h2>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {booking.payment_transactions
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((t: any, i: number) => {
                  const isVerified = t.payment_status === 'verified';
                  const isRejected = t.payment_status === 'rejected';
                  const tone = isVerified ? 'green' : isRejected ? 'red' : 'yellow';
                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl border p-3 sm:p-4 ${
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
                        <p className="font-extrabold text-gray-900 flex items-baseline whitespace-nowrap">
                          <IndianRupee className="h-4 w-4" />{parseFloat(String(t.amount)).toLocaleString('en-IN')}
                        </p>
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
                  );
                })}
            </div>
          </div>
        )}

        {/* Seat lock deadline */}
        {status === 'seat_locked' && booking.trips?.start_date && (
          <div className="mt-4 sm:mt-5 bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-orange-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-orange-900 mb-1">Remaining payment deadline</p>
                <p className="text-sm text-orange-800">
                  Must be paid before <strong>{fmtDate(new Date(new Date(booking.trips.start_date).setDate(new Date(booking.trips.start_date).getDate() - 5)).toISOString())}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

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

