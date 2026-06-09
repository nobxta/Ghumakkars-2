'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, Lock, Clock, IndianRupee, MapPin, Calendar, ArrowRight, Home } from 'lucide-react';

interface Booking {
  id: string;
  booking_status: string;
  number_of_participants?: number;
  total_price?: number;
  amount_paid?: number;
  final_amount?: number;
  coupon_code?: string | null;
  coupon_discount?: number | string | null;
  trips?: {
    title?: string;
    destination?: string;
    start_date?: string;
    end_date?: string;
  };
}

export default function BookingSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const bookingId = params.id as string;

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  useEffect(() => {
    if (booking) {
      // Trigger confetti pulse a moment after the check appears
      setTimeout(() => setShowConfetti(true), 300);
    }
  }, [booking]);

  const fetchBooking = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`id, booking_status, number_of_participants, total_price, amount_paid, final_amount, coupon_code, coupon_discount,
                 trips:trip_id (title, destination, start_date, end_date)`)
        .eq('id', bookingId)
        .single();
      if (error) throw error;
      setBooking(data as unknown as Booking);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-3"></div>
          <p className="text-purple-600 font-medium">Loading your booking…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50 px-4 text-center">
        <div>
          <p className="text-gray-700 mb-4">Booking not found.</p>
          <Link href="/trips" className="text-purple-700 font-semibold underline">Browse trips</Link>
        </div>
      </div>
    );
  }

  const status = booking.booking_status || 'pending';
  const isConfirmed = status === 'confirmed';
  const isSeatLocked = status === 'seat_locked';
  const isPending = status === 'pending';

  // Color/theme per status
  const theme = isConfirmed
    ? {
        bgFrom: 'from-emerald-400',
        bgVia: 'via-green-500',
        bgTo: 'to-teal-600',
        circle: 'bg-white',
        iconColor: 'text-green-600',
        ringColor: 'ring-white/30',
        Icon: CheckCircle,
        title: 'Payment Successful!',
        subtitle: 'Your seat is confirmed. Get ready for the adventure!',
        badge: 'CONFIRMED',
      }
    : isSeatLocked
    ? {
        bgFrom: 'from-amber-400',
        bgVia: 'via-orange-500',
        bgTo: 'to-rose-500',
        circle: 'bg-white',
        iconColor: 'text-orange-600',
        ringColor: 'ring-white/30',
        Icon: Lock,
        title: 'Seat Locked!',
        subtitle: 'Pay the remaining amount before the deadline to confirm your booking.',
        badge: 'SEAT LOCKED',
      }
    : {
        bgFrom: 'from-blue-400',
        bgVia: 'via-indigo-500',
        bgTo: 'to-purple-600',
        circle: 'bg-white',
        iconColor: 'text-indigo-600',
        ringColor: 'ring-white/30',
        Icon: Clock,
        title: 'Booking Created!',
        subtitle: 'Our team will contact you shortly to collect payment and confirm your trip.',
        badge: 'PENDING',
      };

  const Icon = theme.Icon;
  const trip = booking.trips;
  const shortId = booking.id.slice(0, 8).toUpperCase();
  // The "total to pay" after coupon is final_amount, NOT total_price
  const originalPrice = parseFloat(String(booking.total_price || 0));
  const finalAmount = parseFloat(String(booking.final_amount || booking.total_price || 0));
  const paidAmount = parseFloat(String(booking.amount_paid || 0));
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || Math.max(0, originalPrice - finalAmount);
  // Remaining = amount still owed against what user actually has to pay (the discounted total)
  const remainingAmount = Math.max(0, finalAmount - paidAmount);

  return (
    <div className={`fixed inset-0 z-50 bg-gradient-to-br ${theme.bgFrom} ${theme.bgVia} ${theme.bgTo} overflow-y-auto`}>
      {/* Soft blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-12 text-white">
        {/* Animated check / lock / clock circle */}
        <div className="relative mb-8 success-pop">
          {/* Outer pulsing ring */}
          <div className={`absolute inset-0 rounded-full ${theme.ringColor} ring-8 animate-ping-slow`}></div>
          <div className={`absolute inset-0 rounded-full ${theme.ringColor} ring-4 animate-ping-slower opacity-60`}></div>
          {/* Solid circle */}
          <div className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full ${theme.circle} shadow-2xl flex items-center justify-center`}>
            <Icon className={`h-16 w-16 sm:h-20 sm:w-20 ${theme.iconColor} success-icon-pop`} strokeWidth={2.5} />
          </div>
          {/* Sparkle dots */}
          {showConfetti && isConfirmed && (
            <>
              <div className="absolute -top-2 -left-4 w-3 h-3 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="absolute -top-4 right-2 w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              <div className="absolute top-6 -right-6 w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.6s' }}></div>
              <div className="absolute -bottom-2 -left-6 w-2 h-2 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              <div className="absolute -bottom-4 right-0 w-3 h-3 bg-yellow-200 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
            </>
          )}
        </div>

        {/* Status badge */}
        <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-[10px] sm:text-xs font-extrabold uppercase tracking-widest mb-3 animate-fade-in-delay">
          {theme.badge}
        </span>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center mb-2 sm:mb-3 px-4 animate-fade-in-delay">
          {theme.title}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-white/90 text-center max-w-md mb-8 sm:mb-10 px-4 animate-fade-in-delay-2">
          {theme.subtitle}
        </p>

        {/* Booking summary card */}
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-5 sm:p-6 text-gray-900 animate-fade-in-delay-2 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Booking ID</p>
              <p className="font-mono font-bold text-sm">{shortId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Guests</p>
              <p className="font-bold text-sm">{booking.number_of_participants || 1}</p>
            </div>
          </div>

          {trip && (
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-0.5">Trip</p>
                <p className="font-bold text-gray-900 text-base sm:text-lg leading-tight">{trip.title}</p>
                {trip.destination && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                  </p>
                )}
              </div>
              {trip.start_date && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>
                    {new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {trip.end_date && ` → ${new Date(trip.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Amount paid</span>
              <span className="font-extrabold text-lg flex items-baseline text-gray-900">
                <IndianRupee className="h-4 w-4" />{paidAmount.toLocaleString('en-IN')}
              </span>
            </div>
            {couponDiscount > 0 && booking.coupon_code && (
              <div className="flex items-center justify-between text-xs text-green-700 mt-2 pt-2 border-t border-gray-200">
                <span className="font-semibold">You saved with {booking.coupon_code}</span>
                <span className="font-bold flex items-baseline">
                  <IndianRupee className="h-3 w-3" />{couponDiscount.toLocaleString('en-IN')}
                </span>
              </div>
            )}
            {remainingAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-orange-700 mt-2 pt-2 border-t border-gray-200">
                <span className="font-semibold">Remaining</span>
                <span className="font-bold flex items-baseline">
                  <IndianRupee className="h-3 w-3" />{remainingAmount.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-md flex flex-col sm:flex-row gap-3 px-4 sm:px-0 animate-fade-in-delay-3">
          <Link
            href={`/bookings/${booking.id}`}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-bold px-5 py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all"
          >
            View booking
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trips"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border-2 border-white/50 text-white font-bold px-5 py-3.5 rounded-xl hover:bg-white/20 transition-all"
          >
            <Home className="h-4 w-4" />
            More trips
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.5; }
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes ping-slower {
          0% { transform: scale(1); opacity: 0.4; }
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
        .animate-ping-slow { animation: ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-ping-slower { animation: ping-slower 2.4s cubic-bezier(0, 0, 0.2, 1) infinite; }
        @keyframes success-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .success-pop { animation: success-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes icon-pop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .success-icon-pop { animation: icon-pop 0.5s ease-out 0.3s both; }
      `}</style>
    </div>
  );
}
