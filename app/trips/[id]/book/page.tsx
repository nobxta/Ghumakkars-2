'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Plus, X, User, Mail, Phone, Users, AlertCircle, CreditCard, QrCode, IndianRupee, Save, ChevronDown, ChevronUp, CheckCircle, Check, MapPin, Tag, Lock, Shield, Zap, Headphones, Info } from 'lucide-react';
import { nextOccurrences, formatDeparture } from '@/lib/recurrence';
import UpiPayButton from '@/components/UpiPayButton';
import { upiNote } from '@/lib/upi';

interface Passenger {
  name: string;
  phone: string;
  age: string;
  gender: string;
  aadhaar_id: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  discounted_price: number;
  seat_lock_price?: number;
  max_participants: number;
  current_participants: number;
  is_recurring?: boolean;
  recurrence_day?: number;
  recurrence_weeks_ahead?: number;
  duration_days?: number;
  pickup_points?: string[];
}

// Removed college list — no longer needed

// ── Booking redesign tokens ──
const PURPLE_GRAD = 'linear-gradient(135deg,#7C3AED,#9333EA)';
const BOOK_CARD = 'rounded-[20px] bg-white border border-[#E2E8F0]';
const BOOK_CARD_SHADOW = { boxShadow: '0 8px 24px rgba(15,23,42,0.06)' } as const;
const BOOK_FIELD = 'w-full h-11 px-4 text-sm rounded-[14px] bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-purple-500 focus:ring-4 focus:ring-purple-100';
const BOOK_LABEL = 'block text-sm font-semibold text-[#0F172A] mb-1.5';
const BOOK_SECTION_TITLE = 'text-sm font-semibold text-[#0F172A] mb-3 uppercase tracking-wide';
const BOOK_INPUT = 'w-full h-11 pr-4 text-sm rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]';

// Labelled input with an optional leading icon (mockup "Field").
function BookField({ label, value, onChange, placeholder, type = 'text', Icon, maxLength, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; Icon?: React.ElementType; maxLength?: number; inputMode?: 'numeric' | 'text' | 'email' | 'tel';
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#0F172A]">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8] pointer-events-none" />}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          maxLength={maxLength} inputMode={inputMode}
          className={`${BOOK_INPUT} ${Icon ? 'pl-10' : 'pl-4'}`}
        />
      </div>
    </div>
  );
}

// Labelled native select (mockup "SelectField").
function BookSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-[#0F172A]">{label}</label>
      <div className="relative">
        <select
          value={value} onChange={(e) => onChange(e.target.value)}
          className={`${BOOK_INPUT} pl-4 appearance-none ${value ? '' : 'text-[#94a3b8]'}`}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8] pointer-events-none" />
      </div>
    </div>
  );
}

