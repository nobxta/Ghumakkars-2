'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { IMG } from '@/lib/image';
import { getSiteUrl } from '@/lib/site-url';
import { MapPin, Clock, Users, IndianRupee, Tag, ArrowLeft, Calendar, Check, AlertCircle, Star, Shield, Heart, Sparkles, Plane, Hotel, UtensilsCrossed, X, CheckCircle, Lock, Share2, ChevronDown, ChevronUp, MessageCircle, Copy, Image as ImageIcon, Phone } from 'lucide-react';

interface ItineraryDay {
  day?: number;
  title: string;
  description: string;
  activities?: string[];
}

interface Trip {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  full_description?: string;
  destination: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  seat_lock_price?: number;
  early_bird_price?: number;
  early_bird_conditions?: any;
  duration_days: number;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date?: string;
  booking_deadline_date?: string;
  image_url?: string;
  cover_image_url?: string;
  gallery_images?: string[];
  included_features?: string[];
  excluded_features?: string[];
  highlights?: string[];
  free_perks?: string[];
  duration_text?: string;
  display_sections?: {
    photos?: boolean;
    itinerary?: boolean;
    highlights?: boolean;
    perks?: boolean;
    included?: boolean;
  };
  day_wise_itinerary?: ItineraryDay[] | any;
  pickup_location?: string;
  whatsapp_group_link?: string;
  is_active: boolean;
  status?: string;
  completed_at?: string;
  postponed_to_date?: string;
  cancellation_reason?: string;
  actual_participants?: number;
  booking_disabled?: boolean;
}

