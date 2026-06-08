'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Clock, Users, IndianRupee, Tag, ArrowLeft, Calendar, Check, AlertCircle, Star, Shield, Heart, Sparkles, Plane, Hotel, UtensilsCrossed, X, CheckCircle, Lock, Share2, ChevronDown, ChevronUp, MessageCircle, Copy, Image as ImageIcon } from 'lucide-react';

interface ItineraryDay {
  day?: number;
  title: string;
  description: string;
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

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchTrip();
    checkUser();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchTrip = async () => {
    try {
      const idOrSlug = String(params.id);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const query = supabase.from('trips').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', idOrSlug).single()
        : await query.eq('slug', idOrSlug).single();

      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
      router.push('/trips');
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (!user) {
      router.push(`/auth/signin?redirect=/trips/${params.id}`);
      return;
    }
    router.push(`/trips/${params.id}/book`);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center bg-gradient-to-b from-purple-50/30 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-3 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-sm md:text-base text-purple-600 tracking-wide uppercase font-medium">Loading journey details...</p>
        </div>
      </div>
    );
  }

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

  const availableSpots = trip.max_participants - trip.current_participants;
  const isLowAvailability = availableSpots < 5 && availableSpots > 0;
  const isCompleted = trip.status === 'completed';
  const isCancelled = trip.status === 'cancelled';
  const isPostponed = trip.status === 'postponed';
  const isPastTrip = isCompleted || isCancelled || isPostponed;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';
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

