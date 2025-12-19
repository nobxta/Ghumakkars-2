'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ArrowLeft, MapPin, Calendar, Users, IndianRupee, Edit, 
  CheckCircle, XCircle, Clock, Package, CreditCard, TrendingUp,
  DollarSign, User, Mail, Phone, Eye, AlertCircle
} from 'lucide-react';

export default function AdminTripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [trip, setTrip] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkUser();
    fetchTripDetails();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push('/auth/signin?redirect=/admin/trips');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  const fetchTripDetails = async () => {
    try {
      const response = await fetch(`/api/admin/trips/${params.id}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch trip details (${response.status})`;
        
        // Try to parse error message from JSON, but handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status-based message
            if (response.status === 405) {
              errorMessage = 'Method not allowed. The API endpoint may not support this request.';
            } else if (response.status === 404) {
              errorMessage = 'Trip not found.';
            } else if (response.status === 403) {
              errorMessage = 'Access forbidden. Admin privileges required.';
            } else if (response.status === 401) {
              errorMessage = 'Unauthorized. Please sign in.';
            }
          }
        }
        
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
      }

      const data = await response.json();
      
      setTrip(data.trip);
      setBookings(data.bookings || []);
      setMetrics(data.metrics);

      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching trip details:', error);
      setError(error.message || 'Failed to load trip details');
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
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'seat_locked':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/admin/trips"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Trips</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/admin/trips" 
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to All Trips</span>
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {trip.title}
              </h1>
              <p className="text-sm text-gray-600 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-purple-600" />
                {trip.destination}
              </p>
            </div>
            <Link
              href={`/admin/trips/edit/${trip.id}`}
              className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              <Edit className="h-5 w-5" />
              <span>Edit Trip</span>
            </Link>
          </div>
        </div>

        {/* Revenue & Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Revenue</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600 flex items-center">
              <IndianRupee className="h-6 w-6" />
              {metrics?.totalRevenue?.toLocaleString() || '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">From verified payments</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Bookings</p>
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{metrics?.totalBookings || 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics?.confirmedBookings || 0} confirmed, {metrics?.pendingBookings || 0} pending
            </p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Participants</p>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{metrics?.totalParticipants || 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              {trip.current_participants || 0}/{trip.max_participants || 0} capacity
            </p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Avg Booking Value</p>
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600 flex items-center">
              <IndianRupee className="h-6 w-6" />
              {metrics?.averageBookingValue?.toFixed(0) || '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per confirmed booking</p>
          </div>
        </div>

        {/* Trip Information */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 text-purple-600 mr-2" />
            Trip Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Destination</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{trip.destination}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Start Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">End Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Duration</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{trip.duration_days || 0} days</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Price</p>
              <p className="font-semibold text-purple-600 text-sm sm:text-base flex items-center">
                <IndianRupee className="h-4 w-4" />
                {trip.discounted_price?.toLocaleString() || '0'}
                {trip.original_price && trip.original_price > trip.discounted_price && (
                  <span className="text-xs text-gray-500 line-through ml-2">
                    ₹{trip.original_price.toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                trip.is_active
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}>
                {trip.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Bookings Section */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 text-purple-600 mr-2" />
            All Bookings ({bookings.length})
          </h2>
          {bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const user = booking.profiles;
                const verifiedPayments = booking.payment_transactions
                  ?.filter((pt: any) => pt.payment_status === 'verified')
                  .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;

                return (
                  <div
                    key={booking.id}
                    className="border-2 border-purple-100 rounded-lg p-3 sm:p-4 hover:border-purple-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                      {/* User Info - Compact */}
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                              {user?.first_name && user?.last_name 
                                ? `${user.first_name} ${user.last_name}` 
                                : user?.first_name || user?.email || 'User'}
                            </p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusColor(booking.booking_status || 'pending')}`}>
                              {getStatusIcon(booking.booking_status || 'pending')}
                              <span className="ml-1 hidden sm:inline">
                                {(booking.booking_status || 'pending') === 'seat_locked' 
                                  ? 'Seat Locked' 
                                  : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')
                                }
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                            <span className="flex items-center">
                              <Mail className="h-3 w-3 mr-1 text-purple-600" />
                              <span className="truncate">{user?.email || 'N/A'}</span>
                            </span>
                            {user?.phone && (
                              <span className="flex items-center">
                                <Phone className="h-3 w-3 mr-1 text-purple-600" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Booking Metrics - Compact Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 lg:gap-3 flex-shrink-0">
                        <div className="bg-purple-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Participants</p>
                          <p className="font-semibold text-gray-900 text-sm flex items-center">
                            <Users className="h-3 w-3 mr-1 text-purple-600" />
                            {booking.number_of_participants || 1}
                          </p>
                        </div>
                        <div className="bg-purple-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Total</p>
                          <p className="font-semibold text-purple-600 text-sm flex items-center">
                            <IndianRupee className="h-3 w-3" />
                            {parseFloat(String(booking.final_amount || 0)).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Paid</p>
                          <p className="font-semibold text-green-600 text-sm flex items-center">
                            <IndianRupee className="h-3 w-3" />
                            {verifiedPayments.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Date</p>
                          <p className="font-semibold text-gray-900 text-sm">
                            {new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>

                      {/* Actions - Compact */}
                      <div className="flex items-center gap-2 lg:flex-col lg:items-end lg:gap-1 flex-shrink-0">
                        <Link
                          href={`/admin/users/${user?.id || booking.user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                        >
                          <User className="h-3 w-3" />
                          <span className="hidden sm:inline">Profile</span>
                        </Link>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          <span className="hidden sm:inline">Details</span>
                        </Link>
                        {booking.coupon_code && (
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded text-center">
                            {booking.coupon_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No bookings found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

