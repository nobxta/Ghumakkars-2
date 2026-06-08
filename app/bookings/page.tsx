'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar, ArrowLeft, MapPin, Clock, Users, Package, IndianRupee,
  Tag, CheckCircle, AlertCircle, ArrowRight, Eye, Lock, XCircle,
  CreditCard, Filter, ChevronRight, Wallet
} from 'lucide-react';

interface Booking {
  id: string;
  booking_status: string;
  payment_status?: string;
  payment_method?: string;
  payment_mode?: string;
  payment_amount?: number;
  total_price?: number;
  final_amount?: number;
  coupon_code?: string;
  coupon_discount?: number;
  wallet_amount_used?: number;
  number_of_participants: number;
  primary_passenger_name?: string;
  created_at: string;
  rejection_reason?: string;
  reference_id?: string;
  trips?: {
    id: string;
    title: string;
    destination: string;
    start_date?: string;
    end_date?: string;
    discounted_price?: number;
    image_url?: string;
    cover_image_url?: string;
  };
}

type StatusFilter = 'all' | 'confirmed' | 'seat_locked' | 'pending' | 'cancelled' | 'rejected';

export default function BookingsPage() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth/signin?redirect=/bookings');
        return;
      }
      setUser(currentUser);

      const { data } = await supabase
        .from('bookings')
        .select(`
          id, booking_status, payment_status, payment_method, payment_mode,
          payment_amount, total_price, final_amount, coupon_code, coupon_discount,
          wallet_amount_used, number_of_participants, primary_passenger_name,
          created_at, rejection_reason, reference_id,
          trips (id, title, destination, start_date, end_date, discounted_price, image_url, cover_image_url)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      setBookings((data || []) as any);
      setLoading(false);
    };
    init();
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle className="h-3 w-3" />, label: 'Confirmed' };
      case 'seat_locked':
        return { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Lock className="h-3 w-3" />, label: 'Seat Locked' };
      case 'pending':
        return { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock className="h-3 w-3" />, label: 'Pending Review' };
      case 'remaining_submitted':
        return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Clock className="h-3 w-3" />, label: 'Payment Submitted' };
      case 'cancelled':
        return { color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" />, label: 'Cancelled' };
      case 'rejected':
        return { color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' };
      default:
        return { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: <Clock className="h-3 w-3" />, label: status };
    }
  };

  const getPaymentStatusConfig = (status?: string) => {
    switch (status) {
      case 'verified': case 'paid': return { color: 'text-green-600', label: 'Paid' };
      case 'rejected': return { color: 'text-red-600', label: 'Rejected' };
      case 'pending': return { color: 'text-yellow-600', label: 'Under Review' };
      default: return { color: 'text-gray-500', label: status || 'Pending' };
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'cancelled') return b.booking_status === 'cancelled' || b.booking_status === 'rejected';
    return b.booking_status === statusFilter;
  });

  const counts = {
    all: bookings.length,
    confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
    seat_locked: bookings.filter(b => b.booking_status === 'seat_locked').length,
    pending: bookings.filter(b => ['pending', 'remaining_submitted'].includes(b.booking_status)).length,
    cancelled: bookings.filter(b => ['cancelled', 'rejected'].includes(b.booking_status)).length,
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const formatShortDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14 sm:pt-16 pb-20 sm:pb-8 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <Link href="/profile" className="inline-flex items-center text-purple-600 text-xs sm:text-sm font-medium mb-1">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Profile
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Bookings</h1>
          </div>
          <Link
            href="/trips"
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-purple-700 transition-colors flex items-center space-x-1"
          >
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Explore</span>
          </Link>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex space-x-1.5 sm:space-x-2 mb-4 sm:mb-6 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          {([
            { key: 'all', label: 'All' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'seat_locked', label: 'Locked' },
            { key: 'pending', label: 'Pending' },
            { key: 'cancelled', label: 'Cancelled' },
          ] as { key: StatusFilter; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1 ${
                statusFilter === tab.key
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`${statusFilter === tab.key ? 'bg-white/20' : 'bg-gray-100'} px-1.5 py-0.5 rounded-full text-[10px]`}>
                {counts[tab.key as keyof typeof counts] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <Package className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
              {statusFilter === 'all' ? 'No bookings yet' : `No ${statusFilter} bookings`}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              {statusFilter === 'all' ? 'Start your adventure by booking a trip!' : 'Try a different filter'}
            </p>
            {statusFilter !== 'all' ? (
              <button onClick={() => setStatusFilter('all')} className="text-purple-600 text-sm font-medium">
                Show all bookings
              </button>
            ) : (
              <Link href="/trips" className="inline-flex items-center space-x-1.5 bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                <MapPin className="h-4 w-4" />
                <span>Explore Trips</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredBookings.map((booking) => {
              const status = getStatusConfig(booking.booking_status);
              const paymentStatus = getPaymentStatusConfig(booking.payment_status);
              const amountPaid = parseFloat(String(booking.payment_amount || booking.final_amount || 0));
              const totalPrice = parseFloat(String(booking.total_price || 0));

              return (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className="block bg-white rounded-xl sm:rounded-2xl border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Top: Trip info + status */}
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                          {booking.trips?.title || 'Trip'}
                        </h3>
                        <div className="flex items-center text-[11px] sm:text-xs text-gray-500 mt-0.5">
                          <MapPin className="h-3 w-3 mr-0.5 text-purple-500 flex-shrink-0" />
                          <span className="truncate">{booking.trips?.destination || ''}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border flex items-center space-x-1 whitespace-nowrap ${status.color}`}>
                        {status.icon}
                        <span>{status.label}</span>
                      </span>
                    </div>

                    {/* Date + Participants row */}
                    <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs text-gray-500 mb-2.5">
                      {booking.trips?.start_date && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-0.5 text-purple-400" />
                          {formatShortDate(booking.trips.start_date)}
                          {booking.trips.end_date && ` - ${formatShortDate(booking.trips.end_date)}`}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Users className="h-3 w-3 mr-0.5 text-purple-400" />
                        {booking.number_of_participants} pax
                      </span>
                      {booking.primary_passenger_name && (
                        <span className="truncate hidden sm:block">
                          {booking.primary_passenger_name}
                        </span>
                      )}
                    </div>

                    {/* Payment summary row */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Amount */}
                        <div>
                          <p className="text-[10px] text-gray-400">Paid</p>
                          <p className="text-sm sm:text-base font-bold text-gray-900 flex items-center">
                            <IndianRupee className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            {amountPaid.toLocaleString()}
                          </p>
                        </div>
                        {totalPrice > amountPaid && (
                          <div>
                            <p className="text-[10px] text-gray-400">Total</p>
                            <p className="text-xs sm:text-sm text-gray-500 flex items-center">
                              <IndianRupee className="h-2.5 w-2.5" />
                              {totalPrice.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {booking.coupon_code && (
                          <div className="hidden sm:block">
                            <p className="text-[10px] text-gray-400">Coupon</p>
                            <p className="text-xs text-green-600 font-medium flex items-center">
                              <Tag className="h-2.5 w-2.5 mr-0.5" />
                              {booking.coupon_code}
                              {booking.coupon_discount ? ` (-₹${parseFloat(String(booking.coupon_discount)).toLocaleString()})` : ''}
                            </p>
                          </div>
                        )}
                        {booking.wallet_amount_used && booking.wallet_amount_used > 0 && (
                          <div className="hidden sm:block">
                            <p className="text-[10px] text-gray-400">Wallet</p>
                            <p className="text-xs text-purple-600 font-medium flex items-center">
                              <Wallet className="h-2.5 w-2.5 mr-0.5" />
                              -₹{parseFloat(String(booking.wallet_amount_used)).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] sm:text-xs font-medium ${paymentStatus.color}`}>
                          {paymentStatus.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>

                    {/* Status messages */}
                    {booking.booking_status === 'seat_locked' && (
                      <div className="mt-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[10px] sm:text-xs text-amber-700 font-medium flex items-center">
                          <Lock className="h-3 w-3 mr-1 flex-shrink-0" />
                          Remaining payment due before trip. Tap to pay.
                        </p>
                      </div>
                    )}
                    {booking.booking_status === 'pending' && (
                      <div className="mt-2 px-2.5 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-[10px] sm:text-xs text-yellow-700 font-medium flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                          Payment under review. We&apos;ll notify you once verified.
                        </p>
                      </div>
                    )}
                    {booking.booking_status === 'remaining_submitted' && (
                      <div className="mt-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-[10px] sm:text-xs text-blue-700 font-medium flex items-center">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          Remaining payment submitted. Awaiting verification.
                        </p>
                      </div>
                    )}
                    {(booking.booking_status === 'rejected' || booking.payment_status === 'rejected') && (
                      <div className="mt-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-[10px] sm:text-xs text-red-700 font-medium flex items-center">
                          <XCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                          {booking.rejection_reason || 'Payment rejected. Contact support.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer: booked date + ID */}
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      Booked {formatDate(booking.created_at)}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-400 font-mono">
                      #{booking.id.substring(0, 8)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