  const formatDate = (d?: string, opts: any = { day: 'numeric', month: 'short' }) =>
    d ? new Date(d).toLocaleDateString('en-IN', opts) : '';

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
    <div className="min-h-screen pt-14 sm:pt-16 md:pt-20 pb-24 sm:pb-28 bg-gray-50/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }} />
      {/* Hero — Swipeable Carousel (Amazon style) */}
      <div className="relative h-[50vh] sm:h-[55vh] md:h-[60vh] max-h-[640px] overflow-hidden bg-gray-200">
        {heroImages.length > 0 ? (
          <div
            className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / el.clientWidth);
              if (idx !== galleryIndex) setGalleryIndex(idx);
            }}
            id="hero-scroller"
          >
            {heroImages.map((img, i) => (
              <button
                key={i}
                onClick={() => { setGalleryIndex(i); setLightboxOpen(true); }}
                className="relative flex-shrink-0 w-full h-full snap-start cursor-pointer"
              >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${img})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40"></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-300 flex items-center justify-center">
            <MapPin className="h-24 w-24 text-white/30" />
          </div>
        )}

        {/* Carousel Dots + Counter */}
        {heroImages.length > 1 && (
          <>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
              {heroImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setGalleryIndex(i);
                    const scroller = document.getElementById('hero-scroller');
                    if (scroller) scroller.scrollTo({ left: i * scroller.clientWidth, behavior: 'smooth' });
                  }}
                  className={`h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/80'}`}
                />
              ))}
            </div>
            <div className="absolute bottom-4 right-4 z-20 bg-black/60 backdrop-blur-md text-white text-sm px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" />
              {galleryIndex + 1} / {heroImages.length}
            </div>
          </>
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

        {/* Trip Title Overlay - bottom-left, above dots */}
        <div className="absolute bottom-16 sm:bottom-20 left-0 right-0 p-4 sm:p-6 md:p-8 lg:p-12 pointer-events-none z-10">
          <div className="max-w-7xl mx-auto">
            {trip.discount_percentage > 0 && (
              <div className="inline-flex items-center bg-purple-600 text-white px-3 py-1 rounded-md text-xs sm:text-sm font-bold mb-2 sm:mb-3 shadow-lg">
                <Tag className="h-3 w-3 mr-1" />
                {trip.discount_percentage}% OFF
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 leading-tight drop-shadow-lg">
              {trip.title}
            </h1>
            <div className="flex items-center text-white/95 text-base sm:text-lg md:text-xl drop-shadow font-medium">
              <MapPin className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
              {trip.destination}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {/* Short description tagline */}
        {trip.short_description && (
          <p className="text-lg sm:text-xl md:text-2xl text-gray-700 mb-6 md:mb-8 leading-relaxed max-w-4xl">
            {trip.short_description}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">

            {/* Quick Stats Strip */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6 sm:mb-8 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
                <div className="p-4 sm:p-5 md:p-6 text-center">
                  <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-semibold">Dates</p>
                  <p className="font-bold text-gray-900 text-base sm:text-lg md:text-xl mt-1.5">
                    {formatDate(trip.start_date, { day: 'numeric', month: 'short' })}
                    {trip.end_date && ` – ${formatDate(trip.end_date, { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="p-4 sm:p-5 md:p-6 text-center">
                  <Clock className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-semibold">Duration</p>
                  <p className="font-bold text-gray-900 text-base sm:text-lg md:text-xl mt-1.5">
                    {trip.duration_days} {trip.duration_days === 1 ? 'day' : 'days'}
                  </p>
                </div>
                <div className="p-4 sm:p-5 md:p-6 text-center">
                  <Users className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-semibold">Group</p>
                  <p className="font-bold text-gray-900 text-base sm:text-lg md:text-xl mt-1.5">Up to {trip.max_participants}</p>
                </div>
                <div className="p-4 sm:p-5 md:p-6 text-center">
                  <Check className={`h-6 w-6 sm:h-7 sm:w-7 mx-auto mb-2 ${isLowAvailability ? 'text-orange-600' : 'text-green-600'}`} />
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider font-semibold">Status</p>
                  <p className={`font-bold text-base sm:text-lg md:text-xl mt-1.5 ${isLowAvailability ? 'text-orange-600' : 'text-gray-900'}`}>
                    {availableSpots === 0 ? 'Sold out' : availableSpots <= 3 ? `${availableSpots} left!` : `${availableSpots} open`}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 md:p-10">
              <div className="mb-8 sm:mb-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">About this trip</h2>
                <p className="text-base sm:text-lg md:text-xl text-gray-700 leading-relaxed whitespace-pre-line">
                  {trip.full_description || trip.description}
                </p>
              </div>

              {/* Day-wise Itinerary - Timeline */}
              {sections.itinerary !== false && itineraryDays.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-gray-100">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Day-by-day plan</h3>
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
                              {isOpen && day.description && (
                                <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed whitespace-pre-line">{day.description}</p>
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
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Trip highlights</h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-5">What you'll experience</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {trip.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="text-base sm:text-lg text-gray-800 leading-relaxed">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sections.included !== false && ((trip.included_features && trip.included_features.length > 0) || (trip.excluded_features && trip.excluded_features.length > 0)) && (
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">What's in & what's not</h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-5">Check before you book</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trip.included_features && trip.included_features.length > 0 && (
                      <div className="rounded-xl border border-green-200 bg-green-50/30 p-5 sm:p-6">
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-5 w-5 text-green-700" />
                          </div>
                          <p className="font-bold text-gray-900 text-lg sm:text-xl">Included</p>
                        </div>
                        <ul className="space-y-2.5">
                          {trip.included_features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-base sm:text-lg text-gray-700">
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
                          <p className="font-bold text-gray-900 text-lg sm:text-xl">Not included</p>
                        </div>
                        <ul className="space-y-2.5">
                          {trip.excluded_features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2.5 text-base sm:text-lg text-gray-600">
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
              {/* Early Bird Banner */}
              {trip.early_bird_price && trip.early_bird_price > 0 && trip.early_bird_price < trip.discounted_price && (() => {
                const earlyBirdSavings = trip.discounted_price - trip.early_bird_price;
                return (
                  <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                      <p className="text-sm font-bold text-amber-900 uppercase tracking-wider">Early bird offer</p>
                    </div>
                    <p className="text-base text-gray-800 leading-relaxed">
                      Save <span className="font-bold text-amber-700">₹{earlyBirdSavings.toLocaleString()}</span> if you book early.
                      Pay just <span className="font-bold">₹{trip.early_bird_price.toLocaleString()}</span> per person.
                    </p>
                  </div>
                );
              })()}

              {/* Pricing Section */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                {trip.original_price > trip.discounted_price && (
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-base text-gray-400 line-through flex items-center">
                      <IndianRupee className="h-3.5 w-3.5" />
                      {trip.original_price.toLocaleString()}
                    </p>
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                      Save ₹{(trip.original_price - trip.discounted_price).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 flex items-baseline tracking-tight">
                    <IndianRupee className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9" />
                    {trip.discounted_price.toLocaleString()}
                  </p>
                  <span className="text-base text-gray-500">/ person</span>
                </div>
                {trip.seat_lock_price && trip.seat_lock_price > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-sm sm:text-base text-gray-700">
                    <Lock className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span>
                      Or pay <span className="font-bold text-gray-900">₹{trip.seat_lock_price.toLocaleString()}</span> to lock your seat
                    </span>
                  </div>
                )}
              </div>

              {/* Smart Capacity Status */}
              {(() => {
                const pct = (trip.current_participants / trip.max_participants) * 100;
                let label = '';
                let sublabel = '';
                let barColor = 'bg-purple-600';
                let textColor = 'text-gray-700';
                if (availableSpots === 0) {
                  label = 'Sold out';
                  sublabel = 'No spots remaining';
                  barColor = 'bg-gray-400';
                  textColor = 'text-gray-500';
                } else if (trip.current_participants === 0) {
                  label = 'Just opened';
                  sublabel = 'Be among the first to book';
                  barColor = 'bg-purple-500';
                } else if (availableSpots <= 3) {
                  label = `Only ${availableSpots} ${availableSpots === 1 ? 'seat' : 'seats'} left!`;
                  sublabel = 'Book fast before it sells out';
                  barColor = 'bg-orange-500';
                  textColor = 'text-orange-600';
                } else if (pct >= 70) {
                  label = 'Filling fast';
                  sublabel = `${availableSpots} seats remaining`;
                  barColor = 'bg-orange-500';
                  textColor = 'text-orange-600';
                } else if (pct >= 30) {
                  label = 'Booking actively';
                  sublabel = `${availableSpots} of ${trip.max_participants} available`;
                  barColor = 'bg-purple-600';
                } else {
                  label = 'Spots available';
                  sublabel = `${availableSpots} of ${trip.max_participants} open`;
                  barColor = 'bg-purple-500';
                }
                return (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-base sm:text-lg font-bold ${textColor}`}>{label}</span>
                      {availableSpots > 0 && (
                        <span className="text-sm text-gray-500 font-medium">{trip.current_participants}/{trip.max_participants}</span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{sublabel}</p>
                  </div>
                );
              })()}

              {/* Book Button */}
              <button
                onClick={handleBookNow}
                disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
                className={`w-full py-4 sm:py-5 rounded-xl font-bold text-lg sm:text-xl transition-all ${
                  !trip.is_active || availableSpots === 0 || trip.booking_disabled
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 hover:shadow-lg active:scale-[0.99] shadow-md'
                }`}
              >
                {trip.booking_disabled
                  ? 'Bookings Closed'
                  : !trip.is_active
                  ? 'Not Available'
                  : availableSpots === 0
                  ? 'Sold Out'
                  : 'Book this trip'}
              </button>
              <p className="text-center text-sm text-gray-500 mt-3">You won&apos;t be charged yet</p>

              {/* Pickup + Booking deadline */}
              {(trip.pickup_location || trip.booking_deadline_date) && (
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
                  {trip.pickup_location && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-5 w-5 mr-2 text-gray-400" />
                        <span>Pickup</span>
                      </div>
                      <span className="font-semibold text-gray-900 text-right">{trip.pickup_location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Trust strip */}
              <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Instant confirmation</span>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for gallery */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 z-10"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex + 1) % galleryImages.length); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3 rotate-180"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <img
            src={galleryImages[galleryIndex]}
            alt={`${trip.title} ${galleryIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full">
            {galleryIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      {/* Sticky Book Now bar — all screens */}
      {!isPastTrip && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-purple-200 shadow-[0_-4px_20px_rgba(168,85,247,0.15)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 leading-tight">{trip.seat_lock_price ? 'Lock your seat from' : 'From'}</p>
              <div className="flex items-baseline gap-2 leading-tight">
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-baseline">
                  <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
                  {(trip.seat_lock_price || trip.discounted_price).toLocaleString()}
                </p>
                <span className="text-sm text-gray-500 hidden sm:inline">
                  {trip.seat_lock_price ? '/ seat lock' : '/ person'}
                </span>
                {trip.original_price > trip.discounted_price && (
                  <span className="hidden md:inline text-sm text-gray-400 line-through">
                    ₹{trip.original_price.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleBookNow}
              disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
              className={`flex-shrink-0 px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 rounded-xl font-bold text-base sm:text-lg shadow-lg flex items-center gap-2 transition-all ${
                !trip.is_active || availableSpots === 0 || trip.booking_disabled
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 active:scale-95 hover:shadow-xl'
              }`}
            >
              {trip.booking_disabled
                ? 'Bookings Closed'
                : availableSpots === 0
                ? 'Sold Out'
                : (
                  <>
                    Book Now
                    <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 rotate-180" />
                  </>
                )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

