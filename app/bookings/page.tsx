'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Calendar, ArrowLeft, MapPin, Clock, Users, Package, IndianRupee, Tag, CheckCircle, AlertCircle, ArrowRight, Search, Eye, Lock } from 'lucide-react';

interface Trip {
  id: string;
  title: string;
  short_description?: string;
  description: string;
  destination: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  duration_days: number;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date?: string;
  image_url?: string;
  cover_image_url?: string;
  is_active: boolean;
  booking_deadline_date?: string;
  seat_lock_price?: number;
  booking_disabled?: boolean;
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

export default function BookingsPage() {
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'trips'>('bookings');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchBookings();
      setActiveTab('bookings');
    } else {
      fetchTrips();
      setActiveTab('trips');
    }
  }, [user]);

  // Check for booking success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const bookingId = params.get('booking_id');
    if (success === 'true' && bookingId && user) {
      // Refresh bookings to show new booking
      fetchBookings();
      setActiveTab('bookings');
      // Clear URL params
      window.history.replaceState({}, '', '/bookings');
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const fetchBookings = async () => {
    try {
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          trips (
            id,
            title,
            destination,
            start_date,
            end_date,
            image_url,
            discounted_price,
            seat_lock_price
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
      } else {
        setBookings(bookingsData || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: true });

      if (error) throw error;
      
      // Filter trips based on search query
      let filtered = data || [];
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          trip =>
            trip.title.toLowerCase().includes(query) ||
            trip.destination.toLowerCase().includes(query) ||
            trip.description?.toLowerCase().includes(query) ||
            trip.short_description?.toLowerCase().includes(query)
        );
      }
      setTrips(filtered);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      fetchTrips();
    }
  }, [searchQuery, user]);

  const handleBookNow = (tripId: string) => {
    if (!user) {
      router.push(`/auth/signin?redirect=/trips/${tripId}`);
      return;
    }
    router.push(`/trips/${tripId}`);
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
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  const availableTrips = trips.filter(trip => {
    const availableSpots = trip.max_participants - trip.current_participants;
    const isDeadlinePassed = trip.booking_deadline_date 
      ? new Date(trip.booking_deadline_date) < new Date()
      : false;
    return availableSpots > 0 && !isDeadlinePassed;
  });

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link href={user ? "/profile" : "/"} className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 md:mb-8 text-sm font-medium transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>{user ? 'Back to Profile' : 'Back to Home'}</span>
        </Link>

        {/* Tab Navigation */}
        {user && (
          <div className="mb-6 flex space-x-2 border-b-2 border-purple-100">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              My Bookings ({bookings.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('trips');
                fetchTrips();
              }}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'trips'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              Available Trips
            </button>
          </div>
        )}

        {/* Bookings Tab */}
        {(!user || activeTab === 'bookings') && user && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8">
            <div className="flex items-center space-x-3 mb-6 md:mb-8">
              <Calendar className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
              <h1 className="text-2xl md:text-3xl font-light text-gray-900">My Bookings</h1>
            </div>

            {/* Success Message */}
            {(() => {
              const params = new URLSearchParams(window.location.search);
              const success = params.get('success');
              const bookingId = params.get('booking_id');
              return success === 'true' && bookingId ? (
                <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-green-900 font-medium mb-1">Booking Submitted Successfully!</p>
                      <p className="text-sm text-green-700">Your booking has been submitted. We&apos;re reviewing your payment and will confirm shortly.</p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {bookings.length === 0 ? (
              <div className="text-center py-12 md:py-16">
                <Package className="h-16 w-16 md:h-20 md:w-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">No bookings yet</h3>
                <p className="text-gray-600 mb-6">Start your adventure by booking your first trip!</p>
                <button
                  onClick={() => {
                    setActiveTab('trips');
                    fetchTrips();
                  }}
                  className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Explore Available Trips</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/bookings/${booking.id}`}
                    className="block border-2 border-purple-100 rounded-xl p-4 md:p-6 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1">
                              {booking.trips?.title || 'Trip'}
                            </h3>
                            <div className="text-sm text-purple-600 font-medium flex items-center space-x-1">
                              <Eye className="h-4 w-4" />
                              <span>View Details</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.booking_status)}`}>
                              {booking.booking_status === 'seat_locked' ? 'Seat Locked' : booking.booking_status}
                            </span>
                            {booking.payment_status && (
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                booking.payment_status === 'verified'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : booking.payment_status === 'rejected'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                              }`}>
                                Payment: {booking.payment_status}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-purple-600" />
                            <span>{booking.trips?.destination || 'Destination'}</span>
                          </div>
                          {booking.trips?.start_date && (
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-purple-600" />
                              <span>
                                {new Date(booking.trips.start_date).toLocaleDateString()} - {booking.trips.end_date ? new Date(booking.trips.end_date).toLocaleDateString() : ''}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-purple-600" />
                            <span>{booking.number_of_participants} participant(s)</span>
                          </div>
                          {booking.booking_status === 'seat_locked' && (
                            <div className="pt-2 border-t border-purple-100">
                              <p className="text-xs text-orange-600 font-medium flex items-center">
                                <Lock className="h-3 w-3 mr-1" />
                                Seat locked. Remaining payment required before trip departure.
                              </p>
                            </div>
                          )}
                          {booking.payment_status === 'pending' && (
                            <div className="pt-2 border-t border-purple-100">
                              <p className="text-xs text-yellow-600 font-medium flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Payment under review. We&apos;ll notify you once verified.
                              </p>
                            </div>
                          )}
                          {booking.payment_status === 'rejected' && (
                            <div className="pt-2 border-t border-purple-100">
                              <p className="text-xs text-red-600 font-medium flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Payment verification failed. Please contact support.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl md:text-3xl font-semibold text-purple-600 flex items-center justify-end">
                          <IndianRupee className="h-5 w-5" />
                          <span>{booking.total_price?.toLocaleString() || booking.trips?.discounted_price?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(booking.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Available Trips Tab */}
        {(!user || activeTab === 'trips') && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center space-x-3">
                <MapPin className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                <h1 className="text-2xl md:text-3xl font-light text-gray-900">
                  {user ? 'Available Trips' : 'Book Your Next Adventure'}
                </h1>
              </div>
            </div>

            {!user && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 font-medium mb-1">Sign in to book a trip</p>
                    <p className="text-sm text-blue-700">You can explore trips without signing in, but you&apos;ll need an account to make a booking.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search trips by title, destination, or description..."
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {availableTrips.length === 0 ? (
              <div className="text-center py-12 md:py-16">
                <MapPin className="h-16 w-16 md:h-20 md:w-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">No trips available</h3>
                <p className="text-gray-600 mb-6">
                  {searchQuery ? 'No trips match your search. Try a different query.' : 'Check back soon for new adventures!'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableTrips.map((trip) => {
                  const availableSpots = trip.max_participants - trip.current_participants;
                  const displayImage = trip.cover_image_url || trip.image_url;
                  const displayDescription = trip.short_description || trip.description;

                  return (
                    <div
                      key={trip.id}
                      className="border-2 border-purple-100 rounded-xl overflow-hidden hover:border-purple-300 hover:shadow-lg transition-all group"
                    >
                      {displayImage ? (
                        <Link href={`/trips/${trip.id}`} className="block relative h-48 bg-cover bg-center" style={{ backgroundImage: `url(${displayImage})` }}>
                          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-purple-900/10 to-transparent"></div>
                        </Link>
                      ) : (
                        <Link href={`/trips/${trip.id}`} className="block relative h-48 bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                          <MapPin className="h-12 w-12 text-purple-300" />
                        </Link>
                      )}

                      {trip.discount_percentage > 0 && (
                        <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 text-xs font-semibold rounded-full flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>{trip.discount_percentage}% OFF</span>
                        </div>
                      )}

                      <div className="p-5">
                        <Link href={`/trips/${trip.id}`}>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                            {trip.title}
                          </h3>
                        </Link>

                        <div className="flex items-center text-purple-600 mb-2 text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span className="uppercase font-medium">{trip.destination}</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {displayDescription}
                        </p>

                        <div className="flex items-center justify-between mb-4 text-xs text-purple-600 border-t border-b border-purple-100 py-2">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{trip.duration_days} Days</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{availableSpots} spots left</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div>
                            {trip.original_price > trip.discounted_price && (
                              <p className="text-xs text-gray-400 line-through flex items-center">
                                <IndianRupee className="h-3 w-3" />
                                <span>{trip.original_price.toLocaleString()}</span>
                              </p>
                            )}
                            <p className="text-xl font-semibold text-gray-900 flex items-center">
                              <IndianRupee className="h-4 w-4" />
                              <span>{trip.discounted_price.toLocaleString()}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleBookNow(trip.id)}
                          className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                        >
                          <span>Book Now</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>

                        {!user && (
                          <p className="text-xs text-gray-500 text-center mt-2">
                            <Link href="/auth/signin" className="text-purple-600 hover:underline">
                              Sign in
                            </Link>
                            {' '}to book
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
