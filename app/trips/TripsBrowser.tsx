'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IMG } from '@/lib/image';
import { MapPin, Clock, Users, IndianRupee, Tag, Search, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface Trip {
  id: string;
  slug?: string;
  title: string;
  short_description?: string;
  description: string;
  destination: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  duration_days: number;
  duration_text?: string;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date?: string;
  image_url?: string;
  cover_image_url?: string;
  included_features?: string[];
  highlights?: string[];
  is_active: boolean;
  status?: string;
  completed_at?: string;
  postponed_to_date?: string;
  booking_deadline_date?: string;
  seat_lock_price?: number;
  early_bird_price?: number;
  booking_disabled?: boolean;
}

/**
 * Interactive trips browser. Receives server-fetched trips as props (no client
 * data waterfall) and only owns the search/sort/filter UI state plus the
 * auth-gated "Book Now" behaviour. Markup is unchanged from the original page.
 */
export default function TripsBrowser({
  trips,
  completedTrips,
}: {
  trips: Trip[];
  completedTrips: Trip[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'duration'>('newest');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Memoised so we don't re-filter/sort on unrelated re-renders (e.g. auth resolving).
  const filteredTrips = useMemo(() => {
    let filtered = [...trips];

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

    if (selectedDestination) {
      filtered = filtered.filter(trip => trip.destination === selectedDestination);
    }

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
        filtered.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        break;
    }

    return filtered;
  }, [trips, searchQuery, selectedDestination, sortBy]);

  const handleBookNow = (tripId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/auth/signin?redirect=/trips/${tripId}`);
      return;
    }
    router.push(`/trips/${tripId}`);
  };

  const uniqueDestinations = useMemo(
    () => Array.from(new Set(trips.map(trip => trip.destination))).sort(),
    [trips]
  );

  return (
    <>
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

      {/* Available Trips — only show trips that are not completed/cancelled/postponed */}
      {(() => {
        const availableToShow = filteredTrips.filter(t => !['completed', 'cancelled', 'postponed'].includes(t.status || ''));
        return availableToShow.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Trips</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {availableToShow.map((trip) => {
              const availableSpots = trip.max_participants ? (trip.max_participants - trip.current_participants) : Infinity;
              const displayImage = trip.cover_image_url || trip.image_url;
              const displayDescription = trip.short_description || trip.description;

              return (
                <div
                  key={trip.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-200"
                >
                  {/* Image */}
                  {displayImage ? (
                    <Link href={`/trips/${trip.slug || trip.id}`} className="block relative h-48 sm:h-56 bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${IMG.cardLarge(displayImage)})` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                    </Link>
                  ) : (
                    <Link href={`/trips/${trip.slug || trip.id}`} className="block relative h-48 sm:h-56 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
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
                    <Link href={`/trips/${trip.slug || trip.id}`} className="block mb-2">
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
                        <span className="font-medium">{(trip as any).duration_text || `${trip.duration_days} Days`}</span>
                      </div>
                      <div className="h-4 w-px bg-gray-300"></div>
                      <div className="flex items-center">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        <span className="font-medium">Small group</span>
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
                    {trip.max_participants && availableSpots > 0 && availableSpots < 5 && (
                      <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-xs text-orange-700 font-medium">
                          Few seats left — booking closing soon!
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/trips/${trip.slug || trip.id}`}
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
        );
      })()}

      {/* Past / Completed Trips - view only, no booking */}
      {completedTrips.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-bold text-gray-700 mb-1 flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
            Past Trips
          </h2>
          <p className="text-sm text-gray-500 mb-4">Past journeys — view details only (booking closed)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {completedTrips.map((trip) => {
              const displayImage = trip.cover_image_url || trip.image_url;
              const displayDescription = trip.short_description || trip.description;
              const pastStatus = trip.status || 'completed';
              const badgeClass = pastStatus === 'cancelled' ? 'bg-red-600' : pastStatus === 'postponed' ? 'bg-orange-600' : 'bg-blue-600';
              const BadgeIcon = pastStatus === 'cancelled' ? XCircle : pastStatus === 'postponed' ? Clock : CheckCircle;
              return (
                <div
                  key={trip.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden opacity-90 hover:opacity-100 transition-opacity"
                >
                  {displayImage ? (
                    <Link href={`/trips/${trip.slug || trip.id}`} className="block relative h-40 sm:h-48 bg-cover bg-center overflow-hidden" style={{ backgroundImage: `url(${IMG.cardLarge(displayImage)})` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
                      <div className={`absolute top-3 right-3 ${badgeClass} text-white px-3 py-1 text-xs font-bold rounded-full shadow flex items-center space-x-1`}>
                        <BadgeIcon className="h-3 w-3" />
                        <span>{pastStatus.charAt(0).toUpperCase() + pastStatus.slice(1)}</span>
                      </div>
                    </Link>
                  ) : (
                    <Link href={`/trips/${trip.slug || trip.id}`} className="block relative h-40 sm:h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                      <div className={`absolute top-3 right-3 ${badgeClass} text-white px-3 py-1 text-xs font-bold rounded-full shadow flex items-center space-x-1`}>
                        <BadgeIcon className="h-3 w-3" />
                        <span>{pastStatus.charAt(0).toUpperCase() + pastStatus.slice(1)}</span>
                      </div>
                      <MapPin className="h-12 w-12 text-gray-300" />
                    </Link>
                  )}
                  <div className="p-4">
                    <Link href={`/trips/${trip.slug || trip.id}`}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2 hover:text-purple-600 transition-colors">
                        {trip.title}
                      </h3>
                    </Link>
                    <div className="flex items-center text-gray-500 mb-2 text-sm">
                      <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                      <span>{trip.destination}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{displayDescription}</p>
                    <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500 mb-4">
                      <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1" />{(trip as any).duration_text || `${trip.duration_days} Days`}</span>
                      <span className="flex items-center"><Users className="h-3.5 w-3.5 mr-1" />Small group</span>
                      {trip.completed_at && (
                        <span>Completed {new Date(trip.completed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                      {pastStatus === 'postponed' && trip.postponed_to_date && (
                        <span className="text-orange-600 font-medium">New date: {new Date(trip.postponed_to_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                    <Link
                      href={`/trips/${trip.slug || trip.id}`}
                      className="block w-full text-center py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      View Trip Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Trips Found — only when there are no available and no past trips */}
      {filteredTrips.length === 0 && completedTrips.length === 0 ? (
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
    </>
  );
}