export default function BookTripPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [showPaymentDetails, setShowPaymentDetails] = useState(false); // For showing QR/Txn ID after clicking Pay
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [trip, setTrip] = useState<Trip | null>(null);

  // Primary Passenger Details (pre-filled from profile if logged in)
  const [primaryName, setPrimaryName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [primaryGender, setPrimaryGender] = useState('');
  const [primaryAge, setPrimaryAge] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [aadhaarId, setAadhaarId] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupSearch, setPickupSearch] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [seatLockModal, setSeatLockModal] = useState(false);

  // Additional Passengers
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  // Payment
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'full' | 'seat_lock'>('full');

  // Force full payment when early bird is active
  useEffect(() => {
    if (trip && paymentMethod === 'seat_lock') {
      const eb: any = (trip as any).early_bird_conditions;
      const ebPrice = (trip as any).early_bird_price;
      if (eb?.enabled && ebPrice && ebPrice > 0 && ebPrice < trip.discounted_price) {
        const conditions = eb.conditions || [];
        const now = new Date();
        let active = conditions.length > 0;
        for (const c of conditions) {
          if (c.type === 'date_range' && c.value) {
            const [s, e] = String(c.value).split('|');
            if (s && e && (now < new Date(s) || now > new Date(e))) { active = false; break; }
          }
          if (c.type === 'first_bookings' && c.value) {
            if (((trip as any).current_participants || 0) >= parseInt(c.value)) { active = false; break; }
          }
        }
        if (active) setPaymentMethod('full');
      }
    }
  }, [trip, paymentMethod]);
  const [paymentMode, setPaymentMode] = useState<'manual' | 'razorpay'>('manual');
  const [paymentSettings, setPaymentSettings] = useState<{ 
    qrUrl?: string; 
    upiId?: string; 
    paymentMode?: 'manual' | 'razorpay';
  }>({});
  const [processingRazorpay, setProcessingRazorpay] = useState(false);
  const [paymentOverlay, setPaymentOverlay] = useState<'idle' | 'preparing' | 'processing'>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCashConfirm, setShowCashConfirm] = useState(false);
  const razorpayPaymentCompletedRef = useRef(false);
  const paymentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefilledRef = useRef(false); // ensures profile pre-fill runs once, never wiping typed input
  const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState(0);

  // Whenever the coupon changes (applied or removed), re-cap the wallet
  // amount so users don't over-spend wallet when a deep discount kicks in.
  useEffect(() => {
    if (!useWallet || !trip) return;
    const totalPassengers = 1 + passengers.length;
    const perPersonPrice = (() => {
      if (paymentMethod === 'seat_lock' && trip.seat_lock_price) return trip.seat_lock_price;
      const earlyBird = (trip as any).early_bird_active_price;
      return earlyBird || trip.discounted_price || 0;
    })();
    const basePrice = perPersonPrice * totalPassengers;
    const amountToPayNowBeforeWallet = couponApplied ? Number(couponApplied.final_amount || 0) : basePrice;
    const cappedWallet = Math.min(walletBalance, amountToPayNowBeforeWallet);
    if (walletAmount > cappedWallet) {
      setWalletAmount(cappedWallet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponApplied, trip, passengers.length, paymentMethod, useWallet, walletBalance]);

  useEffect(() => {
    checkUser();
    fetchTrip();
    fetchPaymentSettings();
  }, [params.id]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string): string => {
    if (!dateOfBirth) return '';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age.toString() : '';
  };

  useEffect(() => {
    // Pre-fill ONCE, and only into fields the user hasn't touched. Without this
    // guard a re-fired effect (e.g. an auth/session refresh changing the `user`
    // reference) would re-run the setters and wipe what the user already typed —
    // which then failed validation as "please fill in all details".
    if (prefilledRef.current) return;
    const fillIfEmpty = (current: string, value: string, setter: (v: string) => void) => {
      if (!current && value) setter(value);
    };

    if (profile) {
      prefilledRef.current = true;
      fillIfEmpty(primaryName, `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name || '', setPrimaryName);
      fillIfEmpty(primaryEmail, profile.email || user?.email || '', setPrimaryEmail);
      fillIfEmpty(primaryPhone, profile.phone || profile.phone_number || '', setPrimaryPhone);
      // Normalise gender so it matches the <select> option values (male/female/…).
      if (profile.gender) fillIfEmpty(primaryGender, String(profile.gender).toLowerCase(), setPrimaryGender);
      if (profile.date_of_birth) {
        const age = calculateAge(profile.date_of_birth);
        if (age) fillIfEmpty(primaryAge, age, setPrimaryAge);
      }
      if (profile.aadhaar_id) fillIfEmpty(aadhaarId, profile.aadhaar_id, setAadhaarId);
      if (profile.emergency_contact_name) fillIfEmpty(emergencyContactName, profile.emergency_contact_name, setEmergencyContactName);
      if (profile.emergency_contact) fillIfEmpty(emergencyContactPhone, profile.emergency_contact, setEmergencyContactPhone);
    } else if (user?.email) {
      // Profile not loaded yet — only seed the email; keep the guard open so the
      // full pre-fill still runs once the profile arrives.
      fillIfEmpty(primaryEmail, user.email, setPrimaryEmail);
    }
  }, [profile, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const clearPaymentTimeout = () => {
    if (paymentTimeoutRef.current) {
      clearTimeout(paymentTimeoutRef.current);
      paymentTimeoutRef.current = null;
    }
  };

  // ───────── Draft autosave: survive accidental close / refresh (kept 24h) ─────────
  // Saved to this browser only (localStorage). People often close or refresh the
  // page mid-booking; this brings their passenger/Aadhaar details back so they
  // just click through to payment instead of re-filling everything.
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
  const draftKey = () => `gk_booking_draft_${params.id}_${user?.id || 'anon'}`;
  const draftRestoredRef = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDraft = () => {
    try { if (typeof window !== 'undefined') localStorage.removeItem(draftKey()); } catch { /* ignore */ }
  };

  // Restore a saved draft once we know the user + trip.
  useEffect(() => {
    if (draftRestoredRef.current || !user || !trip) return;
    draftRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) { clearDraft(); return; }
      const d = parsed.data || {};
      if (d.primaryName) setPrimaryName(d.primaryName);
      if (d.primaryEmail) setPrimaryEmail(d.primaryEmail);
      if (d.primaryPhone) setPrimaryPhone(d.primaryPhone);
      if (d.primaryGender) setPrimaryGender(d.primaryGender);
      if (d.primaryAge) setPrimaryAge(d.primaryAge);
      if (d.emergencyContactName) setEmergencyContactName(d.emergencyContactName);
      if (d.emergencyContactPhone) setEmergencyContactPhone(d.emergencyContactPhone);
      if (d.aadhaarId) setAadhaarId(d.aadhaarId);
      if (d.departureDate) setDepartureDate(d.departureDate);
      if (d.pickupPoint) setPickupPoint(d.pickupPoint);
      if (Array.isArray(d.passengers)) setPassengers(d.passengers);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      // Stop the profile pre-fill from overriding what we just restored.
      prefilledRef.current = true;
      showToast('We brought back your saved details — kept for 24 hours.', 'info');
    } catch { /* corrupt draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, trip]);

  // Save the draft whenever the form changes (debounced).
  useEffect(() => {
    if (!draftRestoredRef.current || !user) return; // never save before a restore attempt
    const hasData = !!(primaryName || primaryPhone || aadhaarId || passengers.length);
    if (!hasData) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(), JSON.stringify({
          savedAt: Date.now(),
          data: {
            primaryName, primaryEmail, primaryPhone, primaryGender, primaryAge,
            emergencyContactName, emergencyContactPhone, aadhaarId,
            departureDate, pickupPoint, passengers, paymentMethod,
          },
        }));
      } catch { /* storage disabled / full — ignore */ }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryName, primaryEmail, primaryPhone, primaryGender, primaryAge,
      emergencyContactName, emergencyContactPhone, aadhaarId, departureDate,
      pickupPoint, passengers, paymentMethod, user]);

  const abandonRazorpayBooking = async (bookingId: string) => {
    try {
      await fetch('/api/bookings/abandon-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
    } catch (e) {
      console.error('Abandon payment API error:', e);
    }
  };

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push(`/auth/signin?redirect=/trips/${params.id}/book`);
      return;
    }
    setUser(currentUser);

    // Fetch user profile with all fields
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, wallet_balance')
      .eq('id', currentUser.id)
      .single();
    
    setProfile(profileData);
    setWalletBalance(profileData?.wallet_balance || 0);
    setLoading(false);
  };

  const fetchTrip = async () => {
    try {
      const idOrSlug = String(params.id);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const query = supabase.from('trips').select('id, title, destination, discounted_price, seat_lock_price, max_participants, current_participants, early_bird_price, early_bird_conditions, is_recurring, recurrence_day, recurrence_weeks_ahead, duration_days, pickup_points');
      const { data, error } = isUuid
        ? await query.eq('id', idOrSlug).single()
        : await query.eq('slug', idOrSlug).single();

      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
      router.push('/trips');
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/payment/settings');
      if (!res.ok) return;
      const data = await res.json();
      const mode = (data.paymentMode ?? data.payment_mode ?? 'manual') as 'manual' | 'razorpay';
      setPaymentMode(mode);
      setPaymentSettings({
        qrUrl: data.qrUrl ?? data.payment_qr_url ?? undefined,
        upiId: data.upiId ?? data.payment_upi_id ?? undefined,
        paymentMode: mode,
      });
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setApplyingCoupon(true);
    setCouponError('');
    
    try {
      const totalAmount = getBasePrice();
      const response = await fetch('/api/payment/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          amount: totalAmount,
          tripId: trip?.id,
          userId: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCouponError(data.error || 'Invalid coupon code');
        setCouponApplied(null);
        return;
      }

      setCouponApplied(data);
      setCouponError('');
      
      // If discounted price <= seat lock price, switch to full payment
      if (trip && trip.seat_lock_price) {
        const totalPassengers = 1 + passengers.length;
        const seatLockPrice = trip.seat_lock_price * totalPassengers;
        if (data.final_amount <= seatLockPrice && paymentMethod === 'seat_lock') {
          setPaymentMethod('full');
        }
      }
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      setCouponError('Failed to validate coupon. Please try again.');
      setCouponApplied(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(null);
    setCouponError('');
  };

  const handleRazorpayPayment = async () => {
    if (!trip || !user) return;
    
    setProcessingRazorpay(true);
    setPaymentOverlay('preparing');
    setError('');

    try {
      // First create booking
      const totalPassengers = 1 + passengers.length;
      const basePrice = getBasePrice();
      const couponDiscount = couponApplied ? couponApplied.discount_amount : 0;
      const amountToPayNowBeforeWallet = getAmountToPayBeforeWallet();

      // CAP wallet to what's actually needed after coupon.
      // Prevents over-deduction when user toggled wallet BEFORE applying coupon.
      const walletToUse = (useWallet && walletAmount > 0)
        ? Math.min(walletAmount, walletBalance, amountToPayNowBeforeWallet)
        : 0;
      let finalAmount = Math.max(0, amountToPayNowBeforeWallet - walletToUse);

      // Use wallet if selected
      let walletAmountUsed = 0;
      if (walletToUse > 0) {
        try {
          const walletResponse = await fetch('/api/wallet/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: walletToUse,
              description: `Booking payment for ${trip.title}`,
            }),
          });

          if (walletResponse.ok) {
            const walletData = await walletResponse.json();
            walletAmountUsed = walletData.amountUsed;
            setWalletBalance(walletData.remainingBalance);
            // Recompute final amount from actual server-confirmed wallet spend
            finalAmount = Math.max(0, amountToPayNowBeforeWallet - walletAmountUsed);
          } else {
            const errorData = await walletResponse.json();
            setError(errorData.error || 'Failed to use wallet balance');
            setProcessingRazorpay(false);
            setPaymentOverlay('idle');
            return;
          }
        } catch (walletError: any) {
          console.error('Error using wallet:', walletError);
          setError('Failed to process wallet payment. Please try again.');
          setProcessingRazorpay(false);
          setPaymentOverlay('idle');
          return;
        }
      }

      const allPassengers = [
        {
          name: primaryName,
          email: primaryEmail,
          phone: primaryPhone.replace(/\D/g, ''),
          age: parseInt(primaryAge),
          gender: primaryGender,
          is_primary: true,
        },
        ...passengers.map(p => ({
          name: p.name,
          phone: p.phone.replace(/\D/g, ''),
          age: parseInt(p.age),
          gender: p.gender,
          is_primary: false,
        }))
      ];

      const bookingPayload = {
        trip_id: trip.id,
        number_of_participants: totalPassengers,
        total_price: basePrice,
        final_amount: finalAmount,
        coupon_code: couponApplied?.coupon?.code || null,
        coupon_discount: couponDiscount,
        wallet_amount_used: walletAmountUsed,
        primary_passenger_name: primaryName,
        primary_passenger_email: primaryEmail,
        primary_passenger_phone: primaryPhone.replace(/\D/g, ''),
        primary_passenger_gender: primaryGender,
        primary_passenger_age: parseInt(primaryAge),
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone.replace(/\D/g, ''),
        aadhaar_id: aadhaarId || null,
        passengers: allPassengers,
        payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
        payment_mode: 'razorpay',
        payment_status: 'pending',
        booking_status: 'pending',
        amount_paid: 0,
        departure_date: trip.is_recurring ? departureDate : null,
        pickup_point: pickupPoint || null,
      };

      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });
      const bookingData = await bookingRes.json();
      if (!bookingRes.ok) {
        throw new Error(bookingData.error || 'Failed to create booking');
      }

      // Zero-amount case: wallet + coupon fully cover the trip.
      // Razorpay can't process < ₹1, so skip the gateway and confirm directly.
      if (finalAmount < 1) {
        const confirmRes = await fetch('/api/bookings/confirm-zero-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: bookingData.id }),
        });
        const confirmData = await confirmRes.json().catch(() => ({}));
        if (!confirmRes.ok) {
          throw new Error(confirmData.error || 'Failed to confirm booking');
        }
        await fetch('/api/bookings/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: bookingData.id, status: 'confirmed' }),
        }).catch(() => {});
        setPaymentOverlay('idle');
        setProcessingRazorpay(false);
        showToast('Booking confirmed! Fully covered by wallet + coupon.', 'success');
        clearDraft();
      router.push(`/booking-success/${bookingData.id}`);
        return;
      }

      // Create Razorpay order (only for remaining amount after wallet)
      const orderResponse = await fetch('/api/payment/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount, // This is already reduced by wallet amount
          bookingId: bookingData.id,
          tripId: trip.id,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Load Razorpay script dynamically
      razorpayPaymentCompletedRef.current = false;
      clearPaymentTimeout();

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Ghumakkars',
          description: `Booking for ${trip.title}`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            clearPaymentTimeout();
            razorpayPaymentCompletedRef.current = true;
            try {
              const verifyResponse = await fetch('/api/payment/verify-razorpay-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  bookingId: bookingData.id,
                }),
              });

              const verifyData = await verifyResponse.json();

              if (!verifyResponse.ok) {
                throw new Error(verifyData.error || 'Payment verification failed');
              }

              await fetch('/api/bookings/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingId: bookingData.id,
                  status: 'confirmed',
                }),
              });

              setPaymentOverlay('idle');
              setProcessingRazorpay(false);
              showToast('Payment successful! Your booking is confirmed.', 'success');
              clearDraft();
      router.push(`/booking-success/${bookingData.id}`);
            } catch (error: any) {
              console.error('Payment verification error:', error);
              setPaymentOverlay('idle');
              setProcessingRazorpay(false);
              showToast(error?.message || 'Payment verification failed. Please try again.', 'error');
            }
          },
          prefill: {
            name: primaryName,
            email: primaryEmail,
            contact: primaryPhone,
          },
          theme: {
            color: '#7c3aed',
          },
          modal: {
            ondismiss: function () {
              clearPaymentTimeout();
              setProcessingRazorpay(false);
              setPaymentOverlay('idle');
              if (!razorpayPaymentCompletedRef.current) {
                abandonRazorpayBooking(bookingData.id);
                showToast('Payment not completed. Booking cancelled.', 'error');
              }
            },
          },
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
        setPaymentOverlay('processing');

        // 5-minute timeout: if user doesn't pay, mark booking as abandoned so it doesn't stay pending
        paymentTimeoutRef.current = setTimeout(() => {
          paymentTimeoutRef.current = null;
          if (razorpayPaymentCompletedRef.current) return;
          abandonRazorpayBooking(bookingData.id);
          setPaymentOverlay('idle');
          setProcessingRazorpay(false);
          showToast('Payment window expired. Booking cancelled.', 'error');
        }, PAYMENT_TIMEOUT_MS);

        razorpay.on('payment.failed', function (response: any) {
          clearPaymentTimeout();
          setPaymentOverlay('idle');
          setProcessingRazorpay(false);
          abandonRazorpayBooking(bookingData.id);
          showToast('Payment failed. Booking cancelled.', 'error');
        });
      };
      document.body.appendChild(script);
    } catch (error: any) {
      console.error('Razorpay payment error:', error);
      setPaymentOverlay('idle');
      setError(error.message || 'Failed to initiate payment');
      setProcessingRazorpay(false);
      showToast(error?.message || 'Failed to initiate payment.', 'error');
    }
  };

  const handleCashPaymentConfirm = async () => {
    setShowCashConfirm(false);
    if (!trip || !user) return;

    setSubmitting(true);
    setError('');

    try {
      const totalPassengers = 1 + passengers.length;
      const basePrice = getBasePrice();
      const couponDiscount = couponApplied ? couponApplied.discount_amount : 0;
      const amountToPayNowBeforeWallet = getAmountToPayBeforeWallet();
      
      // Use wallet if selected
      let walletAmountUsed = 0;
      let walletToUse = (useWallet && walletAmount > 0)
        ? Math.min(walletAmount, walletBalance, amountToPayNowBeforeWallet)
        : 0;

      if (walletToUse > 0) {
        try {
          const walletResponse = await fetch('/api/wallet/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: walletToUse,
              description: `Booking payment for ${trip.title}`,
            }),
          });
          
          if (walletResponse.ok) {
            const walletData = await walletResponse.json();
            walletAmountUsed = walletData.amountUsed;
            setWalletBalance(walletData.remainingBalance);
          } else {
            const errorData = await walletResponse.json();
            setError(errorData.error || 'Failed to use wallet balance');
            setSubmitting(false);
            return;
          }
        } catch (walletError: any) {
          console.error('Error using wallet:', walletError);
          setError('Failed to process wallet payment. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      // Calculate final amount after wallet
      let finalAmount = Math.max(0, amountToPayNowBeforeWallet - walletAmountUsed);

      const allPassengers = [
        {
          name: primaryName,
          email: primaryEmail,
          phone: primaryPhone.replace(/\D/g, ''),
          age: parseInt(primaryAge),
          gender: primaryGender,
          is_primary: true,
        },
        ...passengers.map(p => ({
          name: p.name,
          phone: p.phone.replace(/\D/g, ''),
          age: parseInt(p.age),
          gender: p.gender,
          is_primary: false,
        }))
      ];

      const cashBookingPayload = {
        trip_id: trip.id,
        number_of_participants: totalPassengers,
        total_price: basePrice,
        final_amount: finalAmount,
        coupon_code: couponApplied?.coupon?.code || null,
        coupon_discount: couponDiscount,
        wallet_amount_used: walletAmountUsed,
        primary_passenger_name: primaryName,
        primary_passenger_email: primaryEmail,
        primary_passenger_phone: primaryPhone.replace(/\D/g, ''),
        primary_passenger_gender: primaryGender,
        primary_passenger_age: parseInt(primaryAge),
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone.replace(/\D/g, ''),
        aadhaar_id: aadhaarId || null,
        passengers: allPassengers,
        payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
        payment_mode: 'cash',
        payment_status: 'cash_pending',
        booking_status: 'pending',
        amount_paid: 0,
        reference_id: null,
        departure_date: trip.is_recurring ? departureDate : null,
        pickup_point: pickupPoint || null,
      };

      const cashBookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cashBookingPayload),
      });
      const bookingData = await cashBookingRes.json();
      if (!cashBookingRes.ok) {
        throw new Error(bookingData.error || 'Failed to create booking');
      }

      // Send notification
      await fetch('/api/bookings/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingData.id,
          status: 'pending',
        }),
      });

      showToast('Booking created! Admin will contact you to collect payment and confirm.', 'success');
      clearDraft();
      router.push(`/booking-success/${bookingData.id}`);
    } catch (error: any) {
      console.error('Error creating cash payment booking:', error);
      setError(error.message || 'Failed to create booking');
      showToast(error?.message || 'Failed to create booking.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCashPayment = () => {
    if (!trip || !user) return;
    if (currentStep === 1 && !validateStep(1)) return;
    if (currentStep === 2 && !validateStep(2)) return;
    setShowCashConfirm(true);
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', phone: '', age: '', gender: '', aadhaar_id: '' }]);
  };

  const removePassenger = (index: number) => {
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };


  const validateStep = (step: number): boolean => {
    setError('');
    if (step === 3 && showPaymentDetails) {
      // Don't validate step 3 if we're showing payment details - validation happens on submit
      return true;
    }
    switch (step) {
      case 1:
        if (trip?.is_recurring && !departureDate) {
          setError('Please choose a departure date for this trip');
          return false;
        }
        if (trip?.pickup_points && trip.pickup_points.length > 0 && !pickupPoint) {
          setError('Please choose a pickup point');
          return false;
        }
        if (!primaryName || !primaryEmail || !primaryPhone || !primaryGender || !primaryAge) {
          setError('Please fill in all primary passenger details');
          return false;
        }
        if (!/^\d{10}$/.test(primaryPhone.replace(/\D/g, ''))) {
          setError('Please enter a valid 10-digit phone number');
          return false;
        }
        if (parseInt(primaryAge) < 1 || parseInt(primaryAge) > 120) {
          setError('Please enter a valid age');
          return false;
        }
        if (!emergencyContactName || !emergencyContactPhone) {
          setError('Please provide emergency contact details');
          return false;
        }
        if (!/^\d{10}$/.test(emergencyContactPhone.replace(/\D/g, ''))) {
          setError('Please enter a valid 10-digit emergency contact number');
          return false;
        }
        // Validate additional passengers
        for (let i = 0; i < passengers.length; i++) {
          const p = passengers[i];
          if (!p.name || !p.phone || !p.age || !p.gender) {
            setError(`Please fill in all details for passenger ${i + 1}`);
            return false;
          }
          if (!/^\d{10}$/.test(p.phone.replace(/\D/g, ''))) {
            setError(`Please enter a valid phone number for passenger ${i + 1}`);
            return false;
          }
          if (parseInt(p.age) < 1 || parseInt(p.age) > 120) {
            setError(`Please enter a valid age for passenger ${i + 1}`);
            return false;
          }
        }
        return true;
      case 2:
        // Aadhaar is optional, but if entered it must be a valid 12-digit number.
        if (aadhaarId && aadhaarId.replace(/\D/g, '').length !== 12) {
          setError('Please enter a valid 12-digit Aadhaar number');
          return false;
        }
        return true;
      case 3:
        if (!transactionId.trim()) {
          setError('Please enter your transaction ID');
          return false;
        }
        if (transactionId.trim().length < 5) {
          setError('Please enter a valid transaction ID');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isEarlyBirdActive = (): boolean => {
    if (!trip) return false;
    const earlyBird: any = (trip as any).early_bird_conditions;
    const earlyBirdPrice = (trip as any).early_bird_price;
    if (!earlyBird?.enabled || !earlyBirdPrice || earlyBirdPrice <= 0 || earlyBirdPrice >= trip.discounted_price) return false;
    const conditions = earlyBird.conditions || [];
    if (conditions.length === 0) return false;
    const now = new Date();
    for (const c of conditions) {
      if (c.type === 'date_range' && c.value) {
        const [start, end] = String(c.value).split('|');
        if (start && end && (now < new Date(start) || now > new Date(end))) return false;
      }
      if (c.type === 'first_bookings' && c.value) {
        if (((trip as any).current_participants || 0) >= parseInt(c.value)) return false;
      }
    }
    return true;
  };

  const getEffectivePrice = (): number => {
    if (!trip) return 0;
    const earlyBird: any = (trip as any).early_bird_conditions;
    const earlyBirdPrice = (trip as any).early_bird_price;
    if (!earlyBird?.enabled || !earlyBirdPrice || earlyBirdPrice <= 0) {
      return trip.discounted_price;
    }
    const conditions = earlyBird.conditions || [];
    if (conditions.length === 0) return trip.discounted_price;

    const now = new Date();
    const allMet = conditions.every((c: any) => {
      if (c.type === 'date_range' && c.value) {
        const [start, end] = String(c.value).split('|');
        if (!start || !end) return false;
        return now >= new Date(start) && now <= new Date(end);
      }
      if (c.type === 'first_bookings' && c.value) {
        return ((trip as any).current_participants || 0) < parseInt(c.value);
      }
      // user_limit & discount_code not enforced client-side
      return true;
    });
    return allMet ? earlyBirdPrice : trip.discounted_price;
  };

  const getBasePrice = () => {
    if (!trip) return 0;
    const totalPassengers = 1 + passengers.length;
    return getEffectivePrice() * totalPassengers;
  };

  const getAmountToPayBeforeWallet = () => {
    if (!trip) return 0;
    const totalPassengers = 1 + passengers.length;
    const fullPrice = getBasePrice();
    let finalFullPrice = fullPrice;
    if (couponApplied) {
      finalFullPrice = Math.max(0, fullPrice - couponApplied.discount_amount);
    }
    if (paymentMethod === 'seat_lock' && trip.seat_lock_price) {
      return Math.min(trip.seat_lock_price * totalPassengers, finalFullPrice);
    }
    return finalFullPrice;
  };

  const calculateTotalPrice = () => {
    let finalAmount = getAmountToPayBeforeWallet();
    if (useWallet && walletAmount > 0) {
      finalAmount = Math.max(0, finalAmount - walletAmount);
    }
    return finalAmount;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep) || !trip || !user) return;

    setSubmitting(true);
    setError('');

    try {
      const totalPassengers = 1 + passengers.length;
      const totalPrice = calculateTotalPrice();

      // Prepare passengers array
      const allPassengers = [
        {
          name: primaryName,
          email: primaryEmail,
          phone: primaryPhone.replace(/\D/g, ''),
          age: parseInt(primaryAge),
          gender: primaryGender,
          is_primary: true,
        },
        ...passengers.map(p => ({
          name: p.name,
          phone: p.phone.replace(/\D/g, ''),
          age: parseInt(p.age),
          gender: p.gender,
          is_primary: false,
        }))
      ];

      // Get base price and calculate final amount
      const basePrice = getBasePrice();
      const couponDiscount = couponApplied ? couponApplied.discount_amount : 0;
      
      // Calculate amount to pay before wallet
      const amountToPayNowBeforeWallet = getAmountToPayBeforeWallet();
      
      // Use wallet if selected
      let walletAmountUsed = 0;
      if (useWallet && walletAmount > 0) {
        try {
          const walletResponse = await fetch('/api/wallet/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: walletAmount,
              description: `Booking payment for ${trip.title}`,
            }),
          });
          
          if (walletResponse.ok) {
            const walletData = await walletResponse.json();
            walletAmountUsed = walletData.amountUsed;
            setWalletBalance(walletData.remainingBalance);
          } else {
            const errorData = await walletResponse.json();
            setError(errorData.error || 'Failed to use wallet balance');
            setSubmitting(false);
            return;
          }
        } catch (walletError: any) {
          console.error('Error using wallet:', walletError);
          setError('Failed to process wallet payment. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      // Calculate final amount after wallet
      const finalAmount = Math.max(0, amountToPayNowBeforeWallet - walletAmountUsed);

      // Create booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            trip_id: trip.id,
            user_id: user.id,
            number_of_participants: totalPassengers,
            total_price: basePrice, // Base price before coupon
            final_amount: finalAmount, // Final amount after coupon and wallet
            coupon_code: couponApplied?.coupon?.code || null,
            coupon_discount: couponDiscount,
            wallet_amount_used: walletAmountUsed,
            primary_passenger_name: primaryName,
            primary_passenger_email: primaryEmail,
            primary_passenger_phone: primaryPhone.replace(/\D/g, ''),
            primary_passenger_gender: primaryGender,
            primary_passenger_age: parseInt(primaryAge),
            emergency_contact_name: emergencyContactName,
            emergency_contact_phone: emergencyContactPhone.replace(/\D/g, ''),
            aadhaar_id: aadhaarId || null,
            passengers: allPassengers,
            payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
            payment_mode: 'manual',
            reference_id: transactionId.trim(),
            payment_amount: finalAmount,
            payment_status: 'pending',
            booking_status: 'pending',
            amount_paid: 0,
            departure_date: trip.is_recurring ? departureDate : null,
        pickup_point: pickupPoint || null,
          },
        ])
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create payment transaction for this booking
      if (bookingData.id && transactionId.trim()) {
        const { error: transactionError } = await supabase
          .from('payment_transactions')
          .insert([
            {
              booking_id: bookingData.id,
              transaction_id: transactionId.trim(),
              amount: finalAmount,
              payment_type: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
              payment_status: 'pending',
              payment_mode: 'manual', // Track payment mode
            },
          ]);

        if (transactionError) {
          console.error('Error creating payment transaction:', transactionError);
          // Don't fail the booking if transaction creation fails, but log it
        }
      }

      // If coupon was applied, record the usage
      if (couponApplied && bookingData.id) {
        // Fetch coupon ID
        const { data: couponData } = await supabase
          .from('coupon_codes')
          .select('id')
          .eq('code', couponApplied.coupon.code)
          .single();

        if (couponData) {
          // Record coupon usage
          await supabase
            .from('coupon_usages')
            .insert([
              {
                coupon_id: couponData.id,
                booking_id: bookingData.id,
                user_id: user.id,
                discount_amount: couponDiscount,
              },
            ]);

          // Increment used count
          await supabase.rpc('increment_coupon_usage', {
            coupon_id_param: couponData.id,
          });
        }
      }

      // Send booking received email
      try {
        await fetch('/api/bookings/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: bookingData.id,
            status: 'pending',
            userEmail: primaryEmail,
            userName: primaryName,
          }),
        });
      } catch (emailError) {
        console.error('Error sending booking notification email:', emailError);
        // Don't fail the booking if email fails
      }

      // Update trip participants count (but don't increment until payment is verified)
      // We'll do this when admin confirms payment

      clearDraft();
      router.push(`/booking-success/${bookingData.id}`);
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking. Please try again.');
      showToast(err?.message || 'Failed to create booking. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-3 border-purple-200 border-t-purple-600"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Trip not found</p>
          <Link href="/trips" className="text-purple-600 hover:underline">Back to Trips</Link>
        </div>
      </div>
    );
  }

  const totalPassengers = 1 + passengers.length;
  // If max_participants is null/0 → unlimited seats mode
  const unlimitedSeats = !trip.max_participants || trip.max_participants <= 0;
  const availableSpots = unlimitedSeats ? Infinity : trip.max_participants - trip.current_participants;
  const canBook = unlimitedSeats || availableSpots >= totalPassengers;

  // Polished progress bar (Passenger → ID → Payment)
  const StepIndicator = () => {
    const labels = ['Passenger Details', 'ID Verification', 'Payment'];
    return (
      <div className="flex items-center justify-center">
        {labels.map((label, i) => {
          const n = i + 1;
          const done = currentStep > n;
          const active = currentStep === n;
          return (
            <div key={n} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-300"
                  style={{
                    background: done ? '#10B981' : active ? 'linear-gradient(135deg,#7C3AED,#9333EA)' : '#E2E8F0',
                    color: done || active ? '#fff' : '#94a3b8',
                    boxShadow: active ? '0 4px 14px rgba(124,58,237,0.4)' : 'none',
                  }}
                >
                  {done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
                </div>
                <span
                  className="text-[10px] md:text-[11px] font-semibold hidden sm:block whitespace-nowrap"
                  style={{ color: done ? '#10B981' : active ? '#7C3AED' : '#94a3b8' }}
                >
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className="h-0.5 w-8 sm:w-14 md:w-20 mx-2 sm:mb-5 rounded-full transition-all duration-500"
                  style={{ background: done ? '#10B981' : '#E2E8F0' }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-24 md:pb-12" style={{ background: '#FAFAFC' }}>
      {/* Toast notifications — replaces native alert() */}
      {toast && (
        <div
          role="alert"
          className={`fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[100] rounded-xl shadow-2xl border-2 px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Payment overlay — professional loading when Razorpay is preparing or open */}
      {paymentOverlay !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-purple-200 p-8 max-w-sm mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4" />
            <p className="text-gray-800 font-semibold text-lg">
              {paymentOverlay === 'preparing' ? 'Preparing payment…' : 'Complete payment in the window'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {paymentOverlay === 'preparing' ? 'Do not close this page.' : 'You can close this overlay after paying.'}
            </p>
          </div>
        </div>
      )}

      {/* Seat-lock agreement modal */}
      {seatLockModal && (() => {
        const net = Math.max(0, getBasePrice() - (couponApplied ? couponApplied.discount_amount : 0));
        const lockNow = Math.min((trip?.seat_lock_price || 0) * totalPassengers, net);
        const remaining = Math.max(0, net - lockNow);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="seatlock-title">
            <div className="bg-white rounded-[20px] shadow-2xl max-w-sm w-full p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <h3 id="seatlock-title" className="text-lg font-bold text-[#0F172A] mb-2">Before you lock your seat</h3>
              <div className="text-sm text-[#64748B] space-y-2.5 mb-5">
                <p>You&apos;ll pay <strong className="text-[#0F172A]">₹{lockNow.toLocaleString('en-IN')}</strong> now to reserve your seat.</p>
                <p>The remaining <strong className="text-[#0F172A]">₹{remaining.toLocaleString('en-IN')}</strong> must be paid <strong>5 days before departure</strong>.</p>
                <p className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">•</span><span>The seat-lock amount is <strong className="text-[#0F172A]">non-refundable</strong>.</span></p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSeatLockModal(false)}
                  className="flex-1 py-3 rounded-[12px] text-sm font-semibold bg-white transition-colors hover:bg-gray-50" style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>
                  Cancel
                </button>
                <button type="button" onClick={() => { setPaymentMethod('seat_lock'); setSeatLockModal(false); }}
                  className="flex-1 py-3 rounded-[12px] text-sm font-bold text-white transition-all hover:opacity-95" style={{ background: PURPLE_GRAD }}>
                  I Agree
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pay in Person confirmation modal */}
      {showCashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cash-confirm-title">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-200 max-w-md w-full p-6 md:p-8">
            <h3 id="cash-confirm-title" className="text-xl font-bold text-gray-900 mb-2">Pay in Person</h3>
            <p className="text-gray-600 text-sm md:text-base mb-6">
              You will need to meet and pay the amount in person. Our team will contact you to collect payment and confirm your booking.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCashConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCashPaymentConfirm}
                className="flex-1 px-4 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky progress header — 3-column grid keeps the steps perfectly centred */}
      <div className="sticky top-16 md:top-20 z-30 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link href={`/trips/${params.id}`} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors">
            <X className="h-4 w-4" /><span className="hidden sm:inline">Cancel</span>
          </Link>
          <div className="flex justify-center min-w-0"><StepIndicator /></div>
          <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full whitespace-nowrap" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>Step {currentStep}/3</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {!(currentStep === 3 && showPaymentDetails) && (
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{['Passenger Details', 'ID Verification', 'Complete Payment'][currentStep - 1]}</h1>
            <p className="text-gray-500 mt-1.5 text-sm">{['Fill in traveller information for your trip', 'Verify your identity to proceed to payment', 'Choose your option and confirm your booking'][currentStep - 1]}</p>
          </div>
        )}

        {!canBook && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p className="font-semibold text-sm text-red-800">Not enough spots available</p>
            <p className="text-xs mt-1 text-red-600">Only {availableSpots} spot(s) available, but you&apos;re trying to book {totalPassengers}.</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl text-sm flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span className="break-words">{error}</span>
          </div>
        )}

        {/* Step 1: Passenger Details */}
        {currentStep === 1 && (
          <div className="max-w-[680px] mx-auto space-y-6">

            {/* Departure date — horizontal cards */}
            {trip?.is_recurring && typeof trip.recurrence_day === 'number' && (
              <section>
                <h2 className={BOOK_SECTION_TITLE}>Select Departure Date</h2>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4).map((d) => {
                    const selected = departureDate === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDepartureDate(d)}
                        className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-[12px] transition-all"
                        style={selected
                          ? { background: PURPLE_GRAD, color: '#fff', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }
                          : { background: '#fff', border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                      >
                        <span className="text-[10px] font-medium" style={{ opacity: 0.7 }}>{formatDeparture(d, { weekday: 'short' })}</span>
                        <span className="text-[13px] font-bold leading-none">{formatDeparture(d, { day: 'numeric', month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Pickup — searchable dropdown */}
            {trip?.pickup_points && trip.pickup_points.length > 0 && (
              <section>
                <h2 className={BOOK_SECTION_TITLE}>Pickup Location</h2>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPickupOpen(!pickupOpen)}
                    className="w-full h-11 px-4 flex items-center justify-between text-sm rounded-[14px] bg-white transition-all"
                    style={{ border: `1.5px solid ${pickupOpen ? '#7C3AED' : '#E2E8F0'}`, color: pickupPoint ? '#0F172A' : '#94a3b8', boxShadow: pickupOpen ? '0 0 0 3px rgba(124,58,237,0.1)' : 'none' }}
                  >
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#7C3AED]" />{pickupPoint || 'Select your pickup city'}</span>
                    {pickupOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                  </button>
                  {pickupOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white z-20 overflow-hidden rounded-[16px]" style={{ boxShadow: '0 16px 40px rgba(15,23,42,0.14)', border: '1px solid #E2E8F0' }}>
                      <div className="p-2 border-b border-[#f1f5f9]">
                        <input autoFocus value={pickupSearch} onChange={(e) => setPickupSearch(e.target.value)} placeholder="Search city..."
                          className="w-full px-3 py-2 text-sm rounded-xl outline-none bg-[#FAFAFC] text-[#0F172A]" style={{ border: '1px solid #E2E8F0' }} />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {trip.pickup_points.filter((c) => c.toLowerCase().includes(pickupSearch.toLowerCase())).map((city) => (
                          <button key={city} type="button" onClick={() => { setPickupPoint(city); setPickupOpen(false); setPickupSearch(''); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#f5f3ff] transition-colors text-left"
                            style={{ color: city === pickupPoint ? '#7C3AED' : '#0F172A' }}>
                            <MapPin className="w-3.5 h-3.5 text-[#94a3b8]" />{city}
                            {city === pickupPoint && <Check className="w-3.5 h-3.5 text-[#7C3AED] ml-auto" strokeWidth={3} />}
                          </button>
                        ))}
                        {trip.pickup_points.filter((c) => c.toLowerCase().includes(pickupSearch.toLowerCase())).length === 0 && (
                          <p className="px-4 py-3 text-sm text-[#64748B]">No cities found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Primary passenger card */}
            <section>
              <h2 className={BOOK_SECTION_TITLE}>Primary Passenger</h2>
              <div className="rounded-[20px] bg-white p-5 space-y-4 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}><User className="w-4 h-4 text-[#7C3AED]" /></div>
                  <span className="font-semibold text-[#0F172A]">Passenger 1 (Primary)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><BookField label="Full Name" value={primaryName} onChange={setPrimaryName} placeholder="Rahul Sharma" Icon={User} /></div>
                  <BookField label="Email Address" value={primaryEmail} onChange={setPrimaryEmail} placeholder="rahul@example.com" type="email" Icon={Mail} />
                  <BookField label="Mobile Number" value={primaryPhone} onChange={(v) => setPrimaryPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" Icon={Phone} maxLength={10} inputMode="numeric" />
                  <BookSelect label="Gender" value={primaryGender} onChange={setPrimaryGender}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </BookSelect>
                  <BookField label="Age" value={primaryAge} onChange={(v) => setPrimaryAge(v.replace(/\D/g, '').slice(0, 3))} placeholder="25" inputMode="numeric" />
                </div>
              </div>
            </section>

            {/* Emergency contact (required) */}
            <section>
              <h2 className={BOOK_SECTION_TITLE}>Emergency Contact</h2>
              <div className="rounded-[20px] bg-white p-5 space-y-4 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}><Phone className="w-4 h-4 text-[#7C3AED]" /></div>
                  <span className="font-semibold text-[#0F172A]">Emergency Contact</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BookField label="Contact Name" value={emergencyContactName} onChange={setEmergencyContactName} placeholder="Contact name" Icon={User} />
                  <BookField label="Contact Number" value={emergencyContactPhone} onChange={(v) => setEmergencyContactPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" Icon={Phone} maxLength={10} inputMode="numeric" />
                </div>
              </div>
            </section>

            {/* Additional passengers */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A] uppercase tracking-wide">Additional Passengers</h2>
                  <p className="text-xs text-[#64748B] mt-1">{totalPassengers} of {trip.max_participants && trip.max_participants > 0 ? trip.max_participants : 5} total</p>
                </div>
                {(!trip.max_participants || trip.max_participants <= 0 || totalPassengers < trip.max_participants) ? (
                  <button type="button" onClick={addPassenger}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#7C3AED] hover:bg-purple-50 transition-colors rounded-xl" style={{ border: '1.5px solid #7C3AED' }}>
                    <Plus className="w-4 h-4" /> Add Passenger
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-[#D97706] bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">Max reached</span>
                )}
              </div>

              {passengers.length === 0 ? (
                <div className="rounded-[16px] flex flex-col items-center py-8 gap-2" style={{ border: '2px dashed #E2E8F0', background: '#FAFAFC' }}>
                  <Users className="w-8 h-8 text-[#cbd5e1]" />
                  <p className="text-sm text-[#64748B]">No additional passengers added</p>
                  <p className="text-xs text-[#94a3b8]">You can add more travellers</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {passengers.map((passenger, index) => (
                    <div key={index} className="rounded-[20px] bg-white p-5 space-y-4 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}><User className="w-4 h-4 text-[#7C3AED]" /></div>
                          <span className="font-semibold text-[#0F172A]">Passenger {index + 2}</span>
                        </div>
                        <button type="button" onClick={() => removePassenger(index)} className="p-1.5 rounded-lg text-[#EF4444] hover:bg-red-50 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2"><BookField label="Full Name" value={passenger.name} onChange={(v) => updatePassenger(index, 'name', v)} placeholder="Full name" Icon={User} /></div>
                        <BookField label="Mobile Number" value={passenger.phone} onChange={(v) => updatePassenger(index, 'phone', v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" Icon={Phone} maxLength={10} inputMode="numeric" />
                        <BookSelect label="Gender" value={passenger.gender} onChange={(v) => updatePassenger(index, 'gender', v)}>
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </BookSelect>
                        <BookField label="Age" value={passenger.age} onChange={(v) => updatePassenger(index, 'age', v.replace(/\D/g, '').slice(0, 3))} placeholder="25" inputMode="numeric" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Continue */}
            <button type="button" onClick={nextStep} disabled={!canBook}
              className="w-full py-4 text-white font-bold text-base rounded-[12px] transition-all hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>
              Continue to ID Verification <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: ID Verification (centered) */}
        {currentStep === 2 && (
          <div className="max-w-[560px] mx-auto space-y-5">
            <div className="rounded-[20px] bg-white p-5 sm:p-6 space-y-4 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <Shield className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A]">Aadhaar Verification</h2>
                  <p className="text-sm text-[#64748B]">Enter your 12-digit Aadhaar number</p>
                </div>
              </div>
              <input
                type="text"
                value={aadhaarId}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setAadhaarId(val.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
                }}
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                inputMode="numeric"
                className="w-full h-12 px-4 text-lg font-mono tracking-[0.25em] rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#cbd5e1] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
              />
              <p className="text-xs text-[#64748B]">Your Aadhaar is kept confidential and used only for identity verification.</p>
            </div>

            <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px]" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">We follow strict privacy protocols and never share your information with third parties.</p>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={prevStep}
                className="flex-1 py-3.5 text-sm font-semibold rounded-[12px] flex items-center justify-center gap-1.5 transition-colors hover:bg-gray-50 bg-white"
                style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>
                <ArrowLeft className="w-4 h-4" />Back
              </button>
              <button type="button" onClick={nextStep}
                className="flex-[2] py-3.5 text-white font-bold text-sm rounded-[12px] flex items-center justify-center gap-2 transition-all hover:opacity-95"
                style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
                Continue to Payment <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 3 && !showPaymentDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:gap-8 lg:items-start">
            {/* A — options, wallet, coupon */}
            <div className="lg:col-start-1 lg:row-start-1 space-y-6">

            {/* Payment option */}
            <div>
              <h3 className={BOOK_SECTION_TITLE}>Payment Option</h3>
              {(() => {
                const fullPrice = getBasePrice();
                const seatLockPrice = trip.seat_lock_price ? trip.seat_lock_price * totalPassengers : 0;
                // Calculate discounted price - if coupon is applied, use final_amount; otherwise use fullPrice
                const discountedPrice = couponApplied ? Math.max(0, fullPrice - couponApplied.discount_amount) : fullPrice;
                const showSeatLock = trip.seat_lock_price && discountedPrice > seatLockPrice;

                if (showSeatLock) {
                  return (
                    <div className="space-y-3">
                      {/* Full payment */}
                      <button type="button" onClick={() => setPaymentMethod('full')}
                        className="w-full text-left p-5 transition-all relative rounded-[20px]"
                        style={paymentMethod === 'full'
                          ? { background: 'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(147,51,234,0.02))', border: '2px solid #7C3AED', boxShadow: '0 0 0 4px rgba(124,58,237,0.08),0 8px 24px rgba(124,58,237,0.15)' }
                          : { background: '#fff', border: '2px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
                        <span className="absolute -top-2.5 left-5 text-[11px] font-bold px-3 py-0.5 rounded-full text-white" style={{ background: PURPLE_GRAD }}>Recommended</span>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: paymentMethod === 'full' ? '#7C3AED' : '#cbd5e1', background: paymentMethod === 'full' ? '#7C3AED' : '#fff' }}>
                              {paymentMethod === 'full' && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <div>
                              <p className="font-semibold text-[#0F172A]">Full Payment</p>
                              <p className="text-sm text-[#64748B] mt-0.5">Pay the complete amount now and secure your seat.</p>
                              {couponApplied && <p className="text-xs text-[#10B981] mt-1 font-medium">✓ Coupon applied: save ₹{couponApplied.discount_amount.toLocaleString()}</p>}
                            </div>
                          </div>
                          <p className="text-xl font-bold flex-shrink-0" style={{ background: PURPLE_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹{discountedPrice.toLocaleString()}</p>
                        </div>
                      </button>

                      {!isEarlyBirdActive() ? (
                        <button type="button" onClick={() => { if (paymentMethod === 'seat_lock') setPaymentMethod('full'); else setSeatLockModal(true); }}
                          className="w-full text-left p-5 transition-all rounded-[20px]"
                          style={paymentMethod === 'seat_lock'
                            ? { background: 'rgba(124,58,237,0.03)', border: '2px solid #7C3AED', boxShadow: '0 0 0 4px rgba(124,58,237,0.08)' }
                            : { background: '#fff', border: '2px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center" style={{ borderColor: paymentMethod === 'seat_lock' ? '#7C3AED' : '#cbd5e1', background: paymentMethod === 'seat_lock' ? '#7C3AED' : '#fff' }}>
                                {paymentMethod === 'seat_lock' && <span className="w-2 h-2 rounded-full bg-white" />}
                              </span>
                              <div>
                                <p className="font-semibold text-[#0F172A]">Seat Lock <span className="text-sm font-normal text-[#64748B]">(Partial)</span></p>
                                <p className="text-sm text-[#64748B] mt-0.5">Pay ₹{seatLockPrice.toLocaleString()} now to reserve your seat.</p>
                              </div>
                            </div>
                            <p className="text-xl font-bold text-[#0F172A] flex-shrink-0">₹{seatLockPrice.toLocaleString()}</p>
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 rounded-[16px] flex items-start gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                          <span className="mt-0.5">✨</span>
                          <div>
                            <p className="text-sm font-semibold text-amber-900">Seat lock unavailable during early bird</p>
                            <p className="text-xs text-amber-800 mt-0.5">You're saving so much already — just pay the early bird amount in full.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // If discounted price < seat lock price, only show full payment
                  if (paymentMethod === 'seat_lock') {
                    // Auto-switch to full payment
                    setPaymentMethod('full');
                  }
                  return (
                    <div className="p-3 md:p-5 border-2 border-purple-200 rounded-xl bg-purple-50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2">
                        <span className="font-semibold text-gray-900 text-base md:text-lg">Full Payment</span>
                        <span className="text-lg md:text-xl font-bold text-purple-600">
                          ₹{discountedPrice.toLocaleString()}
                        </span>
                      </div>
                      {couponApplied && (
                        <p className="text-xs md:text-sm text-green-600 font-medium">✓ Coupon applied: Save ₹{couponApplied.discount_amount.toLocaleString()}</p>
                      )}
                      {trip.seat_lock_price && discountedPrice <= seatLockPrice && (
                        <p className="text-xs text-blue-600 mt-2 font-medium">ℹ️ Seat lock option unavailable as discounted amount (₹{discountedPrice.toLocaleString()}) is less than or equal to seat lock price (₹{seatLockPrice.toLocaleString()})</p>
                      )}
                    </div>
                  );
                }
              })()}
            </div>

            {/* Step 2: Wallet Usage Section */}
            {walletBalance > 0 && (
              <div className="mb-6 md:mb-8">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Use Wallet Balance</h3>
                <div className="p-4 md:p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                    <div>
                      <p className="text-xs md:text-sm text-gray-600 mb-1">Available Wallet Balance</p>
                      <p className="text-xl md:text-2xl font-bold text-green-600">₹{walletBalance.toLocaleString()}</p>
                    </div>
                    <label className="flex items-center space-x-2 md:space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => {
                          setUseWallet(e.target.checked);
                          if (e.target.checked) {
                            // Cap to the actual amount due AFTER coupon
                            const basePrice = getBasePrice();
                            const amountToPayNowBeforeWallet = getAmountToPayBeforeWallet();
                            const maxWalletUse = Math.min(walletBalance, amountToPayNowBeforeWallet);
                            setWalletAmount(maxWalletUse);
                          } else {
                            setWalletAmount(0);
                          }
                        }}
                        className="w-4 h-4 md:w-5 md:h-5 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="font-semibold text-sm md:text-base text-gray-900">Use Wallet</span>
                    </label>
                  </div>
                  {useWallet && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Amount to Use (Max: ₹{Math.min(walletBalance, calculateTotalPrice() + walletAmount).toLocaleString()})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={Math.min(walletBalance, calculateTotalPrice() + walletAmount)}
                        step="1"
                        value={walletAmount}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(
                            parseFloat(e.target.value) || 0,
                            Math.min(walletBalance, calculateTotalPrice() + walletAmount)
                          ));
                          setWalletAmount(value);
                        }}
                        className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        You can use up to ₹{Math.min(walletBalance, calculateTotalPrice() + walletAmount).toLocaleString()} from your wallet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Coupon — collapsible */}
            <div className="rounded-[20px] bg-white overflow-hidden border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
              <button type="button" onClick={() => setCouponOpen(!couponOpen)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#faf9ff] transition-colors">
                <div className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-sm font-semibold text-[#0F172A]">Have a coupon code?</span>
                  {couponApplied && <span className="text-xs font-bold text-[#10B981] bg-green-50 px-2 py-0.5 rounded-full">₹{couponApplied.discount_amount.toLocaleString()} off</span>}
                </div>
                {couponOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
              </button>
              {couponOpen && (
              <div className="px-5 pb-5 pt-4 border-t border-[#f1f5f9]">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError('');
                      if (couponApplied) {
                        setCouponApplied(null);
                      }
                    }}
                    placeholder="Enter coupon code"
                    className="flex-1 px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 md:focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-medium text-sm md:text-base"
                    disabled={applyingCoupon || !!couponApplied}
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="px-4 md:px-6 py-2 md:py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 text-sm md:text-base"
                    >
                      <X className="h-4 w-4 md:h-5 md:w-5" />
                      <span>Remove</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={applyingCoupon || !couponCode.trim()}
                      className="px-4 md:px-6 py-2 md:py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm md:text-base"
                    >
                      {applyingCoupon ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent"></div>
                          <span>Applying...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                          <span>Apply</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {couponError && (
                  <p className="mt-2 md:mt-3 text-xs md:text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 flex-shrink-0" />
                    <span>{couponError}</span>
                  </p>
                )}
                {couponApplied && (
                  <div className="mt-2 md:mt-3 p-2 md:p-3 bg-green-100 border-2 border-green-200 rounded-lg">
                    <p className="text-xs md:text-sm text-green-700 font-medium">
                      ✓ Coupon applied! You saved ₹{couponApplied.discount_amount.toLocaleString()}
                    </p>
                    {couponApplied.coupon.description && (
                      <p className="text-xs text-green-600 mt-1">{couponApplied.coupon.description}</p>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>

            </div>

            {/* B — Order summary: above the pay buttons on mobile, sticky sidebar on desktop */}
            <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-32">
              <div className="rounded-[20px] bg-white overflow-hidden" style={{ boxShadow: '0 8px 32px rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.14)' }}>
                <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(147,51,234,0.02))', borderBottom: '1px solid rgba(124,58,237,0.08)' }}>
                  <p className="text-sm font-bold text-[#0F172A]">Order Summary</p>
                </div>
                <div className="px-5 py-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#64748B]"><MapPin className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" /><span className="truncate">{trip.title}</span></div>
                    <div className="flex items-center gap-2 text-xs text-[#64748B]"><Users className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />{totalPassengers} {totalPassengers === 1 ? 'Traveller' : 'Travellers'}</div>
                  </div>
                  <div className="h-px bg-[#f1f5f9]" />
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-[#64748B]">Base Fare</span><span className="font-medium text-[#0F172A]">₹{getBasePrice().toLocaleString('en-IN')}</span></div>
                    {couponApplied && <div className="flex justify-between"><span className="text-[#10B981] flex items-center gap-1"><Tag className="w-3 h-3" />Discount</span><span className="font-semibold text-[#10B981]">−₹{couponApplied.discount_amount.toLocaleString('en-IN')}</span></div>}
                    {useWallet && walletAmount > 0 && <div className="flex justify-between"><span className="text-[#10B981]">Wallet Used</span><span className="font-semibold text-[#10B981]">−₹{walletAmount.toLocaleString('en-IN')}</span></div>}
                    {paymentMethod === 'seat_lock' && trip.seat_lock_price && <div className="flex justify-between"><span className="text-[#D97706]">Due Later</span><span className="font-medium text-[#D97706]">₹{Math.max(0, (getBasePrice() - (couponApplied ? couponApplied.discount_amount : 0)) - getAmountToPayBeforeWallet()).toLocaleString('en-IN')}</span></div>}
                  </div>
                  <div className="h-px bg-[#f1f5f9]" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-[#0F172A]">{paymentMethod === 'seat_lock' ? 'Paying Today' : 'Total Amount'}</span>
                    <span className="text-2xl font-bold" style={{ background: PURPLE_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹{calculateTotalPrice().toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] text-center">All taxes &amp; fees included · No hidden charges</p>
                </div>
              </div>
              <div className="mt-4 rounded-[20px] bg-white px-4 py-4 grid grid-cols-3 gap-2 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
                {[{ Icon: Lock, label: 'Secure' }, { Icon: Zap, label: 'Instant' }, { Icon: Headphones, label: '24/7 Help' }].map((t) => (
                  <div key={t.label} className="flex flex-col items-center text-center gap-1.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}><t.Icon className="w-4 h-4 text-[#7C3AED]" /></div>
                    <p className="text-[10px] font-semibold text-[#0F172A] leading-tight">{t.label}</p>
                  </div>
                ))}
              </div>
            </aside>

            {/* C — Pay buttons (bottom of the flow) */}
            <div className="lg:col-start-1 lg:row-start-2 space-y-3">
              <p className="text-sm font-medium text-gray-600 mb-1">Choose payment method</p>
              <div className="space-y-2 md:space-y-3">
                {/* Pay Now — primary: Razorpay or QR based on settings */}
                {paymentMode === 'manual' ? (
                  <button
                    type="button"
                    onClick={() => setShowPaymentDetails(true)}
                    disabled={paymentOverlay !== 'idle'}
                    className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="h-4 w-4 md:h-6 md:w-6" />
                    <span>Pay Now</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRazorpayPayment}
                    disabled={processingRazorpay || paymentOverlay !== 'idle'}
                    className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {calculateTotalPrice() < 1 ? (
                      <>
                        <CheckCircle className="h-4 w-4 md:h-6 md:w-6" />
                        <span>Confirm Booking (Fully Covered)</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 md:h-6 md:w-6" />
                        <span>Pay ₹{calculateTotalPrice().toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                )}

                {/* Pay in Person — offline/cash */}
                <button
                  type="button"
                  onClick={handleCashPayment}
                  disabled={submitting || paymentOverlay !== 'idle'}
                  className="w-full px-4 md:px-8 py-3 md:py-4 bg-white border-2 border-green-600 text-green-700 rounded-xl font-bold text-sm md:text-lg hover:bg-green-50 transition-all shadow-sm hover:shadow flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 md:h-6 md:w-6 border-2 border-green-600 border-t-transparent"></div>
                      <span>Creating booking…</span>
                    </>
                  ) : (
                    <>
                      <IndianRupee className="h-4 w-4 md:h-6 md:w-6" />
                      <span>Pay in Person</span>
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-3 md:mt-4 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-red-700 text-xs md:text-sm font-medium break-words">{error}</p>
                </div>
              )}
              <p className="text-[11px] text-[#94a3b8] text-center leading-relaxed pt-1.5">
                By booking, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] hover:underline">Terms &amp; Conditions</a>,{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] hover:underline">Privacy Policy</a>{' '}and{' '}
                <a href="/cancellation-policy" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] hover:underline">Refund Policy</a>, and confirm you have read them.
              </p>
            </div>
          </div>
        )}

        {/* Payment Details: QR Code and Transaction ID (Manual Mode Only) */}
        {currentStep === 3 && showPaymentDetails && paymentMode === 'manual' && (
          <div className="max-w-[520px] mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setShowPaymentDetails(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                <ArrowLeft className="h-4 w-4 text-[#64748B]" />
              </button>
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">Complete your payment</h2>
                <p className="text-xs text-[#64748B]">Pay via UPI, then enter the transaction ID</p>
              </div>
            </div>

            {/* Amount */}
            <div className="rounded-[16px] px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(147,51,234,0.02))', border: '1px solid rgba(124,58,237,0.14)' }}>
              <span className="text-sm font-medium text-[#64748B]">Amount to pay</span>
              <span className="text-xl font-bold" style={{ background: PURPLE_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₹{calculateTotalPrice().toLocaleString('en-IN')}</span>
            </div>

            {/* Pay directly via UPI app (mobile) */}
            <div className="rounded-[20px] bg-white p-5 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
              <UpiPayButton
                amount={calculateTotalPrice()}
                note={upiNote(paymentMethod === 'seat_lock' ? 'seat_lock' : 'full', trip?.title || 'Ghumakkars')}
                upiId={paymentSettings.upiId}
              />
            </div>

            {/* QR + UPI */}
            <div className="rounded-[20px] bg-white p-5 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
              {paymentSettings.qrUrl ? (
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold text-[#64748B] mb-3">Scan QR</p>
                  <div className="w-44 h-44 rounded-[14px] bg-white flex items-center justify-center overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <img src={paymentSettings.qrUrl} alt="Payment QR" className="w-full h-full object-contain p-1.5" />
                  </div>
                </div>
              ) : (
                <div className="w-44 h-44 mx-auto rounded-[14px] bg-[#FAFAFC] flex flex-col items-center justify-center gap-2" style={{ border: '1px dashed #E2E8F0' }}>
                  <QrCode className="h-8 w-8 text-[#cbd5e1]" />
                  <p className="text-xs text-[#94a3b8]">QR not configured</p>
                </div>
              )}

              {paymentSettings.upiId && (
                <>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-[#E2E8F0]" /><span className="text-xs text-[#94a3b8]">Pay on UPI ID</span><div className="flex-1 h-px bg-[#E2E8F0]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-[12px] px-3.5 py-2.5 bg-[#FAFAFC] min-w-0" style={{ border: '1px solid #E2E8F0' }}>
                      <p className="font-mono text-sm font-bold text-[#7C3AED] truncate text-center">{paymentSettings.upiId}</p>
                    </div>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(paymentSettings.upiId || ''); showToast('UPI ID copied!', 'success'); }}
                      className="flex-shrink-0 px-4 py-2.5 rounded-[12px] text-sm font-semibold text-white transition-all hover:opacity-95" style={{ background: PURPLE_GRAD }}>Copy</button>
                  </div>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-[14px]" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">Pay using the QR or UPI ID above. After paying, your UPI app shows a <strong>UTR / reference number</strong> — enter it below to confirm your booking.</p>
            </div>

            {/* UTR / Transaction reference */}
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">UTR / Transaction Reference No.</label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => { setTransactionId(e.target.value); setError(''); }}
                placeholder="e.g. 4012 3456 7890"
                inputMode="numeric"
                className="w-full h-11 px-4 text-sm font-mono rounded-[14px] bg-white border-[1.5px] border-[#E2E8F0] text-[#0F172A] placeholder-[#94a3b8] outline-none transition-all focus:border-[#7C3AED] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.1)]"
              />
              <p className="text-xs text-[#94a3b8] mt-1.5">The 12-digit UTR / UPI reference number — shown in your payment app and confirmation SMS.</p>
            </div>

            {error && (
              <div className="p-3 rounded-[12px] text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>{error}</div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !transactionId.trim()}
              className="w-full py-3.5 text-white font-bold text-sm rounded-[12px] flex items-center justify-center gap-2 transition-all hover:opacity-95 disabled:opacity-50"
              style={{ background: PURPLE_GRAD, boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}
            >
              {submitting ? (
                <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Submitting…</>
              ) : (
                <><Save className="h-4 w-4" />Submit Booking</>
              )}
            </button>
          </div>
        )}

        {/* Step 3 back link (steps 1 & 2 have their own buttons) */}
        {currentStep === 3 && !showPaymentDetails && (
          <button type="button" onClick={prevStep} className="mt-5 flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#7C3AED] transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to ID Verification
          </button>
        )}
      </div>
    </div>
  );
}

