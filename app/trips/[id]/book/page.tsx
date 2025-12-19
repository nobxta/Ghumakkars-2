'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, X, User, Mail, Phone, Calendar, Users, AlertCircle, CreditCard, QrCode, IndianRupee, Save, ChevronRight, ChevronLeft, GraduationCap } from 'lucide-react';

interface Passenger {
  name: string;
  phone: string;
  age: string;
  gender: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  discounted_price: number;
  seat_lock_price?: number;
  max_participants: number;
  current_participants: number;
}

const MATHURA_COLLEGES = [
  'GLA University',
  'Sanskriti University',
  'GL Bajaj Group of Institutions',
  'Babu Shivnath Agrawal (PG) College',
  'Aligarh Muslim University',
  'Dayalbagh Educational Institute',
  'IIT Kanpur',
  'IIM Lucknow',
  'Banaras Hindu University',
  'MNNIT Allahabad',
  'IIT (BHU) Varanasi',
  'Other',
  'Skip'
];

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
  const [college, setCollege] = useState('');

  // Additional Passengers
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  // Payment
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'full' | 'seat_lock'>('full');
  const [paymentMode, setPaymentMode] = useState<'manual' | 'razorpay'>('manual');
  const [paymentSettings, setPaymentSettings] = useState<{ 
    qrUrl?: string; 
    upiId?: string; 
    paymentMode?: 'manual' | 'razorpay';
  }>({});
  const [processingRazorpay, setProcessingRazorpay] = useState(false);
  
  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState(0);

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
    if (profile) {
      // Pre-fill form with user profile data
      setPrimaryName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name || '');
      setPrimaryEmail(profile.email || user?.email || '');
      setPrimaryPhone(profile.phone || profile.phone_number || '');
      
      // Auto-fill gender if available
      if (profile.gender) {
        setPrimaryGender(profile.gender);
      }
      
      // Auto-fill age from date of birth
      if (profile.date_of_birth) {
        const age = calculateAge(profile.date_of_birth);
        if (age) {
          setPrimaryAge(age);
        }
      }
      
      // Auto-fill college name
      if (profile.college_name || profile.university) {
        const collegeName = profile.college_name || profile.university;
        // Check if it's in the dropdown list
        if (MATHURA_COLLEGES.includes(collegeName)) {
          setCollege(collegeName);
        } else if (collegeName && collegeName !== 'Not in College/University') {
          // If it's a custom college not in the list, set to "Other"
          setCollege('Other');
        } else if (collegeName === 'Not in College/University') {
          setCollege('Skip');
        }
      }
      
      // Auto-fill emergency contact
      if (profile.emergency_contact_name) {
        setEmergencyContactName(profile.emergency_contact_name);
      }
      if (profile.emergency_contact) {
        setEmergencyContactPhone(profile.emergency_contact);
      }
    } else if (user?.email) {
      setPrimaryEmail(user.email);
    }
  }, [profile, user]);

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
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, destination, discounted_price, seat_lock_price, max_participants, current_participants')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setTrip(data);
    } catch (error) {
      console.error('Error fetching trip:', error);
      router.push('/trips');
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('payment_qr_url, payment_upi_id, payment_mode')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching payment settings:', error);
      } else if (data) {
        const mode = (data.payment_mode || 'manual') as 'manual' | 'razorpay';
        setPaymentMode(mode);
        setPaymentSettings({
          qrUrl: data.payment_qr_url || undefined,
          upiId: data.payment_upi_id || undefined,
          paymentMode: mode,
        });
      }
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
      const totalAmount = calculateTotalPrice();
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
    setError('');

    try {
      // First create booking
      const totalPassengers = 1 + passengers.length;
      const basePrice = getBasePrice();
      let finalAmount = calculateTotalPrice();
      const couponDiscount = couponApplied ? couponApplied.discount_amount : 0;
      
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
            finalAmount = calculateTotalPrice(); // Recalculate after wallet usage
          } else {
            const errorData = await walletResponse.json();
            setError(errorData.error || 'Failed to use wallet balance');
            setProcessingRazorpay(false);
            return;
          }
        } catch (walletError: any) {
          console.error('Error using wallet:', walletError);
          setError('Failed to process wallet payment. Please try again.');
          setProcessingRazorpay(false);
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

      // Create booking first with pending status
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            trip_id: trip.id,
            user_id: user.id,
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
            college: college && college !== 'Skip' ? college : null,
            passengers: allPassengers,
            payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
            payment_mode: 'razorpay',
            payment_status: 'pending',
            booking_status: 'pending',
            amount_paid: 0,
          },
        ])
        .select()
        .single();

      if (bookingError) {
        console.error('Booking error:', bookingError);
        throw bookingError;
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
            try {
              // Verify payment
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

              // Send notification email
              await fetch('/api/bookings/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bookingId: bookingData.id,
                  status: 'confirmed',
                }),
              });

              alert('Payment successful! Your booking is confirmed.');
              router.push(`/bookings/${bookingData.id}`);
            } catch (error: any) {
              console.error('Payment verification error:', error);
              alert('Payment verification failed: ' + error.message);
              setProcessingRazorpay(false);
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
            ondismiss: function() {
              setProcessingRazorpay(false);
            }
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
        razorpay.on('payment.failed', function(response: any) {
          alert('Payment failed. Please try again.');
          setProcessingRazorpay(false);
        });
      };
      document.body.appendChild(script);
    } catch (error: any) {
      console.error('Razorpay payment error:', error);
      setError(error.message || 'Failed to initiate payment');
      setProcessingRazorpay(false);
    }
  };

  const handleCashPayment = async () => {
    if (!trip || !user) return;

    // Validate steps 1 and 2, but skip step 3 validation for cash (no transaction ID needed)
    if (currentStep === 1 && !validateStep(1)) return;
    if (currentStep === 2 && !validateStep(2)) return;
    // Step 3 validation is skipped for cash payments

    if (!confirm('Are you sure you want to pay cash? You will need to meet and pay the amount. Admin will contact you to collect payment and confirm your booking.')) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const totalPassengers = 1 + passengers.length;
      const basePrice = getBasePrice();
      const couponDiscount = couponApplied ? couponApplied.discount_amount : 0;
      
      // Calculate amount after coupon
      let amountAfterCoupon = basePrice - couponDiscount;
      if (couponApplied) {
        amountAfterCoupon = couponApplied.final_amount;
      }
      
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
      let finalAmount = Math.max(0, amountAfterCoupon - walletAmountUsed);

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

      // Create booking with cash payment
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            trip_id: trip.id,
            user_id: user.id,
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
            college: college && college !== 'Skip' ? college : null,
            passengers: allPassengers,
            payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
            payment_mode: 'cash',
            payment_status: 'cash_pending',
            booking_status: 'pending',
            amount_paid: 0,
            reference_id: null, // Cash payments don't have transaction ID initially
          },
        ])
        .select()
        .single();

      if (bookingError) {
        console.error('Booking error:', bookingError);
        throw bookingError;
      }

      // If coupon was applied, record the usage
      if (couponApplied && bookingData.id) {
        const { data: couponData } = await supabase
          .from('coupon_codes')
          .select('id')
          .eq('code', couponApplied.coupon.code)
          .single();

        if (couponData) {
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

          await supabase.rpc('increment_coupon_usage', {
            coupon_id: couponData.id,
          });
        }
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

      alert('Cash payment booking created! Admin will contact you to collect payment and confirm your booking.');
      router.push(`/bookings/${bookingData.id}`);
    } catch (error: any) {
      console.error('Error creating cash payment booking:', error);
      setError(error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', phone: '', age: '', gender: '' }]);
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

  const calculateTotalPrice = () => {
    if (!trip) return 0;
    const totalPassengers = 1 + passengers.length; // Primary + additional
    let basePrice = 0;
    if (paymentMethod === 'seat_lock' && trip.seat_lock_price) {
      basePrice = trip.seat_lock_price * totalPassengers;
    } else {
      basePrice = trip.discounted_price * totalPassengers;
    }
    
    // Apply coupon discount if any
    let finalAmount = basePrice;
    if (couponApplied) {
      finalAmount = couponApplied.final_amount;
    }
    
    // Apply wallet discount if using wallet
    if (useWallet && walletAmount > 0) {
      finalAmount = Math.max(0, finalAmount - walletAmount);
    }
    
    return finalAmount;
  };

  const getBasePrice = () => {
    if (!trip) return 0;
    const totalPassengers = 1 + passengers.length;
    if (paymentMethod === 'seat_lock' && trip.seat_lock_price) {
      return trip.seat_lock_price * totalPassengers;
    }
    return trip.discounted_price * totalPassengers;
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
      
      // Calculate amount after coupon
      let amountAfterCoupon = basePrice - couponDiscount;
      if (couponApplied) {
        amountAfterCoupon = couponApplied.final_amount;
      }
      
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
      const finalAmount = Math.max(0, amountAfterCoupon - walletAmountUsed);

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
            college: college && college !== 'Skip' ? college : null,
            passengers: allPassengers,
            payment_method: paymentMethod === 'seat_lock' ? 'seat_lock' : 'full',
            payment_mode: 'manual',
            reference_id: transactionId.trim(),
            payment_amount: finalAmount,
            payment_status: 'pending',
            booking_status: 'pending',
            amount_paid: 0,
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

      router.push(`/bookings?success=true&booking_id=${bookingData.id}`);
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to create booking. Please try again.');
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
  const availableSpots = trip.max_participants - trip.current_participants;
  const canBook = availableSpots >= totalPassengers;

  // Step Indicator
  const StepIndicator = () => (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center justify-between">
        {[
          { num: 1, label: 'Passenger Details' },
          { num: 2, label: 'College Info' },
          { num: 3, label: 'Payment' },
        ].map((step, index) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          const isLast = index === 2;

          return (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold transition-all text-sm md:text-base ${
                    isActive
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-110'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.num}
                </div>
                <span className={`mt-1 md:mt-2 text-xs font-medium hidden sm:block ${isActive ? 'text-purple-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={`h-1 flex-1 mx-1 md:mx-2 transition-all ${isCompleted ? 'bg-green-500' : currentStep > step.num ? 'bg-purple-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-16 md:pt-20 bg-gradient-to-br from-purple-50/30 via-white to-purple-50/30 pb-16 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Link
          href={`/trips/${params.id}`}
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 md:mb-6 text-xs md:text-sm font-medium transition-colors group"
        >
          <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Trip Details</span>
        </Link>

        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 md:mb-2">Book Your Trip</h1>
          <p className="text-sm md:text-base text-gray-600 break-words">{trip.title}</p>
        </div>

        {!canBook && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
            <p className="font-medium text-sm md:text-base">Not enough spots available</p>
            <p className="text-xs md:text-sm mt-1">Only {availableSpots} spot(s) available, but you&apos;re trying to book {totalPassengers}.</p>
          </div>
        )}

        <StepIndicator />

        {error && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-xs md:text-sm break-words">
            {error}
          </div>
        )}

        {/* Step 1: Passenger Details */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Passenger Details</h2>

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
                  disabled={totalPassengers >= trip.max_participants}
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
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-6 md:p-8">
            <div className="flex items-center mb-6">
              <GraduationCap className="h-6 w-6 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">College Information (Optional)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Your College
                </label>
                <select
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                >
                  <option value="">Select College (Optional)</option>
                  {MATHURA_COLLEGES.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  Selecting your college helps us provide better student discounts and organize group bookings
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 3 && !showPaymentDetails && (
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-4 md:p-8">
            <div className="flex items-center mb-4 md:mb-6">
              <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-purple-600 mr-2 md:mr-3" />
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Complete Payment</h2>
            </div>

            {/* Step 1: Payment Method Selection */}
            <div className="mb-6 md:mb-8">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Choose Payment Option</h3>
              {(() => {
                const fullPrice = trip.discounted_price * totalPassengers;
                const seatLockPrice = trip.seat_lock_price ? trip.seat_lock_price * totalPassengers : 0;
                // Calculate discounted price - if coupon is applied, use final_amount; otherwise use fullPrice
                const basePriceForCoupon = fullPrice;
                const discountedPrice = couponApplied ? couponApplied.final_amount : fullPrice;
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
                          <p className="text-xs text-orange-600 mt-1 font-medium">⚠️ Note: Remaining ₹{(discountedPrice - seatLockPrice).toLocaleString()} must be paid before 5 days of departure. Seat lock amount is non-refundable.</p>
                        </div>
                      </label>
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
                            const totalPrice = calculateTotalPrice();
                            const maxWalletUse = Math.min(walletBalance, totalPrice);
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

            {/* Step 4: Final Summary */}
            <div className="mb-4 md:mb-6 p-4 md:p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
              <h3 className="font-semibold text-gray-900 mb-3 md:mb-4 text-base md:text-lg">Payment Summary</h3>
              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-600">Base Amount ({totalPassengers} {totalPassengers === 1 ? 'person' : 'people'}):</span>
                  <span className="font-medium text-gray-900">₹{getBasePrice().toLocaleString()}</span>
                </div>
                {couponApplied && (
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-green-600">Coupon Discount ({couponApplied.coupon.code}):</span>
                    <span className="font-medium text-green-600">-₹{couponApplied.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                {useWallet && walletAmount > 0 && (
                  <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-green-600">Wallet Balance Used:</span>
                    <span className="font-medium text-green-600">-₹{walletAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 md:pt-3 border-t-2 border-purple-300 flex justify-between items-center gap-2">
                  <span className="text-base md:text-lg font-bold text-gray-900">Amount to Pay:</span>
                  <span className="text-xl md:text-2xl font-bold text-purple-600">₹{calculateTotalPrice().toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payment Buttons Based on Mode */}
            <div className="space-y-2 md:space-y-3">
              {paymentMode === 'manual' ? (
                <button
                  type="button"
                  onClick={() => setShowPaymentDetails(true)}
                  className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                >
                  <QrCode className="h-4 w-4 md:h-6 md:w-6" />
                  <span>Pay via UPI / QR Code</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={processingRazorpay}
                  className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {processingRazorpay ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 md:h-6 md:w-6 border-2 border-white border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 md:h-6 md:w-6" />
                      <span>Pay with Razorpay</span>
                    </>
                  )}
                </button>
              )}
              
              {/* Pay Cash Button - Always visible */}
              <button
                type="button"
                onClick={handleCashPayment}
                disabled={submitting || processingRazorpay}
                className="w-full px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold text-sm md:text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 md:h-6 md:w-6 border-2 border-white border-t-transparent"></div>
                    <span>Creating Booking...</span>
                  </>
                ) : (
                  <>
                    <IndianRupee className="h-4 w-4 md:h-6 md:w-6" />
                    <span>Pay Cash (Meet & Pay)</span>
                  </>
                )}
              </button>
              {error && (
                <div className="mt-3 md:mt-4 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-red-700 text-xs md:text-sm font-medium break-words">{error}</p>
                </div>
              )}
            </div>
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
                        alert('UPI ID copied to clipboard!');
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

