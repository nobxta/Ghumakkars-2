'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Clock, Users, IndianRupee, Tag, ArrowRight, Search, Filter, Calendar, TrendingUp } from 'lucide-react';

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
  included_features?: string[];
  highlights?: string[];
  is_active: boolean;
  booking_deadline_date?: string;
  seat_lock_price?: number;
  early_bird_price?: number;
  booking_disabled?: boolean;
}

export default function TripsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'duration'>('newest');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchTrips();
    checkUser();
  }, []);

  useEffect(() => {
    filterAndSortTrips();
  }, [trips, searchQuery, selectedDestination, sortBy]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchTrips = async () => {
    try {
      // Fetch active trips
      const { data: activeData, error: activeError } = await supabase
        .from('trips')
        .select('*')
        .or('is_active.eq.true,status.eq.active,status.eq.scheduled')
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;
      
      // Fetch completed trips separately
      const { data: completedData, error: completedError } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (completedError) console.error('Error fetching completed trips:', completedError);
      
      setTrips(activeData || []);
      setFilteredTrips(activeData || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortTrips = () => {
    let filtered = [...trips];

    // Search filter
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

    // Destination filter
    if (selectedDestination) {
      filtered = filtered.filter(trip => trip.destination === selectedDestination);
    }

    // Sort
    switch (sortBy) {
      case 'price_low':
        filtered.sort((a, b) => a.discounted_price - b.discounted_price);
        break;
      case 'price_high':
        filtered.sort((a, b) => b.discounted_price - a.discounted_price);
        break;
      case 'duration':
        filtered.sort((a, b) => b.duration_days - a.duration_days);
        break;
      case 'newest':
      default:
        // Sort by start_date if created_at doesn't exist
        filtered.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        break;
    }

    setFilteredTrips(filtered);
  };

  const handleBookNow = (tripId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/auth/signin?redirect=/trips/${tripId}`);
      return;
    }
    router.push(`/trips/${tripId}`);
  };

  const uniqueDestinations = Array.from(new Set(trips.map(trip => trip.destination))).sort();

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-24 flex items-center justify-center bg-gradient-to-b from-white via-purple-50/20 to-white">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-4 border-purple-100 border-t-purple-600 mx-auto"></div>
          </div>
          <p className="mt-6 text-base md:text-lg text-purple-600 tracking-wide font-medium">Discovering amazing journeys...</p>
          <p className="mt-2 text-sm text-gray-500">Please wait while we fetch the best trips for you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-8 bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Section */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 tracking-tight">
            Discover Amazing Trips
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            Explore handpicked destinations and carefully planned itineraries for adventurous travelers
          </p>
        </div>

        {/* Filters and Search Section */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-100 outline-none transition-all text-gray-900 placeholder-gray-400 bg-white"
            />
          </div>

          {/* Destination Filter */}
          <div className="sm:w-36">
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-100 outline-none transition-all text-gray-900 appearance-none cursor-pointer bg-white"
            >
              <option value="">All</option>
              {uniqueDestinations.map(dest => (
                <option key={dest} value={dest}>{dest}</option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="sm:w-32">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:border-purple-500 focus:ring-1 focus:ring-purple-100 outline-none transition-all text-gray-900 appearance-none cursor-pointer bg-white"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price ↑</option>
              <option value="price_high">Price ↓</option>
              <option value="duration">Duration</option>
            </select>
          </div>

          {/* Results Count & Clear */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:w-auto">
            <p className="text-xs text-gray-600 whitespace-nowrap">
              <span className="font-semibold text-gray-900">{filteredTrips.length}</span> {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </p>
            {(searchQuery || selectedDestination) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDestination('');
                  setSortBy('newest');
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors whitespace-nowrap px-2 py-1 hover:bg-purple-50 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Active Trips */}
        {filteredTrips.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Trips</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {filteredTrips.map((trip) => {
                const availableSpots = trip.max_participants - trip.current_participants;
                const displayImage = trip.cover_image_url || trip.image_url;
                const displayDescription = trip.short_description || trip.description;

                return (
                  <div
                    key={trip.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Image */}
                    {displayImage ? (
                      <Link href={`/trips/${trip.id}`} className="block relative h-48 sm:h-56 bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${displayImage})` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                      </Link>
                    ) : (
                      <Link href={`/trips/${trip.id}`} className="block relative h-48 sm:h-56 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                        <MapPin className="h-12 w-12 text-gray-300" />
                      </Link>
                    )}

                    {/* Discount Badge */}
                    {trip.discount_percentage > 0 && (
                      <div className="absolute top-3 right-3 bg-purple-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-lg flex items-center space-x-1">
                        <Tag className="h-3 w-3" />
                        <span>{trip.discount_percentage}% OFF</span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4 sm:p-5">
                      <Link href={`/trips/${trip.id}`} className="block mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-purple-600 transition-colors">
                          {trip.title}
                        </h3>
                      </Link>

                      <div className="flex items-center text-gray-600 mb-3 text-sm">
                        <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{trip.destination}</span>
                      </div>

                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {displayDescription}
                      </p>

                      {/* Trip Details */}
                      <div className="flex items-center gap-3 mb-4 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1.5" />
                          <span className="font-medium">{trip.duration_days} Days</span>
                        </div>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <div className="flex items-center">
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          <span className="font-medium">{trip.current_participants}/{trip.max_participants}</span>
                        </div>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <div className="flex items-center min-w-0">
                          <Calendar className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                          <span className="font-medium truncate">
                            {new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        {trip.original_price > trip.discounted_price && (
                          <p className="text-xs text-gray-500 line-through mb-1">
                            ₹{trip.original_price.toLocaleString()}
                          </p>
                        )}
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline">
                            <IndianRupee className="h-5 w-5 text-gray-900" />
                            <span className="text-2xl font-bold text-gray-900">{trip.discounted_price.toLocaleString()}</span>
                            <span className="text-xs text-gray-600 ml-1">/person</span>
                          </div>
                          {trip.seat_lock_price && (
                            <div className="text-right">
                              <p className="text-xs text-gray-600">Seat Lock</p>
                              <p className="text-sm font-semibold text-purple-700">
                                ₹{trip.seat_lock_price.toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Available Spots Warning */}
                      {availableSpots > 0 && availableSpots < 5 && (
                        <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-xs text-orange-700 font-medium">
                            Only {availableSpots} {availableSpots === 1 ? 'spot' : 'spots'} left!
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/trips/${trip.id}`}
                          className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors text-center rounded-lg"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={(e) => handleBookNow(trip.id, e)}
                          disabled={availableSpots === 0 || !trip.is_active || trip.booking_disabled}
                          className="flex-1 bg-purple-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-purple-700 transition-colors rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {availableSpots === 0 ? 'Full' : trip.booking_disabled ? 'Bookings Disabled' : 'Book Now'}
                        </button>
                      </div>

                      {/* Login Prompt for Guests */}
                      {!user && (
                        <p className="text-xs text-gray-500 text-center mt-3 pt-3 border-t border-gray-200">
                          <Link href="/auth/signin" className="text-purple-600 hover:text-purple-700 font-medium">
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
          </div>
        )}

        {/* No Trips Found */}
        {filteredTrips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No trips found</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
              We couldn&apos;t find any trips matching your criteria. Try adjusting your search or filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDestination('');
                setSortBy('newest');
              }}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

