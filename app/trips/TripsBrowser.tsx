'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IMG } from '@/lib/image';
import { formatDeparture } from '@/lib/recurrence';
import { upcomingDepartures, todayInIndia } from '@/lib/trip-dates';
import {
  MapPin, Clock, Users, Search, Calendar, CheckCircle, XCircle,
  SlidersHorizontal, ChevronDown, ChevronRight, ArrowUpDown, ArrowRight, X,
} from 'lucide-react';

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
  is_recurring?: boolean;
  recurrence_day?: number | null;
  recurrence_weeks_ahead?: number | null;
  created_at?: string;
}

type SortKey = 'newest' | 'price_low' | 'price_high' | 'duration';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'duration', label: 'Longest duration' },
];

const PAST_STATUSES = ['completed', 'cancelled', 'postponed'];

const inr = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const fmtDate = (d: string) => formatDeparture(d, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Interactive trips browser. Receives server-fetched trips as props (no client
 * data waterfall) and owns the search/sort/filter UI state plus the
 * auth-gated "Book Now" behaviour.
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
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  // Upcoming departures per trip (recurring schedule or one-off date, past dates excluded).
  const departuresById = useMemo(() => {
    const today = todayInIndia();
    const map: Record<string, string[]> = {};
    trips.forEach((t) => { map[t.id] = upcomingDepartures(t, today); });
    return map;
  }, [trips]);

  // Memoised so we don't re-filter/sort on unrelated re-renders (e.g. auth resolving).
  const filteredTrips = useMemo(() => {
    let filtered = trips.filter((t) => !PAST_STATUSES.includes(t.status || ''));

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
        filtered.sort((a, b) => Number(a.discounted_price) - Number(b.discounted_price));
        break;
      case 'price_high':
        filtered.sort((a, b) => Number(b.discounted_price) - Number(a.discounted_price));
        break;
      case 'duration':
        filtered.sort((a, b) => b.duration_days - a.duration_days);
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
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

  const clearAll = () => {
    setSearchQuery('');
    setSelectedDestination('');
    setSortBy('newest');
  };

  const countLabel = `${filteredTrips.length} ${filteredTrips.length === 1 ? 'trip' : 'trips'}`;

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destinations, trips..."
            aria-label="Search trips"
            className="w-full h-11 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-label="Open filters"
          className="relative inline-flex items-center justify-center gap-2 h-11 w-11 sm:w-auto sm:px-4 shrink-0 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {selectedDestination && (
            <span className="absolute -top-1 -right-1 sm:static h-4 min-w-[1rem] px-1 rounded-full bg-purple-600 text-[10px] leading-4 text-white">1</span>
          )}
        </button>

        <div className="relative hidden sm:block shrink-0">
          <ArrowUpDown className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort trips"
            className="h-11 pl-10 pr-9 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl shadow-sm appearance-none cursor-pointer outline-none transition hover:border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
        </div>

        <p className="hidden md:block shrink-0 text-sm text-slate-500 whitespace-nowrap" aria-live="polite">{countLabel}</p>
      </div>

      {/* Mobile count + applied filters */}
      <div className="mb-4 sm:mb-5 flex flex-wrap items-center gap-2 min-h-[1.5rem]">
        <p className="md:hidden text-xs text-slate-500" aria-live="polite">{countLabel}</p>
        {selectedDestination && (
          <button
            type="button"
            onClick={() => setSelectedDestination('')}
            className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            aria-label={`Remove filter ${selectedDestination}`}
          >
            <MapPin className="h-3 w-3" aria-hidden />
            {selectedDestination}
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
        {sortBy !== 'newest' && (
          <span className="sm:hidden inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            <ArrowUpDown className="h-3 w-3" aria-hidden />
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
          </span>
        )}
        {(searchQuery || selectedDestination || sortBy !== 'newest') && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-purple-600 hover:text-purple-700 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
            Clear all
          </button>
        )}
        {!user && (
          <p className="ml-auto text-xs text-slate-500">
            <Link href="/auth/signin" className="font-medium text-purple-600 hover:text-purple-700">Sign in</Link> to book
          </p>
        )}
      </div>

      {/* Available trips */}
      {filteredTrips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              departures={departuresById[trip.id] || []}
              onBook={handleBookNow}
            />
          ))}
        </div>
      )}

      {/* No results for current filters */}
      {filteredTrips.length === 0 && (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
          <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" aria-hidden />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">No trips found</h2>
          <p className="text-slate-500 mb-5 max-w-md mx-auto text-sm">
            We couldn&apos;t find any trips matching your criteria. Try adjusting your search or filters.
          </p>
          <button
            onClick={clearAll}
            className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Past / Completed Trips - view only, no booking */}
      {completedTrips.length > 0 && (
        <section className="mt-10 pt-8 border-t border-slate-200">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" aria-hidden />
            Past Trips
          </h2>
          <p className="text-sm text-slate-500 mt-0.5 mb-4">Past journeys — view details only (booking closed)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {completedTrips.map((trip) => {
              const displayImage = trip.cover_image_url || trip.image_url;
              const pastStatus = trip.status || 'completed';
              const badgeClass = pastStatus === 'cancelled' ? 'bg-red-600' : pastStatus === 'postponed' ? 'bg-orange-600' : 'bg-blue-600';
              const BadgeIcon = pastStatus === 'cancelled' ? XCircle : pastStatus === 'postponed' ? Clock : CheckCircle;
              const href = `/trips/${trip.slug || trip.id}`;
              return (
                <article key={trip.id} className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
                  <Link
                    href={href}
                    className="relative block aspect-[16/8] bg-slate-100 bg-cover bg-center"
                    style={displayImage ? { backgroundImage: `url(${IMG.cardLarge(displayImage)})` } : undefined}
                    aria-label={trip.title}
                  >
                    {!displayImage && <MapPin className="absolute inset-0 m-auto h-10 w-10 text-slate-300" aria-hidden />}
                    <span className={`absolute top-3 right-3 ${badgeClass} text-white px-2.5 py-1 text-xs font-semibold rounded-full shadow flex items-center gap-1`}>
                      <BadgeIcon className="h-3 w-3" aria-hidden />
                      {pastStatus.charAt(0).toUpperCase() + pastStatus.slice(1)}
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col p-4">
                    <Link href={href} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                      <h3 className="text-base font-semibold text-slate-800 line-clamp-1 hover:text-purple-600 transition-colors">{trip.title}</h3>
                    </Link>
                    <div className="mt-2 mb-3 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1" aria-hidden />{trip.destination}</span>
                      <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1" aria-hidden />{trip.duration_text || `${trip.duration_days} Days`}</span>
                      {trip.completed_at && (
                        <span>Completed {new Date(trip.completed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                      {pastStatus === 'postponed' && trip.postponed_to_date && (
                        <span className="text-orange-600 font-medium">New date: {fmtDate(trip.postponed_to_date.slice(0, 10))}</span>
                      )}
                    </div>
                    <Link
                      href={href}
                      className="mt-auto block w-full text-center py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                      View Trip Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {filtersOpen && (
        <FilterPanel
          destinations={uniqueDestinations}
          destination={selectedDestination}
          sortBy={sortBy}
          onApply={(dest, sort) => {
            setSelectedDestination(dest);
            setSortBy(sort);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </>
  );
}

function TripCard({
  trip,
  departures,
  onBook,
}: {
  trip: Trip;
  departures: string[];
  onBook: (tripId: string, e: React.MouseEvent) => void;
}) {
  const [showDates, setShowDates] = useState(false);
  const href = `/trips/${trip.slug || trip.id}`;
  const displayImage = trip.cover_image_url || trip.image_url;
  const displayDescription = trip.short_description || trip.description;
  const availableSpots = trip.max_participants ? (trip.max_participants - trip.current_participants) : Infinity;
  const price = Number(trip.discounted_price);
  const original = Number(trip.original_price);
  const seatLock = Number(trip.seat_lock_price || 0);
  const bookDisabled = availableSpots === 0 || !trip.is_active || !!trip.booking_disabled;

  return (
    <article className="group flex flex-col bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
      <Link
        href={href}
        aria-label={trip.title}
        className="relative block aspect-[2/1] sm:aspect-[16/9] bg-slate-100 bg-cover bg-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
        style={displayImage ? { backgroundImage: `url(${IMG.cardLarge(displayImage)})` } : undefined}
      >
        {!displayImage && <MapPin className="absolute inset-0 m-auto h-10 w-10 text-slate-300" aria-hidden />}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 max-w-[65%] rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-purple-600" aria-hidden />
          <span className="truncate">{trip.destination}</span>
        </span>
        {trip.discount_percentage > 0 && (
          <span className="absolute top-3 right-3 rounded-full bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            {trip.discount_percentage}% OFF
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={href} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
          <h3 className="text-[17px] sm:text-lg font-semibold leading-snug text-slate-900 line-clamp-1 group-hover:text-purple-700 transition-colors">
            {trip.title}
          </h3>
        </Link>

        <div className="mt-2.5 flex items-center gap-3 text-[13px] text-slate-600">
          <span className="flex items-center gap-1.5 min-w-0">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">{trip.duration_text || `${trip.duration_days} Days`}</span>
          </span>
          <span className="h-3.5 w-px bg-slate-200" aria-hidden />
          <span className="flex items-center gap-1.5 shrink-0">
            <Users className="h-4 w-4 text-slate-400" aria-hidden />
            Small group
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[13px] text-slate-600">
          <span className="flex items-center gap-1.5 min-w-0">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="whitespace-nowrap">
              {departures.length > 0
                ? <><span className="hidden min-[400px]:inline">Next departure:</span><span className="min-[400px]:hidden">Next:</span> <span className="font-medium text-slate-800">{fmtDate(departures[0])}</span></>
                : 'Dates to be announced'}
            </span>
          </span>
          {departures.length > 1 && (
            <button
              type="button"
              onClick={() => setShowDates((v) => !v)}
              aria-expanded={showDates}
              className="shrink-0 inline-flex items-center gap-0.5 rounded px-1 -mr-1 py-0.5 text-[13px] font-medium text-purple-600 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              {showDates ? 'Hide dates' : 'View all dates'}
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showDates ? 'rotate-90' : ''}`} aria-hidden />
            </button>
          )}
        </div>

        {showDates && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Upcoming departures for ${trip.title}`}>
            {departures.map((d) => (
              <li key={d} className="rounded-lg border border-purple-100 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                {formatDeparture(d, { weekday: 'short', day: 'numeric', month: 'short' })}
              </li>
            ))}
          </ul>
        )}

        {displayDescription && (
          <p className="mt-2.5 text-[13px] leading-relaxed text-slate-500 line-clamp-2">{displayDescription}</p>
        )}

        {trip.max_participants && availableSpots > 0 && availableSpots < 5 && (
          <p className="mt-2 text-xs font-medium text-orange-600">Few seats left — booking closing soon!</p>
        )}

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-1.5 leading-none whitespace-nowrap">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">₹{inr(price)}</span>
                {original > price && (
                  <span className="text-xs text-slate-400 line-through">₹{inr(original)}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">per person</p>
            </div>
            <Link
              href={href}
              className="h-10 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              View Details
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 pl-3 pr-1 py-1">
            <p className="min-w-0 truncate text-xs text-slate-600">
              {seatLock > 0
                ? <>Lock your seat at <span className="font-semibold text-purple-700">₹{inr(seatLock)}</span></>
                : 'Reserve your spot'}
            </p>
            <button
              type="button"
              onClick={(e) => onBook(trip.id, e)}
              disabled={bookDisabled}
              className="h-9 shrink-0 inline-flex items-center gap-1 rounded-lg px-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              {availableSpots === 0 ? 'Full' : trip.booking_disabled ? 'Bookings Disabled' : 'Book Now'}
              {!bookDisabled && <ChevronRight className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Right-side drawer on desktop, bottom sheet on mobile. Changes apply on "Apply". */
function FilterPanel({
  destinations,
  destination,
  sortBy,
  onApply,
  onClose,
}: {
  destinations: string[];
  destination: string;
  sortBy: SortKey;
  onApply: (destination: string, sortBy: SortKey) => void;
  onClose: () => void;
}) {
  const [draftDest, setDraftDest] = useState(destination);
  const [draftSort, setDraftSort] = useState<SortKey>(sortBy);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
      active ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
    }`;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="trip-filters-title">
      <button type="button" aria-label="Close filters" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-2xl bg-white shadow-2xl flex flex-col outline-none"
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="trip-filters-title" className="text-base font-semibold text-slate-900">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className="h-9 w-9 -mr-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <fieldset>
            <legend className="mb-2.5 text-sm font-semibold text-slate-900">Destination</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={draftDest === ''} onClick={() => setDraftDest('')} className={chip(draftDest === '')}>All</button>
              {destinations.map((d) => (
                <button key={d} type="button" aria-pressed={draftDest === d} onClick={() => setDraftDest(d)} className={chip(draftDest === d)}>{d}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-sm font-semibold text-slate-900">Sort by</legend>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value} type="button" aria-pressed={draftSort === o.value} onClick={() => setDraftSort(o.value)} className={chip(draftSort === o.value)}>{o.label}</button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex gap-3 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100">
          <button
            type="button"
            onClick={() => { setDraftDest(''); setDraftSort('newest'); }}
            className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply(draftDest, draftSort)}
            className="flex-1 h-11 rounded-xl bg-purple-600 text-sm font-semibold text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
