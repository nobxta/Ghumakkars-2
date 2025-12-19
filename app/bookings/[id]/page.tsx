'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart, 
  GraduationCap, CreditCard, IndianRupee, Lock, CheckCircle, 
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Save
} from 'lucide-react';

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  discounted_price?: number;
  seat_lock_price?: number;
}

interface Booking {
  id: string;
  booking_status: string;
  payment_status?: string;
  payment_method?: string;
  transaction_id?: string;
  payment_amount?: number;
  total_price?: number;
  final_amount?: number;
  coupon_code?: string;
  coupon_discount?: number;
  number_of_participants: number;
  primary_passenger_name?: string;
  primary_passenger_email?: string;
  primary_passenger_phone?: string;
  primary_passenger_gender?: string;
  primary_passenger_age?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  college?: string;
  passengers?: any[];
  created_at: string;
  rejection_reason?: string;
  trips?: Trip;
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<{ qrUrl?: string; upiId?: string }>({});
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchBooking();
    fetchPaymentSettings();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push(`/auth/signin?redirect=/bookings/${params.id}`);
      return;
    }
    setUser(currentUser);
  };

  const fetchBooking = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          trips (
            id,
            title,
            destination,
            start_date,
            end_date,
            discounted_price,
            seat_lock_price
          )
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      // Verify user owns this booking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (data.user_id !== currentUser?.id) {
        setError('Unauthorized access');
        return;
      }

      setBooking(data);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      setError(error.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch('/api/payment/settings');
      if (response.ok) {
        const data = await response.json();
        setPaymentSettings(data);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const calculateRemainingAmount = () => {
    if (!booking?.trips || booking.payment_method !== 'seat_lock') return 0;
    const fullPrice = (booking.trips.discounted_price || 0) * (booking.number_of_participants || 1);
    const paidAmount = parseFloat(String(booking.payment_amount || booking.final_amount || 0));
    return Math.max(0, fullPrice - paidAmount);
  };

  const handlePayRemaining = async () => {
    if (!transactionId.trim()) {
      setError('Please enter Transaction ID');
      return;
    }

    if (!booking) {
      setError('Booking not found');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Use API route to submit remaining payment (handles RLS)
      const response = await fetch('/api/bookings/submit-remaining-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          transactionId: transactionId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit remaining payment');
      }

      // Refresh booking data
      await fetchBooking();
      
      // Show success message
      alert('Remaining payment submitted successfully! We will review and confirm shortly.');
      
      // Reset form
      setShowPaymentSection(false);
      setTransactionId('');
      
      // Refresh the page to show updated status
      router.refresh();
    } catch (error: any) {
      console.error('Error submitting remaining payment:', error);
      setError(error.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
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
            href="/bookings"
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

  const remainingAmount = calculateRemainingAmount();
  const showRemainingPayment = booking.booking_status === 'seat_locked' && booking.payment_method === 'seat_lock' && remainingAmount > 0;

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/bookings" 
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to Bookings</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking Details</h1>
          <p className="text-sm text-gray-600">Booking ID: <span className="font-mono">{booking.id.substring(0, 8)}...</span></p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* Trip Information Card */}
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
                {booking.number_of_participants}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Booking Status</p>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(booking.booking_status)}`}>
                {getStatusIcon(booking.booking_status)}
                <span className="ml-1.5">
                  {booking.booking_status === 'seat_locked' ? 'Seat Locked' : booking.booking_status}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Primary Passenger Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 text-purple-600 mr-2" />
            Primary Passenger
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Name</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{booking.primary_passenger_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center break-all">
                <Mail className="h-4 w-4 mr-1 text-purple-600 flex-shrink-0" />
                <span className="truncate">{booking.primary_passenger_email || 'N/A'}</span>
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Phone</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Phone className="h-4 w-4 mr-1 text-purple-600" />
                {booking.primary_passenger_phone || 'N/A'}
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

        {/* Additional Passengers Card */}
        {booking.passengers && booking.passengers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 text-purple-600 mr-2" />
              Additional Passengers ({booking.passengers.length})
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {booking.passengers.map((passenger: any, index: number) => (
                <div key={index} className="bg-purple-50 rounded-lg p-3 sm:p-4 border border-purple-100">
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

        {/* Emergency Contact Card */}
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

        {/* Payment Details Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 text-purple-600 mr-2" />
            Payment Details
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Payment Method</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                  {booking.payment_method === 'seat_lock' ? 'Seat Lock (Partial Payment)' : 'Full Payment'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Payment Status</p>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  booking.payment_status === 'verified'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : booking.payment_status === 'rejected'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                }`}>
                  {booking.payment_status || 'Pending'}
                </span>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Transaction ID</p>
                <p className="font-semibold text-gray-900 font-mono text-xs sm:text-sm break-all">
                  {booking.transaction_id || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Amount Paid</p>
                <p className="font-semibold text-purple-600 text-base sm:text-lg flex items-center">
                  <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
                  {parseFloat(String(booking.payment_amount || booking.final_amount || 0)).toLocaleString()}
                </p>
              </div>
              {booking.total_price && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                    <IndianRupee className="h-4 w-4" />
                    {parseFloat(String(booking.total_price)).toLocaleString()}
                  </p>
                </div>
              )}
              {booking.coupon_code && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Coupon Applied</p>
                  <p className="font-semibold text-green-600 text-sm sm:text-base">{booking.coupon_code}</p>
                  {booking.coupon_discount && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Discount: ₹{parseFloat(String(booking.coupon_discount)).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Remaining Payment Section */}
            {showRemainingPayment && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-6 mt-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm sm:text-base font-semibold text-orange-900 mb-1">Remaining Payment Required</p>
                    <p className="text-2xl sm:text-3xl font-bold text-orange-600 flex items-center">
                      <IndianRupee className="h-6 w-6 sm:h-7 sm:w-7" />
                      {remainingAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
                {booking.trips?.start_date && (
                  <p className="text-xs sm:text-sm text-orange-700 mb-4">
                    Due before: {new Date(new Date(booking.trips.start_date).setDate(new Date(booking.trips.start_date).getDate() - 5)).toLocaleDateString()}
                  </p>
                )}

                {!showPaymentSection ? (
                  <button
                    onClick={() => setShowPaymentSection(true)}
                    className="w-full bg-orange-600 text-white px-6 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2 shadow-lg"
                  >
                    <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Pay Remaining Amount</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    {/* Payment Instructions */}
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                      <p className="text-sm font-semibold text-gray-900 mb-3">Payment Instructions</p>
                      
                      {paymentSettings.qrUrl && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-600 mb-2">Scan QR Code:</p>
                          <div className="bg-white p-3 rounded-lg border-2 border-gray-200 inline-block">
                            <img 
                              src={paymentSettings.qrUrl} 
                              alt="Payment QR Code" 
                              className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                            />
                          </div>
                        </div>
                      )}
                      
                      {paymentSettings.upiId && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-600 mb-2">UPI ID:</p>
                          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                            <p className="font-mono font-semibold text-purple-900 text-sm sm:text-base break-all">
                              {paymentSettings.upiId}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                          Transaction ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder="Enter your transaction ID"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-sm sm:text-base"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Enter the transaction ID from your payment confirmation
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => {
                          setShowPaymentSection(false);
                          setTransactionId('');
                          setError('');
                        }}
                        className="flex-1 px-6 py-3 sm:py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm sm:text-base hover:bg-gray-200 transition-colors"
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePayRemaining}
                        disabled={submitting || !transactionId.trim()}
                        className="flex-1 px-6 py-3 sm:py-4 bg-orange-600 text-white rounded-xl font-semibold text-sm sm:text-base hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
                      >
                        {submitting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            <span>Submit Payment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rejection Reason */}
            {booking.payment_status === 'rejected' && booking.rejection_reason && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{booking.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Booking Metadata */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">
            Booking ID: <span className="font-mono font-semibold">{booking.id}</span>
          </p>
          <p className="text-xs text-gray-600">
            Created: {new Date(booking.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

