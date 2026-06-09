'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, MapPin, Clock, Users, User, Mail, Phone, Heart,
  CreditCard, IndianRupee, Lock, CheckCircle,
  AlertCircle, XCircle, Calendar, Package, Eye, QrCode, Save, Tag,
  MessageCircle, Download, Sparkles, ChevronRight, Copy, FileText, Check
} from 'lucide-react';
import { IMG } from '@/lib/image';

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  duration_text?: string;
  discounted_price?: number;
  seat_lock_price?: number;
  included_features?: string[];
  excluded_features?: string[];
  image_url?: string;
  cover_image_url?: string;
  gallery_images?: string[];
  pickup_location?: string;
  whatsapp_group_link?: string;
  highlights?: string[];
}

interface Booking {
  id: string;
  booking_status: string;
  payment_status?: string;
  payment_method?: string;
  transaction_id?: string;
  reference_id?: string;
  payment_amount?: number;
  total_price?: number;
  final_amount?: number;
  coupon_code?: string;
  coupon_discount?: number;
  wallet_amount_used?: number;
  payment_mode?: string;
  number_of_participants: number;
  primary_passenger_name?: string;
  primary_passenger_email?: string;
  primary_passenger_phone?: string;
  primary_passenger_gender?: string;
  primary_passenger_age?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  aadhaar_id?: string;
  passengers?: any[];
  created_at: string;
  rejection_reason?: string;
  trips?: Trip;
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<{ qrUrl?: string; upiId?: string }>({});
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchBooking();
    fetchPaymentSettings();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push(`/auth/signin?redirect=/bookings/${params.id}`);
      return;
    }
    setUser(currentUser);
  };

  const fetchBooking = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          trips (
            id,
            title,
            destination,
            start_date,
            end_date,
            duration_days,
            duration_text,
            discounted_price,
            seat_lock_price,
            included_features,
            excluded_features,
            image_url,
            cover_image_url,
            gallery_images,
            pickup_location,
            whatsapp_group_link,
            highlights
          )
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      // Verify user owns this booking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (data.user_id !== currentUser?.id) {
        setError('Unauthorized access');
        return;
      }

      setBooking(data);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      setError(error.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch('/api/payment/settings');
      if (response.ok) {
        const data = await response.json();
        setPaymentSettings(data);
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const calculateRemainingAmount = () => {
    if (!booking?.trips || booking.payment_method !== 'seat_lock') return 0;
    const fullPrice = (booking.trips.discounted_price || 0) * (booking.number_of_participants || 1);
    const paidAmount = parseFloat(String(booking.payment_amount || booking.final_amount || 0));
    return Math.max(0, fullPrice - paidAmount);
  };

  const handlePayRemaining = async () => {
    if (!transactionId.trim()) {
      setError('Please enter Transaction ID');
      return;
    }

    if (!booking) {
      setError('Booking not found');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Use API route to submit remaining payment (handles RLS)
      const response = await fetch('/api/bookings/submit-remaining-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          transactionId: transactionId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit remaining payment');
      }

      // Refresh booking data
      await fetchBooking();
      
      // Show success message
      alert('Remaining payment submitted successfully! We will review and confirm shortly.');
      
      // Reset form
      setShowPaymentSection(false);
      setTransactionId('');
      
      // Refresh the page to show updated status
      router.refresh();
    } catch (error: any) {
      console.error('Error submitting remaining payment:', error);
      setError(error.message || 'Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
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
      case 'remaining_submitted':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'seat_locked':
        return <Lock className="h-5 w-5 text-orange-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'remaining_submitted':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/bookings"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Bookings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const remainingAmount = calculateRemainingAmount();
  const showRemainingPayment = ['seat_locked', 'pending'].includes(booking.booking_status) && booking.payment_method === 'seat_lock' && remainingAmount > 0 && booking.booking_status !== 'remaining_submitted';

  // ─────────── derived display values ───────────
  const trip = booking.trips;
  const status = booking.booking_status || 'pending';
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const coverImage = trip?.cover_image_url || trip?.image_url || (trip?.gallery_images?.[0]) || '';
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtDateShort = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  const daysUntil = trip?.start_date ? Math.max(0, Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / 86400000)) : 0;
  const isUpcoming = daysUntil > 0;
  const isStartingSoon = daysUntil <= 7 && daysUntil > 0;
  const isPast = trip?.end_date ? new Date(trip.end_date).getTime() < Date.now() : false;

  const totalAmount = parseFloat(String(booking.total_price || 0));
  const finalAmount = parseFloat(String(booking.final_amount || booking.total_price || 0));
  const paidAmount = parseFloat(String(booking.payment_amount || (booking as any).amount_paid || 0));
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || Math.max(0, totalAmount - finalAmount);
  const walletUsed = parseFloat(String(booking.wallet_amount_used || 0));

  const maskPhone = (p?: string) => {
    if (!p) return '—';
    const s = String(p).replace(/\D/g, '');
    if (s.length < 4) return s;
    return s.slice(0, 2) + 'XXXXX' + s.slice(-3);
  };
  const maskAadhaar = (a?: string) => {
    if (!a) return '—';
    const s = String(a).replace(/\s/g, '');
    if (s.length < 4) return s;
    return 'XXXX XXXX ' + s.slice(-4);
  };

  const statusTheme = (() => {
    switch (status) {
      case 'confirmed':  return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Confirmed', icon: <CheckCircle className="h-3.5 w-3.5" /> };
      case 'seat_locked': return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Seat Locked', icon: <Lock className="h-3.5 w-3.5" /> };
      case 'pending':    return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Under review', icon: <Clock className="h-3.5 w-3.5" /> };
      case 'cancelled':
      case 'rejected':   return { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Cancelled', icon: <XCircle className="h-3.5 w-3.5" /> };
      default:           return { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400', label: status, icon: <Clock className="h-3.5 w-3.5" /> };
    }
  })();

  // Booking progress steps (5-step)
  const progressSteps = [
    { key: 'received', label: 'Booking received', done: true },
    { key: 'paid', label: 'Payment received', done: ['confirmed', 'seat_locked'].includes(status) || paidAmount > 0 },
    { key: 'reserved', label: 'Seat reserved', done: ['confirmed', 'seat_locked'].includes(status) },
    { key: 'soon', label: isStartingSoon ? 'Trip starting soon' : 'Trip starts', done: isPast, active: isStartingSoon },
    { key: 'done', label: 'Trip completed', done: isPast },
  ];

  const whatsappLink = trip?.whatsapp_group_link;
  const supportWhatsapp = 'https://wa.me/919621886657';
  const supportPhone = 'tel:+919621886657';

  const copyBookingId = () => {
    navigator.clipboard?.writeText(booking.id);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-32 lg:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Back link */}
        <Link href="/bookings" className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-purple-700 mb-4 sm:mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to bookings
        </Link>

        {/* ─────────── HERO ─────────── */}
        <div className="relative rounded-3xl overflow-hidden bg-gray-900 mb-4 sm:mb-6 shadow-xl">
          {coverImage ? (
            <div className="absolute inset-0">
              <img src={IMG.hero(coverImage)} alt={trip?.title || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-purple-900/60"></div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-fuchsia-700"></div>
          )}
          <div className="relative px-5 sm:px-8 lg:px-10 py-8 sm:py-12 lg:py-16 text-white">
            <div className="flex items-start justify-between gap-3 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 shadow-sm ${statusTheme.text}`}>
                {statusTheme.icon}
                {statusTheme.label}
              </span>
              {isUpcoming && !isPast && (
                <div className="hidden sm:block bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Trip starts in</p>
                  <p className="text-2xl font-extrabold mt-0.5">{daysUntil} day{daysUntil === 1 ? '' : 's'}</p>
                </div>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight max-w-2xl">
              {trip?.title || 'Your trip'}
            </h1>
            <p className="text-white/90 text-sm sm:text-base mt-2 flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />{trip?.destination || '—'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-white/70" />{fmtDateShort(trip?.start_date)} to {fmtDateShort(trip?.end_date)}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-white/70" />{booking.number_of_participants} traveller{booking.number_of_participants > 1 ? 's' : ''}</span>
              <button onClick={copyBookingId} className="flex items-center gap-1.5 hover:text-white/100 text-white/85 font-mono text-xs">
                <Copy className="h-3 w-3" />#{shortId}
              </button>
            </div>
            {isUpcoming && !isPast && (
              <div className="sm:hidden mt-4 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 inline-block">
                <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">Starts in</p>
                <p className="text-xl font-extrabold mt-0.5">{daysUntil} day{daysUntil === 1 ? '' : 's'}</p>
              </div>
            )}
          </div>
        </div>

        {/* ─────────── QUICK ACTIONS ─────────── */}
        <div className="mb-4 sm:mb-6 -mx-4 sm:mx-0">
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 overflow-x-auto sm:overflow-visible gap-2 sm:gap-3 px-4 sm:px-0 scrollbar-hide">
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Trip WhatsApp</span>
              </a>
            )}
            <a href={supportWhatsapp} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Support</span>
            </a>
            <a href={supportPhone} className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
              <Phone className="h-5 w-5 text-blue-600" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Call us</span>
            </a>
            <button onClick={() => window.print()} className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
              <FileText className="h-5 w-5 text-gray-700" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Print ticket</span>
            </button>
            <Link href="/trips" className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
              <Sparkles className="h-5 w-5 text-fuchsia-600" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Browse trips</span>
            </Link>
          </div>
        </div>

        {/* ─────────── PROGRESS TIMELINE ─────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-4">Booking progress</p>
          <ol className="hidden md:flex items-start justify-between gap-2">
            {progressSteps.map((s, i) => (
              <li key={s.key} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${s.done ? 'bg-green-600' : (s as any).active ? 'bg-orange-500 ring-4 ring-orange-100' : 'bg-gray-200 text-gray-400'}`}>
                    {s.done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <p className={`mt-2 text-xs font-semibold text-center ${s.done ? 'text-gray-900' : (s as any).active ? 'text-orange-700' : 'text-gray-400'}`}>{s.label}</p>
                </div>
                {i < progressSteps.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-0.5 ${progressSteps[i + 1].done ? 'bg-green-600' : 'bg-gray-200'}`} style={{ marginLeft: '20px', width: 'calc(100% - 40px)' }}></div>
                )}
              </li>
            ))}
          </ol>
          {/* Mobile vertical */}
          <ol className="md:hidden space-y-3 relative border-l-2 border-gray-200 ml-3.5 pl-5">
            {progressSteps.map((s) => (
              <li key={s.key} className="relative">
                <span className={`absolute -left-[27px] top-0.5 h-4 w-4 rounded-full ring-4 ring-white ${s.done ? 'bg-green-600' : (s as any).active ? 'bg-orange-500' : 'bg-gray-300'}`}></span>
                <p className={`text-sm font-semibold ${s.done ? 'text-gray-900' : (s as any).active ? 'text-orange-700' : 'text-gray-400'}`}>{s.label}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* ─────────── OVERVIEW GRID ─────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <InfoCard icon={<Calendar className="h-5 w-5 text-purple-600" />} label="Travel dates" value={`${fmtDateShort(trip?.start_date)} → ${fmtDateShort(trip?.end_date)}`} />
          <InfoCard icon={<MapPin className="h-5 w-5 text-fuchsia-600" />} label="Destination" value={trip?.destination || '—'} />
          <InfoCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Travellers" value={String(booking.number_of_participants)} />
          <InfoCard icon={<MapPin className="h-5 w-5 text-orange-600" />} label="Pickup point" value={trip?.pickup_location || 'Shared 7 days before'} />
          <InfoCard icon={<Clock className="h-5 w-5 text-indigo-600" />} label="Duration" value={trip?.duration_text || (trip?.duration_days ? `${trip.duration_days} day${trip.duration_days > 1 ? 's' : ''}` : '—')} />
          <InfoCard icon={<CreditCard className="h-5 w-5 text-green-600" />} label="Payment" value={booking.payment_status === 'paid' || status === 'confirmed' ? 'Paid' : (booking.payment_status || 'Pending')} valueClass={booking.payment_status === 'paid' || status === 'confirmed' ? 'text-green-700' : 'text-orange-700'} />
        </div>

        {/* ─────────── MAIN 2-COL ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* LEFT 70% */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Included / Excluded */}
            {(trip?.included_features?.length || trip?.excluded_features?.length) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trip?.included_features && trip.included_features.length > 0 && (
                  <div className="bg-white border border-green-200 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="h-4 w-4 text-green-700" /></div>
                      <h3 className="font-bold text-gray-900">What's included</h3>
                    </div>
                    <ul className="space-y-2">
                      {trip.included_features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {trip?.excluded_features && trip.excluded_features.length > 0 && (
                  <div className="bg-white border border-orange-200 rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-orange-700" /></div>
                      <h3 className="font-bold text-gray-900">Not included</h3>
                    </div>
                    <ul className="space-y-2">
                      {trip.excluded_features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <XCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {/* Primary passenger */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><User className="h-4 w-4 text-purple-700" /></div>
                <h3 className="font-bold text-gray-900">Primary traveller</h3>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                  {(booking.primary_passenger_name || 'T')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 text-base">{booking.primary_passenger_name || 'Traveller'}</p>
                  <p className="text-sm text-gray-500 truncate flex items-center gap-1.5"><Mail className="h-3 w-3" />{booking.primary_passenger_email || '—'}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" />{maskPhone(booking.primary_passenger_phone)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-gray-500 mb-0.5">Gender</p><p className="font-semibold text-gray-900 capitalize">{booking.primary_passenger_gender || '—'}</p></div>
                <div><p className="text-gray-500 mb-0.5">Age</p><p className="font-semibold text-gray-900">{booking.primary_passenger_age || '—'}</p></div>
                <div><p className="text-gray-500 mb-0.5">Aadhaar</p><p className="font-semibold text-gray-900 font-mono">{maskAadhaar(booking.aadhaar_id)}</p></div>
              </div>
            </div>

            {/* Additional passengers */}
            {booking.passengers && booking.passengers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Users className="h-4 w-4 text-blue-700" /></div>
                  <h3 className="font-bold text-gray-900">Additional travellers ({booking.passengers.length})</h3>
                </div>
                <div className="space-y-3">
                  {booking.passengers.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                        {(p?.name || 'P')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{p?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{maskPhone(p?.phone)} · {p?.age || '—'} yrs · <span className="capitalize">{p?.gender || '—'}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency contact */}
            {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
              <div className="bg-white border border-pink-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center"><Heart className="h-4 w-4 text-pink-700" /></div>
                  <h3 className="font-bold text-gray-900">Emergency contact</h3>
                </div>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-gray-900 text-base">{booking.emergency_contact_name || '—'}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{booking.emergency_contact_phone || '—'}</p>
                  </div>
                  {booking.emergency_contact_phone && (
                    <div className="flex gap-2">
                      <a href={`tel:${booking.emergency_contact_phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-bold">
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/91${String(booking.emergency_contact_phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection reason */}
            {booking.payment_status === 'rejected' && booking.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-red-900 mb-1">Rejection reason</p>
                <p className="text-sm text-red-800">{booking.rejection_reason}</p>
              </div>
            )}
          </div>

          {/* RIGHT 30% — sticky */}
          <div className="space-y-4 sm:space-y-6">
            <div className="lg:sticky lg:top-20 space-y-4 sm:space-y-6">
              {/* Payment summary */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><CreditCard className="h-4 w-4 text-purple-700" /></div>
                  <h3 className="font-bold text-gray-900">Payment summary</h3>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-600">Trip price</dt><dd className="font-semibold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</dd></div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-700"><dt className="flex items-center gap-1"><Tag className="h-3 w-3" />{booking.coupon_code || 'Coupon'}</dt><dd className="font-semibold">−₹{couponDiscount.toLocaleString('en-IN')}</dd></div>
                  )}
                  {walletUsed > 0 && (
                    <div className="flex justify-between text-purple-700"><dt>Wallet used</dt><dd className="font-semibold">−₹{walletUsed.toLocaleString('en-IN')}</dd></div>
                  )}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-baseline">
                    <dt className="text-sm text-gray-600">Amount paid</dt>
                    <dd className="text-2xl font-extrabold text-gray-900">₹{Math.max(paidAmount, finalAmount - remainingAmount).toLocaleString('en-IN')}</dd>
                  </div>
                  {remainingAmount > 0 && (
                    <div className="flex justify-between text-orange-700 mt-1"><dt className="font-semibold">Pending</dt><dd className="font-bold">₹{remainingAmount.toLocaleString('en-IN')}</dd></div>
                  )}
                </dl>
                {(booking.transaction_id || booking.reference_id) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Transaction ID</p>
                    <p className="font-mono text-xs text-gray-900 break-all">{booking.reference_id || booking.transaction_id}</p>
                  </div>
                )}
              </div>

              {/* What's next */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Sparkles className="h-4 w-4 text-blue-700" /></div>
                  <h3 className="font-bold text-gray-900">What's next</h3>
                </div>
                <ul className="space-y-3 text-sm">
                  {whatsappLink && (
                    <li className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700"><a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-purple-700 font-semibold underline">Join the trip WhatsApp group</a> to meet your fellow travellers</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Carry a valid government ID (Aadhaar / Driving Licence / Passport)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Reach the pickup point at least 30 minutes early</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">We'll send packing tips a week before departure</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────── Remaining payment (kept) ─────────── */}
        {showRemainingPayment && (
          <div className="mt-4 sm:mt-6 bg-white border-2 border-orange-300 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-orange-700 mb-1">Pay this to confirm your seat</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-orange-600 flex items-baseline"><IndianRupee className="h-7 w-7" />{remainingAmount.toLocaleString('en-IN')}</p>
                {trip?.start_date && (
                  <p className="text-sm text-orange-700 mt-2">Due by <strong>{fmtDate(new Date(new Date(trip.start_date).setDate(new Date(trip.start_date).getDate() - 5)).toISOString())}</strong></p>
                )}
              </div>
            </div>
            {!showPaymentSection ? (
              <button onClick={() => setShowPaymentSection(true)} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all">
                <CreditCard className="h-5 w-5" /> Pay remaining amount
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <p className="text-sm font-bold text-gray-900 mb-3">Payment instructions</p>
                  {paymentSettings.qrUrl && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-600 mb-2">Scan QR Code:</p>
                      <div className="bg-white p-3 rounded-lg border border-gray-200 inline-block">
                        <img src={paymentSettings.qrUrl} alt="Payment QR" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                      </div>
                    </div>
                  )}
                  {paymentSettings.upiId && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-600 mb-2">UPI ID:</p>
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="font-mono font-semibold text-purple-900 text-sm break-all">{paymentSettings.upiId}</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-gray-900 mb-2">Transaction ID *</label>
                    <input type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Enter your transaction ID" className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm" />
                    <p className="text-xs text-gray-500 mt-2">From your payment confirmation</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => { setShowPaymentSection(false); setTransactionId(''); setError(''); }} disabled={submitting} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={handlePayRemaining} disabled={submitting || !transactionId.trim()} className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                    {submitting ? (<><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div><span>Submitting...</span></>) : (<><Save className="h-5 w-5" /><span>Submit payment</span></>)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────── Footer info ─────────── */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
          <span>Booking ID <button onClick={copyBookingId} className="font-mono font-semibold text-gray-900 hover:text-purple-700">#{shortId}</button></span>
          <span>Booked on {new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <a href="mailto:support@ghumakkars.in" className="text-purple-700 font-semibold hover:underline">support@ghumakkars.in</a>
        </div>
      </div>

      {/* ─────────── Mobile sticky bottom bar ─────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-3 gap-1 p-2">
          <a href={supportWhatsapp} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 px-2 py-2.5 hover:bg-gray-50 rounded-lg">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <span className="text-[10px] font-bold text-gray-700">WhatsApp</span>
          </a>
          <a href={supportPhone} className="flex flex-col items-center gap-1 px-2 py-2.5 hover:bg-gray-50 rounded-lg">
            <Phone className="h-5 w-5 text-blue-600" />
            <span className="text-[10px] font-bold text-gray-700">Call</span>
          </a>
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1 px-2 py-2.5 hover:bg-gray-50 rounded-lg">
            <FileText className="h-5 w-5 text-purple-600" />
            <span className="text-[10px] font-bold text-gray-700">Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mb-2">{icon}</div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${valueClass || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
