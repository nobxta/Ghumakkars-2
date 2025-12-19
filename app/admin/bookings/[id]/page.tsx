'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart, 
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle, 
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Check, X
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

  const totalAmount = parseFloat(String(booking.total_price || 0));
  const paidAmount = parseFloat(String(booking.payment_amount || booking.final_amount || 0));
  const remainingAmount = totalAmount - paidAmount;

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/admin/bookings" 
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to All Bookings</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking Details</h1>
          <p className="text-sm text-gray-600">Booking ID: <span className="font-mono">{booking.id.substring(0, 8)}...</span></p>
        </div>

        {/* Trip Information */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 text-purple-600 mr-2" />
            Trip Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Trip Title</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.trips?.title || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Destination</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.trips?.destination || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Start Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {booking.trips?.start_date ? new Date(booking.trips.start_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">End Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {booking.trips?.end_date ? new Date(booking.trips.end_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Participants</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Users className="h-4 w-4 mr-1 text-purple-600" />
                {booking.number_of_participants || 1}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Booking Status</p>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(booking.booking_status || 'pending')}`}>
                {getStatusIcon(booking.booking_status || 'pending')}
                <span className="ml-1.5">
                  {(booking.booking_status || 'pending') === 'seat_locked' 
                    ? 'Seat Locked' 
                    : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')
                  }
                </span>
              </span>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Booking Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                {new Date(booking.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Booking ID</p>
              <p className="font-semibold text-gray-900 font-mono text-xs break-all">{booking.id}</p>
            </div>
          </div>
        </div>

        {/* Primary Passenger */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 text-purple-600 mr-2" />
            Primary Passenger
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Name</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.primary_passenger_name || booking.profiles?.first_name && booking.profiles?.last_name ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center break-all">
                <Mail className="h-4 w-4 mr-1 text-purple-600 flex-shrink-0" />
                <span className="truncate">{booking.primary_passenger_email || booking.profiles?.email || 'N/A'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Phone</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Phone className="h-4 w-4 mr-1 text-purple-600" />
                {booking.primary_passenger_phone || booking.profiles?.phone || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Gender</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.primary_passenger_gender || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Age</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.primary_passenger_age || 'N/A'}</p>
            </div>
            {booking.college && (
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">College</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                  <GraduationCap className="h-4 w-4 mr-1 text-purple-600" />
                  {booking.college}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Passengers */}
        {booking.passengers && booking.passengers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 text-purple-600 mr-2" />
              Additional Passengers ({booking.passengers.length})
            </h2>
            <div className="space-y-4">
              {booking.passengers.map((passenger: any, index: number) => (
                <div key={index} className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Passenger {index + 1}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Name</p>
                      <p className="text-sm font-medium text-gray-900">{passenger.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{passenger.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Age</p>
                      <p className="text-sm font-medium text-gray-900">{passenger.age || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Gender</p>
                      <p className="text-sm font-medium text-gray-900">{passenger.gender || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Heart className="h-5 w-5 text-purple-600 mr-2" />
              Emergency Contact
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Name</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.emergency_contact_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Phone</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                  <Phone className="h-4 w-4 mr-1 text-purple-600" />
                  {booking.emergency_contact_phone || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 text-purple-600 mr-2" />
            Payment Summary
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="font-semibold text-gray-900 text-lg flex items-center">
                  <IndianRupee className="h-5 w-5" />
                  {totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
                <p className="font-semibold text-green-600 text-lg flex items-center">
                  <IndianRupee className="h-5 w-5" />
                  {paidAmount.toLocaleString()}
                </p>
              </div>
              {remainingAmount > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Remaining Amount</p>
                  <p className="font-semibold text-orange-600 text-lg flex items-center">
                    <IndianRupee className="h-5 w-5" />
                    {remainingAmount.toLocaleString()}
                  </p>
                </div>
              )}
              {booking.coupon_code && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Coupon Applied</p>
                  <p className="font-semibold text-green-600">{booking.coupon_code}</p>
                  {booking.coupon_discount && (
                    <p className="text-xs text-gray-500 mt-1">
                      Discount: ₹{parseFloat(String(booking.coupon_discount)).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Transactions Timeline */}
            {booking.payment_transactions && booking.payment_transactions.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Payment Timeline</p>
                <div className="space-y-3">
                  {booking.payment_transactions
                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((transaction: any, index: number) => (
                      <div 
                        key={transaction.id} 
                        className={`p-4 rounded-xl border-2 ${
                          transaction.payment_status === 'verified' 
                            ? 'bg-green-50 border-green-200' 
                            : transaction.payment_status === 'rejected'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-white">
                                {index + 1}. {transaction.payment_type === 'seat_lock' ? 'Seat Lock Payment' : transaction.payment_type === 'remaining' ? 'Remaining Payment' : 'Full Payment'}
                              </span>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                transaction.payment_status === 'verified' 
                                  ? 'bg-green-100 text-green-700' 
                                  : transaction.payment_status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {transaction.payment_status}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-gray-600">Transaction ID: </span>
                                <span className="font-mono font-semibold text-gray-900">{transaction.transaction_id}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Amount: </span>
                                <span className="font-semibold text-gray-900 flex items-center inline-flex">
                                  <IndianRupee className="h-3 w-3" />
                                  {parseFloat(String(transaction.amount)).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Payment Date: </span>
                                <span className="text-gray-900">
                                  {new Date(transaction.created_at).toLocaleString()}
                                </span>
                              </div>
                              {transaction.payment_reviewed_at && (
                                <div>
                                  <span className="text-gray-600">Reviewed: </span>
                                  <span className="text-gray-900">
                                    {new Date(transaction.payment_reviewed_at).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {transaction.rejection_reason && (
                                <div>
                                  <span className="text-gray-600">Rejection Reason: </span>
                                  <span className="text-red-700">{transaction.rejection_reason}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {transaction.payment_status === 'pending' && (
                            <button
                              onClick={() => openTransactionModal(transaction)}
                              className="ml-4 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Payment Deadline for Seat Lock */}
            {booking.booking_status === 'seat_locked' && booking.trips?.start_date && (
              <div className="mt-4 bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-1">Remaining Payment Deadline</p>
                    <p className="text-sm text-orange-700">
                      Remaining amount must be paid before: {new Date(new Date(booking.trips.start_date).setDate(new Date(booking.trips.start_date).getDate() - 5)).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Review Modal */}
      {showPaymentModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
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

