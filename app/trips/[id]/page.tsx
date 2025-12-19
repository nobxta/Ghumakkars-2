'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Clock, Users, IndianRupee, Tag, ArrowLeft, Calendar, Check, AlertCircle, Star, Shield, Heart, Sparkles, Plane, Hotel, UtensilsCrossed } from 'lucide-react';

interface Trip {
  id: string;
  title: string;
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
  included_features?: string[];
  highlights?: string[];
  is_active: boolean;
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
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
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
      router.push('/');
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

  return (
    <div className="min-h-screen pt-16 md:pt-20 bg-gradient-to-b from-purple-50/30 via-white to-purple-50/30">
      {/* Hero Section with Image */}
      <div className="relative h-[50vh] md:h-[60vh] lg:h-[70vh] overflow-hidden">
        {trip.image_url ? (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${trip.image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-purple-400 to-purple-300 flex items-center justify-center">
            <MapPin className="h-32 w-32 text-white/30" />
          </div>
        )}
        
        {/* Back Button Overlay */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/trips"
            className="inline-flex items-center bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white px-4 py-2 rounded-full font-medium transition-all shadow-lg hover:shadow-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm">Back</span>
          </Link>
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
                <span className="font-medium">{new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2">

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-4 text-center">
                <Clock className="h-6 w-6 md:h-8 md:w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-xs text-gray-600 mb-1">Duration</p>
                <p className="font-bold text-gray-900 text-sm md:text-base">{trip.duration_days} Days</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 text-center">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-gray-600 mb-1">Capacity</p>
                <p className="font-bold text-gray-900 text-sm md:text-base">{trip.max_participants} People</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 text-center">
                <Check className="h-6 w-6 md:h-8 md:w-8 text-green-600 mx-auto mb-2" />
                <p className="text-xs text-gray-600 mb-1">Available</p>
                <p className={`font-bold text-sm md:text-base ${availableSpots < 5 ? 'text-orange-600' : 'text-green-700'}`}>
                  {availableSpots} Spots
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-xl p-4 text-center">
                <Star className="h-6 w-6 md:h-8 md:w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-xs text-gray-600 mb-1">Price</p>
                <p className="font-bold text-gray-900 text-xs md:text-sm flex items-center justify-center">
                  <IndianRupee className="h-3 w-3 md:h-4 md:w-4" />
                  {trip.discounted_price.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm border-2 border-purple-100 rounded-xl md:rounded-2xl shadow-xl p-6 md:p-8">
              <div className="prose prose-purple max-w-none mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">About This Journey</h2>
                <p className="text-base md:text-lg text-gray-700 leading-relaxed">{trip.description}</p>
              </div>

              {trip.highlights && trip.highlights.length > 0 && (
                <div className="mb-8 md:mb-10 pt-8 border-t border-purple-100">
                  <div className="flex items-center mb-5 md:mb-6">
                    <Sparkles className="h-6 w-6 md:h-7 md:w-7 text-purple-600 mr-3" />
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900">Journey Highlights</h3>
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
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-white to-purple-50/30 backdrop-blur-sm border-2 border-purple-200 rounded-xl md:rounded-2xl shadow-2xl p-6 md:p-8 lg:sticky lg:top-24">
              {/* Pricing Section */}
              <div className="mb-6 md:mb-8 pb-6 border-b-2 border-purple-200">
                {trip.original_price > trip.discounted_price && (
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500 line-through flex items-center">
                      <IndianRupee className="h-4 w-4" />
                      <span>{trip.original_price.toLocaleString()}</span>
                    </p>
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                      Save {trip.discount_percentage}%
                    </span>
                  </div>
                )}
                <div className="flex items-baseline mb-3">
                  <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 flex items-baseline tracking-tight">
                    <IndianRupee className="h-7 w-7 md:h-8 md:w-8" />
                    <span>{trip.discounted_price.toLocaleString()}</span>
                  </p>
                  <span className="text-lg text-gray-600 font-medium ml-2">/person</span>
                </div>
                {trip.discount_percentage > 0 && (
                  <div className="bg-purple-100 border-2 border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-900 font-semibold flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      You save <IndianRupee className="h-4 w-4 mx-1" />
                      {(trip.original_price - trip.discounted_price).toLocaleString()} per person!
                    </p>
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
                disabled={!trip.is_active || availableSpots === 0}
                className={`w-full py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl tracking-wide uppercase shadow-2xl transform transition-all duration-200 ${
                  !trip.is_active || availableSpots === 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 hover:scale-105 hover:shadow-3xl'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  {trip.is_active && availableSpots > 0 && <Heart className="h-5 w-5" />}
                  <span>
                    {!trip.is_active
                      ? 'Journey Unavailable'
                      : availableSpots === 0
                      ? 'Fully Booked'
                      : 'Reserve Your Spot Now'}
                  </span>
                </div>
              </button>

              {/* Urgency Message */}
              {trip.is_active && availableSpots > 0 && (
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

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-purple-200">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-700">
                    <Shield className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                    <span className="font-medium">Secure Booking</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <Check className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                    <span className="font-medium">Verified Trip Organizer</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <Star className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                    <span className="font-medium">Best Price Guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