// Client island for the trip detail page. The trip is fetched on the server
// (see page.tsx) and passed in as a prop — this component only owns the
// interactive UI (gallery/lightbox, itinerary accordion, share, book-now auth).
export default function TripDetailClient({ trip }: { trip: Trip }) {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleBookNow = () => {
    if (!user) {
      router.push(`/auth/signin?redirect=/trips/${params.id}`);
      return;
    }
    router.push(`/trips/${params.id}/book`);
  };

  if (!trip) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center bg-gradient-to-b from-purple-50/30 to-white">
        <div className="text-center px-4">
          <MapPin className="h-16 w-16 md:h-20 md:w-20 text-purple-300 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-light text-gray-900 mb-3 tracking-tight">Journey Not Found</h2>
          <p className="text-sm md:text-base text-gray-600 mb-6 font-light">The trip you&apos;re looking for doesn&apos;t exist or has been removed</p>
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-gray-600 font-medium transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const availableSpots = trip.max_participants ? (trip.max_participants - trip.current_participants) : Infinity;
  const isLowAvailability = trip.max_participants ? (availableSpots < 5 && availableSpots > 0) : false;
  const isCompleted = trip.status === 'completed';
  const isCancelled = trip.status === 'cancelled';
  const isPostponed = trip.status === 'postponed';
  const isPastTrip = isCompleted || isCancelled || isPostponed;

  const siteUrl = getSiteUrl();
  const handleShare = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/trips/${trip.id}`;
    const text = `Check out this trip: ${trip.title} (${trip.destination}) — ₹${trip.discounted_price.toLocaleString()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.title, text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  const itineraryDays: ItineraryDay[] = Array.isArray(trip.day_wise_itinerary)
    ? trip.day_wise_itinerary
    : [];
  const galleryImages: string[] = Array.isArray(trip.gallery_images)
    ? trip.gallery_images.filter(Boolean)
    : [];
  const cover = trip.cover_image_url || trip.image_url;
  const heroImages = [cover, ...galleryImages].filter(Boolean) as string[];
  const sections = trip.display_sections || { photos: true, itinerary: true, highlights: true, perks: true, included: true };

  // Early Bird evaluation — check if conditions match
  const earlyBird = (() => {
    const eb: any = trip.early_bird_conditions;
    const ebPrice = trip.early_bird_price;
    if (!eb?.enabled || !ebPrice || ebPrice <= 0 || ebPrice >= trip.discounted_price) return null;
    const conditions = Array.isArray(eb.conditions) ? eb.conditions : [];
    if (conditions.length === 0) return null;

    const now = new Date();
    let isActive = true;
    let status = '';
    let seatsLeft: number | null = null;
    let daysLeft: number | null = null;

    for (const c of conditions) {
      if (c.type === 'date_range' && c.value) {
        const [start, end] = String(c.value).split('|');
        if (start && end) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          if (now < startDate || now > endDate) { isActive = false; break; }
          const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          daysLeft = diff;
        }
      }
      if (c.type === 'first_bookings' && c.value) {
        const limit = parseInt(c.value);
        const taken = trip.current_participants || 0;
        if (taken >= limit) { isActive = false; break; }
        seatsLeft = limit - taken;
      }
    }
    if (!isActive) return null;

    if (seatsLeft !== null && seatsLeft <= 3) {
      status = seatsLeft === 1 ? 'Last early bird seat!' : `Only ${seatsLeft} early bird seats left`;
    } else if (daysLeft !== null && daysLeft <= 3) {
      status = daysLeft === 0 ? 'Last day for early bird!' : daysLeft === 1 ? 'Ends tomorrow' : `Ends in ${daysLeft} days`;
    } else if (seatsLeft !== null) {
      status = `${seatsLeft} early bird seats remaining`;
    } else if (daysLeft !== null) {
      status = `Ends in ${daysLeft} days`;
    } else {
      status = 'Limited time offer';
    }

    return { price: ebPrice, status, savings: trip.discounted_price - ebPrice };
  })();

  const effectivePrice = earlyBird ? earlyBird.price : trip.discounted_price;
  // When early bird is active, seat lock is disabled — user just pays the discounted full amount
  const showSeatLock = !earlyBird && trip.seat_lock_price && trip.seat_lock_price > 0;

  // Vague seat status — never show exact filled/available count
  const hasMaxLimit = trip.max_participants && trip.max_participants > 0;
  const seatStatus = (() => {
    if (!hasMaxLimit) return { label: 'Seats available', tone: 'available', pct: 30, sub: 'Bookings open right now' };
    const pct = (trip.current_participants / trip.max_participants!) * 100;
    if (pct >= 100) return { label: 'Sold out', tone: 'sold', pct: 100, sub: 'No seats remaining' };
    if (pct >= 85) return { label: 'Booking closing soon', tone: 'urgent', pct, sub: 'Only a few seats left' };
    if (pct >= 70) return { label: 'Filling fast', tone: 'urgent', pct, sub: 'Hurry before it sells out' };
    if (pct >= 40) return { label: 'Booking actively', tone: 'normal', pct, sub: 'Few seats left' };
    if (trip.current_participants === 0) return { label: 'Just opened', tone: 'available', pct: 8, sub: 'Be among the first' };
    return { label: 'Seats available', tone: 'available', pct: Math.max(15, pct), sub: 'Bookings open' };
  })();

  // Duration display — use admin's custom text or fall back to "X days"
  const durationDisplay = trip.duration_text?.trim() || `${trip.duration_days} ${trip.duration_days === 1 ? 'day' : 'days'}`;

  const formatDate = (d?: string, opts: any = { day: 'numeric', month: 'short' }) =>
    d ? new Date(d).toLocaleDateString('en-IN', opts) : '';

  // Pickup / Return date format — compact for stats card
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const isRecurring = !!(trip as any).is_recurring && (trip as any).recurrence_day != null;
  const recurringLabel = isRecurring ? `Every ${DAY_NAMES[(trip as any).recurrence_day]}` : null;
  const pickupDay = formatDate(trip.start_date, { day: 'numeric', month: 'short' });
  const returnDay = trip.end_date ? formatDate(trip.end_date, { day: 'numeric', month: 'short' }) : null;

  const tripJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.short_description || trip.description,
    touristType: 'Budget Travellers',
    offers: {
      '@type': 'Offer',
      price: trip.discounted_price,
      priceCurrency: 'INR',
      availability: availableSpots > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      validFrom: trip.start_date,
      url: `${siteUrl}/trips/${trip.id}`,
    },
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: trip.duration_days,
      itemListElement: trip.highlights?.map((h: string, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: h,
      })) || [],
    },
    provider: {
      '@type': 'TravelAgency',
      name: 'Ghumakkars',
      url: siteUrl,
    },
  };

  return (
    <div className="min-h-screen pt-14 sm:pt-16 md:pt-20 pb-24 lg:pb-0 bg-gray-50/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }} />
      {/* Hero — Swipeable Carousel (Amazon style, infinite loop) */}
      <div className="relative mt-3 mx-4 sm:mx-6 lg:mx-auto max-w-[1320px] h-[240px] sm:h-[320px] md:h-[400px] overflow-hidden bg-gray-200 rounded-[24px] border border-gray-200 shadow-sm">
        {heroImages.length > 0 ? (
          <button type="button" onClick={() => setLightboxOpen(true)} className="no-min-touch absolute inset-0 w-full h-full cursor-zoom-in">
            <div className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-300" style={{ backgroundImage: `url(${IMG.hero(heroImages[galleryIndex])})` }}></div>
          </button>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-300 flex items-center justify-center">
            <MapPin className="h-24 w-24 text-white/30" />
          </div>
        )}

        {/* Photo counter */}
        {heroImages.length > 1 && (
          <div className="absolute bottom-3 right-3 z-20 bg-black/50 backdrop-blur-sm text-white text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {galleryIndex + 1}/{heroImages.length}
          </div>
        )}

        {/* Status badge over carousel */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {isCompleted && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold flex items-center space-x-1.5 shadow-lg">
              <CheckCircle className="h-4 w-4" />
              <span>Trip Completed</span>
            </div>
          )}
          {isCancelled && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold flex items-center space-x-1.5 shadow-lg">
              <X className="h-4 w-4" />
              <span>Trip Cancelled</span>
            </div>
          )}
          {isPostponed && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold flex items-center space-x-1.5 shadow-lg">
              <Clock className="h-4 w-4" />
              <span>Postponed</span>
            </div>
          )}
        </div>
        
        {/* Back Button + Share */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
          <Link
            href="/trips"
            className="inline-flex items-center bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white px-4 py-2 rounded-full font-medium transition-all shadow-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm">Back</span>
          </Link>
          </div>
          <button
            onClick={handleShare}
            className="pointer-events-auto inline-flex items-center bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white px-4 py-2 rounded-full font-medium transition-all shadow-lg"
          >
            {shareCopied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Share2 className="h-4 w-4 mr-2" />}
            <span className="text-sm">{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* (Title moved out of the image into a clean header below — product-page style.) */}
      </div>

      {/* Thumbnail strip — click to switch the main image */}
      {heroImages.length > 1 && (
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 mt-3">
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
            {heroImages.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setGalleryIndex(i)}
                aria-label={`Photo ${i + 1}`}
                className="no-min-touch flex-shrink-0 w-[72px] h-[52px] sm:w-24 sm:h-[68px] rounded-[12px] overflow-hidden transition-all"
                style={{
                  outline: i === galleryIndex ? '2px solid #7C3AED' : '2px solid transparent',
                  outlineOffset: '2px',
                  opacity: i === galleryIndex ? 1 : 0.6,
                }}
              >
                <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${IMG.hero(img)})` }}></div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Title header — product-page style, premium chips */}
        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            {trip.discount_percentage > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700"><Tag className="h-3 w-3" />{trip.discount_percentage}% OFF</span>
            )}
            {isLowAvailability && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700"><Sparkles className="h-3 w-3" />Limited seats</span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700"><Shield className="h-3 w-3" />Verified trip</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{trip.title}</h1>
          <div className="flex items-center gap-1.5 text-gray-500 mt-2 text-sm sm:text-base">
            <MapPin className="h-4 w-4 text-purple-600 flex-shrink-0" />{trip.destination}
          </div>
        </div>

        {/* Short description tagline */}
        {trip.short_description && (
          <p className="text-sm sm:text-base text-gray-700 mb-5 md:mb-6 leading-relaxed max-w-3xl">
            {trip.short_description}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">

            {/* Quick Stats — 2x2 grid with tinted icon circles */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5 sm:mb-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">{isRecurring ? 'Departs' : 'Dates'}</p>
                  <p className="font-bold text-gray-900 text-sm sm:text-base mt-0.5 leading-tight truncate">
                    {isRecurring ? recurringLabel : <>{pickupDay}{returnDay && ` — ${returnDay}`}</>}
                  </p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Duration</p>
                  <p className="font-bold text-gray-900 text-sm sm:text-base mt-0.5 leading-tight">{durationDisplay}</p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Group</p>
                  <p className="font-bold text-gray-900 text-sm sm:text-base mt-0.5 leading-tight">Small group</p>
                </div>
              </div>
              <div className={`bg-white border rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-center gap-3 ${seatStatus.tone === 'urgent' ? 'border-orange-200' : 'border-gray-200'}`}>
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center flex-shrink-0 ${seatStatus.tone === 'urgent' ? 'bg-orange-100' : seatStatus.tone === 'sold' ? 'bg-gray-100' : 'bg-green-100'}`}>
                  <Check className={`h-5 w-5 ${seatStatus.tone === 'urgent' ? 'text-orange-600' : seatStatus.tone === 'sold' ? 'text-gray-500' : 'text-green-600'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold">Status</p>
                  <p className={`font-bold text-sm sm:text-base mt-0.5 leading-tight ${seatStatus.tone === 'urgent' ? 'text-orange-600' : seatStatus.tone === 'sold' ? 'text-gray-500' : 'text-gray-900'}`}>
                    {seatStatus.label}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 md:p-8">
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 pl-3 border-l-4 border-purple-600">About this trip</h2>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                  {trip.full_description || trip.description}
                </p>
              </div>

              {/* Day-wise Itinerary - Timeline */}
              {sections.itinerary !== false && itineraryDays.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-gray-100">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 pl-3 border-l-4 border-purple-600">Day-by-day plan</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-5">Tap a day to expand</p>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 sm:left-5 top-2 bottom-2 w-px bg-gradient-to-b from-purple-200 via-purple-100 to-transparent"></div>
                    <div className="space-y-3">
                      {itineraryDays.map((day, index) => {
                        const isOpen = expandedDay === index;
                        const isLast = index === itineraryDays.length - 1;
                        return (
                          <div key={index} className="relative pl-14 sm:pl-16">
                            {/* Day number circle */}
                            <button
                              onClick={() => setExpandedDay(isOpen ? null : index)}
                              className={`absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-base sm:text-lg transition-all ${
                                isOpen
                                  ? 'bg-purple-600 text-white shadow-lg ring-4 ring-purple-100'
                                  : 'bg-white text-purple-700 border-2 border-purple-300'
                              }`}
                            >
                              {day.day || index + 1}
                            </button>
                            <button
                              onClick={() => setExpandedDay(isOpen ? null : index)}
                              className={`w-full text-left rounded-xl border transition-all ${
                                isOpen
                                  ? 'border-purple-200 bg-purple-50/40'
                                  : 'border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50/20'
                              }`}
                            >
                              <div className="flex items-center justify-between p-4 sm:p-5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-sm text-purple-600 uppercase tracking-wider font-semibold mb-1">
                                    Day {day.day || index + 1}
                                  </p>
                                  <h4 className="font-semibold text-gray-900 text-base sm:text-lg md:text-xl truncate">
                                    {day.title || `Day ${index + 1}`}
                                  </h4>
                                </div>
                                {isOpen ? <ChevronUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 flex-shrink-0 ml-2" /> : <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 flex-shrink-0 ml-2" />}
                              </div>
                              {isOpen && (day.description || (Array.isArray((day as any).activities) && (day as any).activities.filter((a: string) => a && a.trim()).length > 0)) && (
                                <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
                                  {day.description && (
                                    <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">{day.description}</p>
                                  )}
                                  {Array.isArray((day as any).activities) && (day as any).activities.filter((a: string) => a && a.trim()).length > 0 && (
                                    <ul className="space-y-2 pt-1">
                                      {((day as any).activities as string[])
                                        .filter((a) => a && a.trim())
                                        .map((activity, ai) => (
                                          <li key={ai} className="flex items-start gap-2.5 text-sm sm:text-base text-gray-700">
                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                                              <Check className="h-3 w-3 text-purple-700" />
                                            </div>
                                            <span className="leading-relaxed">{activity}</span>
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Free Perks - Big Banner */}
              {sections.perks !== false && trip.free_perks && trip.free_perks.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-gray-100">
                  <div className="rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 p-5 sm:p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-6 w-6 text-yellow-300" />
                        <p className="text-sm sm:text-base font-bold uppercase tracking-wider text-yellow-200">Book now and get free</p>
                      </div>
                      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-5">Bonus perks included</h3>
                      <ul className="space-y-3">
                        {trip.free_perks.map((perk, i) => (
                          <li key={i} className="flex items-start gap-3 text-base sm:text-lg md:text-xl">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                              <Check className="h-4 w-4 text-yellow-300" />
                            </div>
                            <span className="text-white/95 font-medium">{perk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {sections.highlights !== false && trip.highlights && trip.highlights.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-gray-100">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 pl-3 border-l-4 border-purple-600">Trip highlights</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-4">What you'll experience</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {trip.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-lg bg-gray-50/80 border border-gray-100">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <span className="text-sm sm:text-base text-gray-800 leading-relaxed">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sections.included !== false && ((trip.included_features && trip.included_features.length > 0) || (trip.excluded_features && trip.excluded_features.length > 0)) && (
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 pl-3 border-l-4 border-purple-600">What's in & what's not</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mb-4">Check before you book</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trip.included_features && trip.included_features.length > 0 && (
                      <div className="rounded-xl border border-green-200 bg-green-50/30 p-5 sm:p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-5 w-5 text-green-700" />
                          </div>
                          <p className="font-bold text-gray-900 text-base sm:text-lg">Included</p>
                        </div>
                        <ul className="space-y-2.5">
                          {trip.included_features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-sm sm:text-base text-gray-700">
                              <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {trip.excluded_features && trip.excluded_features.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 sm:p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                            <X className="h-5 w-5 text-gray-700" />
                          </div>
                          <p className="font-bold text-gray-900 text-base sm:text-lg">Not included</p>
                        </div>
                        <ul className="space-y-2.5">
                          {trip.excluded_features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-sm sm:text-base text-gray-600">
                              <X className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-5 sm:p-6 md:p-7 lg:sticky lg:top-20">
              {isPastTrip ? (
                /* Completed / Cancelled / Postponed — view only, no booking */
                <>
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isCancelled ? 'bg-red-100' : isPostponed ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      {isCancelled ? <X className="h-10 w-10 text-red-600" /> : isPostponed ? <Clock className="h-10 w-10 text-orange-600" /> : <CheckCircle className="h-10 w-10 text-blue-600" />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {isCancelled ? 'Trip Cancelled' : isPostponed ? 'Trip Postponed' : 'Trip Completed'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {isCancelled
                        ? 'This trip was cancelled. For any queries or refunds, please contact us.'
                        : isPostponed
                        ? 'This trip has been postponed. Booking is closed for the original dates.'
                        : 'This journey has ended. Booking is closed.'}
                    </p>
                  </div>
                  <div className="space-y-4 mb-6">
                    {isCompleted && trip.completed_at && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <p className="text-xs text-gray-600 mb-1">Completed on</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(trip.completed_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {isPostponed && trip.postponed_to_date && (
                      <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                        <p className="text-xs text-gray-600 mb-1">New date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(trip.postponed_to_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {isCancelled && trip.cancellation_reason && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <p className="text-xs text-gray-600 mb-1">Reason</p>
                        <p className="text-sm text-gray-800">{trip.cancellation_reason}</p>
                      </div>
                    )}
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 flex items-center">
                          <Users className="h-5 w-5 mr-2 text-gray-500" />
                          Participants
                        </span>
                        <span className="font-bold text-gray-900">
                          {(trip.actual_participants ?? trip.current_participants)}/{trip.max_participants}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1">Price was</p>
                      <p className="font-bold text-gray-900 flex items-center">
                        <IndianRupee className="h-5 w-5 mr-1" />
                        {trip.discounted_price.toLocaleString()}/person
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-center text-sm text-gray-500">
                      {isCancelled ? 'Contact us for any questions or refunds.' : 'You can view the itinerary and highlights below. Check out other trips to book your next adventure.'}
                    </p>
                    <Link
                      href="/trips"
                      className="mt-4 block w-full text-center py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Browse Available Trips
                    </Link>
                  </div>
                </>
              ) : (
                <>
              {/* Early Bird Banner — Active */}
              {earlyBird && (
                <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="h-5 w-5 text-amber-700" />
                    <p className="text-sm font-bold text-amber-900 uppercase tracking-wider">Early Bird Price</p>
                  </div>
                  <p className="text-base text-amber-900 font-semibold">{earlyBird.status}</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Saving <span className="font-bold">₹{earlyBird.savings.toLocaleString()}</span> on this booking
                  </p>
                </div>
              )}

              {/* Pricing Section — premium, conversion-focused */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                {(() => {
                  const originalForCalc = earlyBird ? trip.discounted_price : trip.original_price;
                  const savings = originalForCalc - effectivePrice;
                  const pct = originalForCalc > 0 ? Math.round((savings / originalForCalc) * 100) : 0;
                  const hasDiscount = savings > 0;
                  return (
                    <>
                      {hasDiscount && (
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <p className="text-base text-gray-400 line-through flex items-center">
                            <IndianRupee className="h-3.5 w-3.5" />
                            {originalForCalc.toLocaleString()}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider ${earlyBird ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm'}`}>
                            {pct}% OFF
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-2">
                        <p className={`text-4xl sm:text-5xl font-extrabold flex items-baseline tracking-tight ${earlyBird ? 'text-amber-700' : 'text-gray-900'}`}>
                          <IndianRupee className="h-7 w-7 sm:h-8 sm:w-8" />
                          {effectivePrice.toLocaleString()}
                        </p>
                        <span className="text-sm text-gray-500 font-medium">/ person</span>
                      </div>
                      {hasDiscount && (
                        <div className="mt-3 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-full text-sm font-bold">
                          <Sparkles className="h-3.5 w-3.5 text-green-600" />
                          You save ₹{savings.toLocaleString()} instantly
                        </div>
                      )}
                    </>
                  );
                })()}
                {showSeatLock && (
                  <div className="mt-4 flex items-center gap-2 text-sm sm:text-base text-gray-700">
                    <Lock className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span>
                      Or pay <span className="font-bold text-gray-900">₹{trip.seat_lock_price!.toLocaleString()}</span> to lock your seat
                    </span>
                  </div>
                )}
                {earlyBird && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Seat lock isn't available during early bird pricing. Pay the full early bird amount to book.</span>
                  </div>
                )}
              </div>

              {/* Smart Capacity Status — no exact seat numbers */}
              {(() => {
                const barColor = seatStatus.tone === 'sold' ? 'bg-gray-400' : seatStatus.tone === 'urgent' ? 'bg-orange-500' : 'bg-purple-600';
                const textColor = seatStatus.tone === 'sold' ? 'text-gray-500' : seatStatus.tone === 'urgent' ? 'text-orange-600' : 'text-gray-800';
                return (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-base font-bold ${textColor}`}>{seatStatus.label}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(2, Math.min(100, seatStatus.pct))}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">{seatStatus.sub}</p>
                  </div>
                );
              })()}

              {/* Book Button — premium CTA */}
              <button
                onClick={handleBookNow}
                disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
                className={`group relative w-full py-4 sm:py-5 rounded-2xl font-extrabold text-lg sm:text-xl transition-all overflow-hidden ${
                  !trip.is_active || availableSpots === 0 || trip.booking_disabled
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 via-purple-700 to-fuchsia-700 text-white hover:shadow-2xl hover:shadow-purple-500/40 active:scale-[0.98] shadow-lg shadow-purple-500/30'
                }`}
              >
                {!(!trip.is_active || availableSpots === 0 || trip.booking_disabled) && (
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden></span>
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {trip.booking_disabled
                    ? 'Bookings Closed'
                    : !trip.is_active
                    ? 'Not Available'
                    : availableSpots === 0
                    ? 'Sold Out'
                    : (
                      <>
                        Book this trip
                        <ArrowLeft className="h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                </span>
              </button>
              {!(!trip.is_active || availableSpots === 0 || trip.booking_disabled) && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium">
                  <Lock className="h-3.5 w-3.5 text-green-600" />
                  <span>Secure checkout · Razorpay</span>
                </div>
              )}
              <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 leading-relaxed">
                You won&apos;t be charged yet. By booking you agree to our{' '}
                <Link href="/terms" className="text-purple-600 underline hover:text-purple-700">Terms</Link>
                {' '}and{' '}
                <Link href="/refund-policy" className="text-purple-600 underline hover:text-purple-700">Refund &amp; Cancellation Policy</Link>.
              </p>

              {/* Pickup points + Booking deadline */}
              {(((trip as any).pickup_points && (trip as any).pickup_points.length > 0) || trip.booking_deadline_date) && (
                <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 text-base">
                  {trip.booking_deadline_date && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-5 w-5 mr-2 text-gray-400" />
                        <span>Bookings close</span>
                      </div>
                      <span className="font-semibold text-gray-900">{formatDate(trip.booking_deadline_date, { day: 'numeric', month: 'short' })}</span>
                    </div>
                  )}
                  {(trip as any).pickup_points && (trip as any).pickup_points.length > 0 && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center text-gray-600 flex-shrink-0">
                        <MapPin className="h-5 w-5 mr-2 text-gray-400" />
                        <span>Pickup{(trip as any).pickup_points.length > 1 ? ' options' : ''}</span>
                      </div>
                      <span className="font-semibold text-gray-900 text-right">{(trip as any).pickup_points.join(' · ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Trust strip — real honest commitments */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5 text-gray-700">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-green-700" />
                  </div>
                  <span>Policy-based cancellation terms</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-700">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-700" />
                  </div>
                  <span>Stays personally vetted by our team</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-700">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-4 w-4 text-green-700" />
                  </div>
                  <span>24/7 trip support on WhatsApp</span>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for gallery */}
      {lightboxOpen && heroImages.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 z-10"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex - 1 + heroImages.length) % heroImages.length); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex + 1) % heroImages.length); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3 rotate-180"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <img
            src={IMG.lightbox(heroImages[galleryIndex])}
            alt={`${trip.title} ${galleryIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full">
            {galleryIndex + 1} / {heroImages.length}
          </div>
        </div>
      )}

      {/* Sticky Book Now bar — mobile only */}
      {!isPastTrip && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-purple-200 shadow-[0_-4px_20px_rgba(168,85,247,0.15)]">
          {earlyBird && (
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-3 py-1 text-center">
              <Sparkles className="h-3 w-3 inline mr-1" />
              {earlyBird.status}
            </div>
          )}
          <div className="px-3 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-[10px] text-gray-500 leading-tight uppercase tracking-wider font-semibold">{showSeatLock ? 'Lock from' : 'From'}</p>
                {(earlyBird || trip.original_price > trip.discounted_price) && (() => {
                  const origMobile = earlyBird ? trip.discounted_price : trip.original_price;
                  const eff = showSeatLock ? trip.seat_lock_price! : effectivePrice;
                  const pctMobile = origMobile > 0 ? Math.round(((origMobile - eff) / origMobile) * 100) : 0;
                  return (
                    <>
                      <p className="text-[10px] text-gray-400 line-through leading-tight">
                        ₹{origMobile.toLocaleString()}
                      </p>
                      {pctMobile > 0 && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${earlyBird ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                          {pctMobile}% OFF
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-baseline gap-1 leading-tight">
                <p className={`text-2xl font-extrabold flex items-baseline tracking-tight ${earlyBird ? 'text-amber-700' : 'text-gray-900'}`}>
                  <IndianRupee className="h-4 w-4" />
                  {(showSeatLock ? trip.seat_lock_price! : effectivePrice).toLocaleString()}
                </p>
                <span className="text-[10px] text-gray-500 font-medium">
                  {showSeatLock ? '/lock' : '/person'}
                </span>
              </div>
              <p className="text-[9px] text-green-700 font-semibold leading-tight mt-0.5 flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> Secure checkout
              </p>
            </div>
            <button
              onClick={handleBookNow}
              disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
              className={`flex-shrink-0 px-6 py-3.5 rounded-2xl font-extrabold text-base shadow-lg flex items-center gap-2 transition-all ${
                !trip.is_active || availableSpots === 0 || trip.booking_disabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 via-purple-700 to-fuchsia-700 text-white active:scale-95 shadow-purple-500/40'
              }`}
            >
              {trip.booking_disabled
                ? 'Closed'
                : availableSpots === 0
                ? 'Sold Out'
                : (
                  <>
                    Book Now
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </>
                )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
