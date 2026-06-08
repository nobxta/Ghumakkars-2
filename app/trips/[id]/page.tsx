'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Clock, Users, IndianRupee, Tag, ArrowLeft, Calendar, Check, AlertCircle, Star, Shield, Heart, Sparkles, Plane, Hotel, UtensilsCrossed, X, CheckCircle, Lock, Share2, ChevronDown, ChevronUp, MessageCircle, Copy } from 'lucide-react';

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
  const allImages = [
    trip.cover_image_url || trip.image_url,
    ...galleryImages,
  ].filter(Boolean) as string[];

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
    <div className="min-h-screen pt-16 md:pt-20 pb-20 lg:pb-0 bg-gradient-to-b from-purple-50/30 via-white to-purple-50/30">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }} />
      {/* Hero Section with Image */}
      <div className="relative h-[50vh] md:h-[60vh] lg:h-[70vh] overflow-hidden">
        {(trip.cover_image_url || trip.image_url) ? (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${trip.cover_image_url || trip.image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            {isCompleted && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <CheckCircle className="h-5 w-5" />
                <span>Trip Completed</span>
              </div>
            )}
            {isCancelled && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <X className="h-5 w-5" />
                <span>Trip Cancelled</span>
              </div>
            )}
            {isPostponed && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <Clock className="h-5 w-5" />
                <span>Trip Postponed{trip.postponed_to_date ? ` to ${new Date(trip.postponed_to_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-purple-400 to-purple-300 flex items-center justify-center">
            <MapPin className="h-32 w-32 text-white/30" />
            {isCompleted && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <CheckCircle className="h-5 w-5" />
                <span>Trip Completed</span>
              </div>
            )}
            {isCancelled && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <X className="h-5 w-5" />
                <span>Trip Cancelled</span>
              </div>
            )}
            {isPostponed && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-2.5 rounded-full font-semibold flex items-center space-x-2 shadow-lg">
                <Clock className="h-5 w-5" />
                <span>Trip Postponed</span>
              </div>
            )}
          </div>
        )}
        
        {/* Back Button + Share */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <Link
            href="/trips"
            className="inline-flex items-center bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white px-4 py-2 rounded-full font-medium transition-all shadow-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm">Back</span>
          </Link>
          <button
            onClick={handleShare}
            className="inline-flex items-center bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white px-4 py-2 rounded-full font-medium transition-all shadow-lg"
          >
            {shareCopied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Share2 className="h-4 w-4 mr-2" />}
            <span className="text-sm">{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Trip Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              {trip.discount_percentage > 0 && (
                <div className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-xl">
                  <Tag className="h-4 w-4" />
                  <span>{trip.discount_percentage}% OFF</span>
                </div>
              )}
              <div className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2">
                <Sparkles className="h-4 w-4" />
                <span>{trip.duration_days} Days Journey</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 drop-shadow-lg leading-tight">
              {trip.title}
            </h1>
            <div className="flex items-center space-x-4 text-white/90">
              <div className="flex items-center bg-white/20 backdrop-blur-md px-4 py-2 rounded-full">
                <MapPin className="h-5 w-5 mr-2" />
                <span className="font-medium">{trip.destination}</span>
              </div>
              <div className="flex items-center bg-white/20 backdrop-blur-md px-4 py-2 rounded-full">
                <Calendar className="h-5 w-5 mr-2" />
                <span className="font-medium">
                  {formatDate(trip.start_date, { day: 'numeric', month: 'short' })}
                  {trip.end_date && ` - ${formatDate(trip.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
              <div className="bg-white border border-purple-200 rounded-xl p-2.5 sm:p-3.5 text-center shadow-sm">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mx-auto mb-1.5" />
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Duration</p>
                <p className="font-bold text-gray-900 text-xs sm:text-sm">{trip.duration_days} Days</p>
              </div>
              <div className="bg-white border border-blue-200 rounded-xl p-2.5 sm:p-3.5 text-center shadow-sm">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mx-auto mb-1.5" />
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Group size</p>
                <p className="font-bold text-gray-900 text-xs sm:text-sm">{trip.max_participants}</p>
              </div>
              <div className={`bg-white border rounded-xl p-2.5 sm:p-3.5 text-center shadow-sm ${isLowAvailability ? 'border-orange-300' : 'border-green-200'}`}>
                <Check className={`h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 ${isLowAvailability ? 'text-orange-600' : 'text-green-600'}`} />
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">{isLowAvailability ? 'Hurry!' : 'Available'}</p>
                <p className={`font-bold text-xs sm:text-sm ${isLowAvailability ? 'text-orange-600' : 'text-green-700'}`}>
                  {availableSpots} left
                </p>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl p-2.5 sm:p-3.5 text-center shadow-sm">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mx-auto mb-1.5" />
                <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5">Starts</p>
                <p className="font-bold text-gray-900 text-xs sm:text-sm">{formatDate(trip.start_date)}</p>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm border border-purple-100 rounded-xl md:rounded-2xl shadow-md p-4 sm:p-6 md:p-8">
              <div className="mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3">About this trip</h2>
                <p className="text-sm sm:text-base md:text-lg text-gray-700 leading-relaxed whitespace-pre-line">
                  {trip.full_description || trip.description}
                </p>
              </div>

              {/* Day-wise Itinerary */}
              {itineraryDays.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-purple-100">
                  <div className="flex items-center mb-4 sm:mb-5">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2.5" />
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Day-by-day plan</h3>
                  </div>
                  <div className="space-y-2">
                    {itineraryDays.map((day, index) => {
                      const isOpen = expandedDay === index;
                      return (
                        <div key={index} className="border border-purple-100 rounded-xl overflow-hidden bg-purple-50/30 hover:bg-purple-50/60 transition-colors">
                          <button
                            onClick={() => setExpandedDay(isOpen ? null : index)}
                            className="w-full flex items-center justify-between p-3 sm:p-4 text-left"
                          >
                            <div className="flex items-center min-w-0 flex-1">
                              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center font-bold text-sm sm:text-base mr-3">
                                {day.day || index + 1}
                              </div>
                              <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                {day.title || `Day ${index + 1}`}
                              </h4>
                            </div>
                            {isOpen ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 flex-shrink-0 ml-2" />}
                          </button>
                          {isOpen && day.description && (
                            <div className="px-3 sm:px-4 pb-3 sm:pb-4 pl-14 sm:pl-16">
                              <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">{day.description}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gallery */}
              {galleryImages.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-purple-100">
                  <div className="flex items-center mb-4 sm:mb-5">
                    <Hotel className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2.5" />
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Photos</h3>
                  </div>
                  <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-purple-100 bg-gray-100">
                    <img
                      src={galleryImages[galleryIndex]}
                      alt={`${trip.title} photo ${galleryIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {galleryImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-lg"
                        >
                          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                          onClick={() => setGalleryIndex((galleryIndex + 1) % galleryImages.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-900 rounded-full p-2 shadow-lg rotate-180"
                        >
                          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                          {galleryIndex + 1} / {galleryImages.length}
                        </div>
                      </>
                    )}
                  </div>
                  {galleryImages.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {galleryImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setGalleryIndex(i)}
                          className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${i === galleryIndex ? 'border-purple-600' : 'border-transparent opacity-70 hover:opacity-100'}`}
                        >
                          <img src={img} alt={`thumb ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {trip.highlights && trip.highlights.length > 0 && (
                <div className="mb-6 sm:mb-8 pt-6 border-t border-purple-100">
                  <div className="flex items-center mb-4 sm:mb-5">
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2.5" />
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Highlights</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    {trip.highlights.map((highlight, index) => (
                      <div key={index} className="flex items-start group bg-purple-50/50 p-4 rounded-xl hover:bg-purple-100/50 transition-colors border border-purple-100">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-6 h-6 md:w-7 md:h-7 bg-purple-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 md:h-5 md:w-5 text-white" />
                          </div>
                        </div>
                        <span className="text-sm md:text-base text-gray-700 font-medium leading-relaxed ml-3">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trip.included_features && trip.included_features.length > 0 && (
                <div className="pt-8 border-t border-purple-100">
                  <div className="flex items-center mb-5 md:mb-6">
                    <Shield className="h-6 w-6 md:h-7 md:w-7 text-green-600 mr-3" />
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900">What&apos;s Included</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    {trip.included_features.map((feature, index) => (
                      <div key={index} className="flex items-start group bg-green-50/50 p-4 rounded-xl hover:bg-green-100/50 transition-colors border border-green-100">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-6 h-6 md:w-7 md:h-7 bg-green-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 md:h-5 md:w-5 text-white" />
                          </div>
                        </div>
                        <span className="text-sm md:text-base text-gray-700 font-medium leading-relaxed ml-3">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trip.excluded_features && trip.excluded_features.length > 0 && (
                <div className="pt-8 border-t border-purple-100">
                  <div className="flex items-center mb-5 md:mb-6">
                    <AlertCircle className="h-6 w-6 md:h-7 md:w-7 text-amber-600 mr-3" />
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900">What&apos;s Not Included</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                    {trip.excluded_features.map((feature, index) => (
                      <div key={index} className="flex items-start group bg-amber-50/50 p-4 rounded-xl hover:bg-amber-100/50 transition-colors border border-amber-100">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-6 h-6 md:w-7 md:h-7 bg-amber-500 rounded-full flex items-center justify-center">
                            <X className="h-4 w-4 md:h-5 md:w-5 text-white" />
                          </div>
                        </div>
                        <span className="text-sm md:text-base text-gray-700 font-medium leading-relaxed ml-3">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-white to-purple-50/30 backdrop-blur-sm border border-purple-200 rounded-xl md:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 lg:sticky lg:top-24">
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
              {/* Pricing Section */}
              <div className="mb-5 sm:mb-6 pb-5 border-b border-purple-200">
                {trip.original_price > trip.discounted_price && (
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500 line-through flex items-center">
                      <IndianRupee className="h-3.5 w-3.5" />
                      <span>{trip.original_price.toLocaleString()}</span>
                    </p>
                    <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {trip.discount_percentage}% off
                    </span>
                  </div>
                )}
                <div className="flex items-baseline mb-2">
                  <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 flex items-baseline tracking-tight">
                    <IndianRupee className="h-6 w-6 sm:h-7 sm:w-7" />
                    <span>{trip.discounted_price.toLocaleString()}</span>
                  </p>
                  <span className="text-base text-gray-500 ml-2">/person</span>
                </div>
                {trip.seat_lock_price && trip.seat_lock_price > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                    <div className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">Or lock your seat for ₹{trip.seat_lock_price.toLocaleString()}</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">Pay the rest before the trip. Non-refundable.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="space-y-4 mb-6 md:mb-8">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700 flex items-center font-semibold">
                      <Users className="h-5 w-5 mr-2 text-blue-600" />
                      Participants
                    </span>
                    <span className="font-bold text-gray-900 text-lg">
                      {trip.current_participants}/{trip.max_participants}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${(trip.current_participants / trip.max_participants) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className={`border-2 rounded-xl p-4 ${isLowAvailability ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Available Spots</span>
                    <span className={`font-bold text-xl ${isLowAvailability ? 'text-orange-600' : 'text-green-700'}`}>
                      {availableSpots}
                    </span>
                  </div>
                  {isLowAvailability && (
                    <p className="text-xs text-orange-700 mt-2 font-medium flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Limited availability!
                    </p>
                  )}
                </div>
              </div>

              {/* Book Button */}
              <button
                onClick={handleBookNow}
                disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
                className={`w-full py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl tracking-wide uppercase shadow-2xl transform transition-all duration-200 ${
                  !trip.is_active || availableSpots === 0 || trip.booking_disabled
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 hover:scale-105 hover:shadow-3xl'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  {trip.is_active && availableSpots > 0 && !trip.booking_disabled && <Heart className="h-5 w-5" />}
                  <span>
                    {trip.booking_disabled
                      ? 'Bookings Closed'
                      : !trip.is_active
                      ? 'Not Available'
                      : availableSpots === 0
                      ? 'Sold Out'
                      : 'Book This Trip'}
                  </span>
                </div>
              </button>

              {/* Urgency Message */}
              {trip.is_active && availableSpots > 0 && !trip.booking_disabled && (
                <div className={`mt-5 p-4 rounded-xl border-2 ${
                  isLowAvailability 
                    ? 'bg-orange-50 border-orange-300' 
                    : 'bg-purple-50 border-purple-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                      isLowAvailability ? 'text-orange-600' : 'text-purple-600'
                    }`} />
                    <div>
                      <p className={`text-sm font-bold ${
                        isLowAvailability ? 'text-orange-900' : 'text-purple-900'
                      }`}>
                        {isLowAvailability ? 'Few Seats Left!' : 'Limited Time'}
                      </p>
                      <p className={`text-xs mt-1 ${
                        isLowAvailability ? 'text-orange-700' : 'text-purple-700'
                      }`}>
                        {isLowAvailability 
                          ? `Only ${availableSpots} ${availableSpots === 1 ? 'seat' : 'seats'} remaining - Book now to secure your place!`
                          : `Only ${availableSpots} ${availableSpots === 1 ? 'spot' : 'spots'} remaining - Book now to secure your place!`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Trip Details */}
              <div className="mt-5 pt-5 border-t border-purple-200 space-y-2.5">
                <div className="flex items-start text-sm text-gray-700">
                  <Calendar className="h-4 w-4 text-purple-600 mr-2.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-500 block">Trip dates</span>
                    <span className="font-medium">
                      {formatDate(trip.start_date)}
                      {trip.end_date && ` - ${formatDate(trip.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  </div>
                </div>
                {trip.booking_deadline_date && (
                  <div className="flex items-start text-sm text-gray-700">
                    <Clock className="h-4 w-4 text-orange-600 mr-2.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-gray-500 block">Bookings close</span>
                      <span className="font-medium">{formatDate(trip.booking_deadline_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                )}
                {trip.pickup_location && (
                  <div className="flex items-start text-sm text-gray-700">
                    <MapPin className="h-4 w-4 text-purple-600 mr-2.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-gray-500 block">Pickup point</span>
                      <span className="font-medium">{trip.pickup_location}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-xs text-gray-500 pt-2">
                  <Check className="h-3.5 w-3.5 text-green-600 mr-1.5" />
                  <span>Pay via UPI, card, or net banking</span>
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile Book Now bar */}
      {!isPastTrip && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-purple-200 shadow-[0_-4px_20px_rgba(168,85,247,0.15)] px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 leading-tight">From</p>
            <p className="text-lg font-bold text-gray-900 flex items-center leading-tight">
              <IndianRupee className="h-4 w-4" />
              {(trip.seat_lock_price || trip.discounted_price).toLocaleString()}
              <span className="text-[10px] text-gray-500 ml-1 font-normal">
                {trip.seat_lock_price ? '/seat lock' : '/person'}
              </span>
            </p>
          </div>
          <button
            onClick={handleBookNow}
            disabled={!trip.is_active || availableSpots === 0 || trip.booking_disabled}
            className={`flex-shrink-0 px-5 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-1.5 ${
              !trip.is_active || availableSpots === 0 || trip.booking_disabled
                ? 'bg-gray-300 text-gray-500'
                : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white active:scale-95'
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
      )}
    </div>
  );
}

