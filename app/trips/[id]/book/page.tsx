'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, Plus, X, User, Mail, Phone, Calendar, Users, AlertCircle, CreditCard, QrCode, IndianRupee, Save, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, CheckCircle, Check, MapPin, Tag, Lock, Shield, Zap, Headphones, Info, Wallet, Copy } from 'lucide-react';
import { nextOccurrences, formatDeparture, batchEndDate } from '@/lib/recurrence';

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
        // College is optional, so no validation needed
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
                  className="h-0.5 w-10 sm:w-16 md:w-24 mx-1.5 md:mx-2 rounded-full transition-all duration-500"
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

      {/* Sticky progress header */}
      <div className="sticky top-16 md:top-20 z-30 backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href={`/trips/${params.id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-purple-600 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span>
          </Link>
          <StepIndicator />
          <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full flex-shrink-0" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>Step {currentStep}/3</span>
        </div>
      </div>

      {/* Trip pill */}
      <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.05),rgba(147,51,234,0.02))', borderBottom: '1px solid rgba(124,58,237,0.07)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 truncate">{trip.title}</span>
          {trip.destination && <><span className="text-gray-300">·</span><span className="text-sm text-gray-500 truncate">{trip.destination}</span></>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{['Passenger Details', 'ID Verification', 'Complete Payment'][currentStep - 1]}</h1>
          <p className="text-gray-500 mt-1.5 text-sm">{['Fill in traveller information for your trip', 'Verify your identity to proceed to payment', 'Choose your option and confirm your booking'][currentStep - 1]}</p>
        </div>

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
          <div className="max-w-[760px] rounded-[20px] bg-white p-5 sm:p-7 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>

            {/* Departure date picker — recurring trips only */}
            {trip?.is_recurring && typeof trip.recurrence_day === 'number' && (
              <div className="mb-8">
                <div className="flex items-center mb-3">
                  <Calendar className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Choose your departure date</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  This trip departs every {formatDeparture(nextOccurrences(trip.recurrence_day, 1)[0], { weekday: 'long' })}. Pick the date you want to travel.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4).map((d) => {
                    const selected = departureDate === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDepartureDate(d)}
                        className="px-4 py-3 rounded-[16px] text-left transition-all"
                        style={selected
                          ? { background: PURPLE_GRAD, color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }
                          : { background: '#fff', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
                      >
                        <p className="text-sm font-bold">
                          {formatDeparture(d, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.85)' : '#64748B' }}>
                          back {formatDeparture(batchEndDate(d, trip.duration_days), { day: 'numeric', month: 'short' })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pickup point dropdown */}
            {trip?.pickup_points && trip.pickup_points.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center mb-3">
                  <MapPin className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Choose your pickup point</h3>
                </div>
                <select
                  value={pickupPoint}
                  onChange={(e) => setPickupPoint(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                >
                  <option value="">Select a pickup point…</option>
                  {trip.pickup_points.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">You&rsquo;ll be picked up from here. Exact time is shared before departure.</p>
              </div>
            )}

            {/* Primary Passenger */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <User className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Primary Passenger</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={primaryName}
                      onChange={(e) => setPrimaryName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={primaryEmail}
                      onChange={(e) => setPrimaryEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      required
                      maxLength={10}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                      placeholder="10-digit number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={primaryGender}
                      onChange={(e) => setPrimaryGender(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={primaryAge}
                      onChange={(e) => setPrimaryAge(e.target.value)}
                      required
                      min="1"
                      max="120"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                      placeholder="Age"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center mb-4">
                    <AlertCircle className="h-5 w-5 text-purple-600 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900">Emergency Contact</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                        placeholder="Emergency contact name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contact Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        required
                        maxLength={10}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                        placeholder="10-digit number"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Passengers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-purple-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Additional Passengers</h3>
                </div>
                <button
                  type="button"
                  onClick={addPassenger}
                  disabled={!!trip.max_participants && trip.max_participants > 0 && totalPassengers >= trip.max_participants}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Passenger</span>
                </button>
              </div>

              {passengers.map((passenger, index) => (
                <div key={index} className="mb-4 p-4 border-2 border-purple-100 rounded-xl bg-purple-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Passenger {index + 2}</h4>
                    <button
                      type="button"
                      onClick={() => removePassenger(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={passenger.name}
                      onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                      placeholder="Full Name"
                      className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900"
                    />
                    <input
                      type="tel"
                      value={passenger.phone}
                      onChange={(e) => updatePassenger(index, 'phone', e.target.value)}
                      placeholder="Mobile Number"
                      maxLength={10}
                      className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900"
                    />
                    <select
                      value={passenger.gender}
                      onChange={(e) => updatePassenger(index, 'gender', e.target.value)}
                      className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                    <input
                      type="number"
                      value={passenger.age}
                      onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                      placeholder="Age"
                      min="1"
                      max="120"
                      className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 outline-none text-gray-900"
                    />
                  </div>
                </div>
              ))}

              {passengers.length === 0 && (
                <p className="text-sm text-gray-500 italic">No additional passengers. Click &quot;Add Passenger&quot; to add more.</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: College Info */}
        {currentStep === 2 && (
          <div className="max-w-[600px] rounded-[20px] bg-white p-5 sm:p-7 border border-[#E2E8F0]" style={BOOK_CARD_SHADOW}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)' }}>
                <Shield className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">Aadhaar Verification</h2>
                <p className="text-sm text-[#64748B]">Enter your 12-digit Aadhaar number</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={BOOK_LABEL}>
                  Aadhaar Card Number
                </label>
                <input
                  type="text"
                  value={aadhaarId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setAadhaarId(val.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
                  }}
                  placeholder="XXXX XXXX XXXX"
                  maxLength={14}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono tracking-wider"
                />
                <p className="text-xs text-[#64748B] mt-2">
                  Your Aadhaar is kept confidential and used only for identity verification.
                </p>
              </div>
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-[14px]" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">We follow strict privacy protocols and never share your information with third parties.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 3 && !showPaymentDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 items-start">
            <div className="space-y-6">

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
                      <label className="flex items-start p-3 md:p-5 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-all bg-white">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="full"
                          checked={paymentMethod === 'full'}
                          onChange={(e) => setPaymentMethod(e.target.value as 'full')}
                          className="mt-1 w-4 h-4 md:w-5 md:h-5 text-purple-600 flex-shrink-0"
                        />
                        <div className="ml-3 md:ml-4 flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-1">
                            <span className="font-semibold text-gray-900 text-base md:text-lg">Full Payment</span>
                            <span className="text-lg md:text-xl font-bold text-purple-600">
                              ₹{discountedPrice.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-gray-600">Pay the complete amount now and secure your spot</p>
                          {couponApplied && (
                            <p className="text-xs text-green-600 mt-1 font-medium">✓ Coupon applied: Save ₹{couponApplied.discount_amount.toLocaleString()}</p>
                          )}
                        </div>
                      </label>
                      {!isEarlyBirdActive() ? (
                        <label className="flex items-start p-3 md:p-5 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-purple-300 transition-all bg-white">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="seat_lock"
                            checked={paymentMethod === 'seat_lock'}
                            onChange={(e) => setPaymentMethod(e.target.value as 'seat_lock')}
                            className="mt-1 w-4 h-4 md:w-5 md:h-5 text-purple-600 flex-shrink-0"
                          />
                          <div className="ml-3 md:ml-4 flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-1">
                              <span className="font-semibold text-gray-900 text-sm md:text-lg">Seat Lock (Partial)</span>
                              <span className="text-lg md:text-xl font-bold text-purple-600">
                                ₹{seatLockPrice.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-600">Pay ₹{seatLockPrice.toLocaleString()} now to lock your seat</p>
                            <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ Remaining ₹{(discountedPrice - seatLockPrice).toLocaleString()} due 5 days before departure. Seat lock amount is non-refundable.</p>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 md:p-4 border-2 border-amber-200 rounded-xl bg-amber-50 flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">✨</span>
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

            {/* Step 3: Coupon Code Section */}
            <div className="mb-6 md:mb-8">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Apply Coupon Code (Optional)</h3>
              <div className="p-4 md:p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
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
            </div>

            {/* (Full price breakdown lives in the Order Summary sidebar.) */}

            {/* Payment methods: Pay Now (Razorpay or QR) + Pay in Person (Cash) */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 mb-2">Choose payment method</p>
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
            </div>
            </div>

            {/* Order summary sidebar */}
            <aside className="lg:sticky lg:top-32">
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
          </div>
        )}

        {/* Payment Details: QR Code and Transaction ID (Manual Mode Only) */}
        {currentStep === 3 && showPaymentDetails && paymentMode === 'manual' && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-4 md:p-8">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center min-w-0 flex-1">
                <QrCode className="h-5 w-5 md:h-6 md:w-6 text-purple-600 mr-2 md:mr-3 flex-shrink-0" />
                <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate">Complete Your Payment</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
              >
                <ArrowLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>
            </div>

            {/* Payment Summary */}
            <div className="mb-4 md:mb-6 p-3 md:p-5 bg-purple-50 rounded-xl border-2 border-purple-200">
              <div className="flex justify-between items-center gap-2">
                <span className="text-gray-600 font-medium text-sm md:text-base">Amount to Pay:</span>
                <span className="text-xl md:text-2xl font-bold text-purple-600">₹{calculateTotalPrice().toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="mb-4 md:mb-6 p-3 md:p-5 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2 md:mb-3 flex items-center text-sm md:text-base">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 mr-2 text-blue-600 flex-shrink-0" />
                Payment Instructions
              </h3>
              <ol className="space-y-1 md:space-y-2 text-xs md:text-sm text-gray-700 list-decimal list-inside">
                <li>Make payment using the QR code or UPI ID below</li>
                <li>After successful payment, you&apos;ll receive a transaction ID (Txn ID)</li>
                <li>Enter the transaction ID in the field below</li>
                <li>Click &quot;Submit Booking&quot; to complete your reservation</li>
              </ol>
            </div>

            {/* QR Code and UPI ID */}
            <div className="mb-4 md:mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="p-3 md:p-6 bg-gray-50 border-2 border-gray-200 rounded-xl text-center">
                <QrCode className="h-6 w-6 md:h-8 md:w-8 text-purple-600 mx-auto mb-2 md:mb-3" />
                <p className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3">Scan QR Code to Pay</p>
                {paymentSettings.qrUrl ? (
                  <div className="w-full h-48 md:h-64 bg-white rounded-lg flex items-center justify-center border-2 border-gray-300 overflow-hidden shadow-inner">
                    <img
                      src={paymentSettings.qrUrl}
                      alt="Payment QR Code"
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 md:h-64 bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-gray-200">
                    <QrCode className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mb-2" />
                    <p className="text-xs md:text-sm text-gray-500">QR Code not configured</p>
                  </div>
                )}
              </div>

              <div className="p-3 md:p-6 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <div className="flex items-center mb-3 md:mb-4">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 text-purple-600 mr-2 flex-shrink-0" />
                  <p className="font-semibold text-gray-700 text-sm md:text-base">UPI ID</p>
                </div>
                {paymentSettings.upiId ? (
                  <>
                    <div className="p-3 md:p-4 bg-white rounded-lg border-2 border-purple-200 mb-2 md:mb-3">
                      <p className="font-mono text-base md:text-xl font-bold text-purple-700 break-all text-center">
                        {paymentSettings.upiId}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(paymentSettings.upiId || '');
                        showToast('UPI ID copied to clipboard!', 'success');
                      }}
                      className="w-full px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg text-xs md:text-sm font-semibold hover:bg-purple-700 transition-colors"
                    >
                      Copy UPI ID
                    </button>
                  </>
                ) : (
                  <div className="p-3 md:p-4 bg-gray-100 rounded-lg border-2 border-gray-200">
                    <p className="text-xs md:text-sm text-gray-500 text-center">UPI ID not configured</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transaction ID Input */}
            <div className="mb-4 md:mb-6">
              <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3">
                Transaction ID (Txn ID) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => {
                  setTransactionId(e.target.value);
                  setError('');
                }}
                placeholder="Enter transaction ID from payment confirmation"
                className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 md:focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono text-sm md:text-lg"
                required
              />
              <p className="text-xs text-gray-500 mt-1 md:mt-2">
                You can find the Transaction ID in your payment confirmation SMS or receipt
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !transactionId.trim()}
              className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 md:h-6 md:w-6 border-2 border-white border-t-transparent"></div>
                  <span>Submitting Booking...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 md:h-6 md:w-6" />
                  <span>Submit Booking</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 md:mt-8 flex justify-between items-center gap-2">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`px-3 md:px-6 py-2 md:py-3 rounded-xl font-semibold flex items-center space-x-1 md:space-x-2 transition-all text-sm md:text-base ${
              currentStep === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          <div className="text-xs md:text-sm text-gray-600 flex-shrink-0">
            Step {currentStep} of {totalSteps}
          </div>

          {currentStep < totalSteps || (currentStep === 3 && !showPaymentDetails) ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canBook}
              className="px-3 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center space-x-1 md:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

