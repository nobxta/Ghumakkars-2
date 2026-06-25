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
import { resolveDueDate } from '@/lib/payment-due';
import { derivePaymentStatus } from '@/lib/booking-money';
import { customerBookingStatus, paymentStatusLabel, paymentStatusChip } from '@/lib/booking-status-labels';

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  duration_text?: string;
  is_recurring?: boolean;
  discounted_price?: number;
  seat_lock_price?: number;
  payment_due_days_before?: number | null;
  included_features?: string[];
  excluded_features?: string[];
  image_url?: string;
  cover_image_url?: string;
  gallery_images?: string[];
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
  departure_date?: string;
  trips?: Trip;
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<{ qrUrl?: string; upiId?: string; dueDaysBefore?: number }>({});
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; message?: string } | null>(null);

  useEffect(() => {
    checkUser();
    fetchBooking();
    fetchPaymentSettings();
  }, [params.id]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

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
      // Explicit column list — NEVER select internal_notes / referral_* so admin-only
      // data is not exposed to the customer, even in the raw network response.
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, user_id, booking_status, payment_status, payment_method, payment_mode,
          transaction_id, reference_id, payment_amount, amount_paid, total_price, final_amount,
          coupon_code, coupon_discount, wallet_amount_used, number_of_participants,
          primary_passenger_name, primary_passenger_email, primary_passenger_phone,
          primary_passenger_gender, primary_passenger_age, emergency_contact_name,
          emergency_contact_phone, aadhaar_id, passengers, created_at, rejection_reason,
          departure_date, pickup_point, is_offline_booking,
          trips (
            id,
            title,
            destination,
            start_date,
            end_date,
            duration_days,
            duration_text,
            is_recurring,
            discounted_price,
            seat_lock_price,
            payment_due_days_before,
            included_features,
            excluded_features,
            image_url,
            cover_image_url,
            gallery_images,
            whatsapp_group_link,
            highlights
          ),
          payment_transactions ( id, amount, amount_refunded, payment_status, payment_mode, payment_type, created_at )
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

      setBooking(data as unknown as Booking);
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
    // Full trip cost after the customer's coupon + wallet discounts. (For
    // seat-lock bookings final_amount only holds the deposit, so we must use
    // list price x pax here.)
    const coupon = parseFloat(String(booking.coupon_discount || 0)) || 0;
    const wallet = parseFloat(String(booking.wallet_amount_used || 0)) || 0;
    const fullPrice = Math.max(0, (booking.trips.discounted_price || 0) * (booking.number_of_participants || 1) - coupon - wallet);
    // Paid = verified transactions (source of truth, includes admin-recorded
    // cash), falling back to payment_amount / final_amount.
    const txns: any[] = Array.isArray((booking as any).payment_transactions) ? (booking as any).payment_transactions : [];
    const verifiedPaid = txns.filter((t) => t.payment_status === 'verified').reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
    const paidAmount = verifiedPaid || parseFloat(String(booking.payment_amount || booking.final_amount || 0));
    return Math.max(0, Math.round(fullPrice - paidAmount));
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

      // Show success toast (seat is locked; full payment now awaiting confirmation)
      setToast({
        type: 'success',
        title: 'Payment submitted — seat locked',
        message: "We've got your full payment details. Your seat stays locked while our team confirms it, usually within a few hours.",
      });

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
  // Is a payment already submitted and waiting for verification?
  const hasPendingTxn = Array.isArray((booking as any).payment_transactions)
    && (booking as any).payment_transactions.some((t: any) => t.payment_status === 'pending');
  // Only invite a remaining payment once the seat lock is APPROVED (status
  // seat_locked) and nothing is currently pending verification — otherwise a
  // customer who just paid the deposit would be wrongly asked to pay again.
  const showRemainingPayment = booking.booking_status === 'seat_locked'
    && booking.payment_method === 'seat_lock'
    && remainingAmount > 0
    && !hasPendingTxn;

  // ─────────── derived display values ───────────
  const trip = booking.trips;
  // Customer-facing status: a "referred" booking reads as a normal Confirmed booking;
  // partner/commission/internal data is never sent to or shown to the customer.
  const status = customerBookingStatus(booking.booking_status);
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const coverImage = trip?.cover_image_url || trip?.image_url || (trip?.gallery_images?.[0]) || '';
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtDateShort = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  // For recurring trips, the real travel dates come from the booking's chosen
  // departure_date + the trip's duration, not the (null) trip start/end.
  const computeEnd = (start: string, days?: number) => {
    const [y, m, d] = start.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Math.max(0, (days || 1) - 1));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const effectiveStart: string | undefined = (trip?.is_recurring && (booking as any).departure_date)
    ? (booking as any).departure_date
    : trip?.start_date;
  const effectiveEnd: string | undefined = (trip?.is_recurring && (booking as any).departure_date)
    ? computeEnd((booking as any).departure_date, trip?.duration_days)
    : trip?.end_date;

  // ── Trip phase (date-only, so "today" is correct regardless of time) ──
  const dayMs = 86400000;
  const midnight = (v?: string) => { if (!v) return null; const d = new Date(v); if (Number.isNaN(d.getTime())) return null; d.setHours(0, 0, 0, 0); return d; };
  const todayMid = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const startMid = midnight(effectiveStart);
  const endMid = midnight(effectiveEnd) || startMid;
  const daysToStart = startMid ? Math.round((startMid.getTime() - todayMid.getTime()) / dayMs) : null;
  const totalDays = (startMid && endMid) ? Math.round((endMid.getTime() - startMid.getTime()) / dayMs) + 1 : (trip?.duration_days || 1);
  const dayOfTrip = startMid ? Math.round((todayMid.getTime() - startMid.getTime()) / dayMs) + 1 : 0;

  type TripPhase = 'upcoming' | 'today' | 'ongoing' | 'lastday' | 'ended' | 'unknown';
  const tripPhase: TripPhase = (() => {
    if (!startMid) return 'unknown';
    if (endMid && todayMid.getTime() > endMid.getTime()) return 'ended';
    if (todayMid.getTime() < startMid.getTime()) return 'upcoming';
    // today is within [start, end]
    if (endMid && todayMid.getTime() === endMid.getTime()) return 'lastday';
    if (todayMid.getTime() === startMid.getTime()) return 'today';
    return 'ongoing';
  })();

  const isUpcoming = tripPhase === 'upcoming';
  const isStartingSoon = isUpcoming && (daysToStart != null && daysToStart <= 7);
  const isPast = tripPhase === 'ended';
  const isLive = tripPhase === 'today' || tripPhase === 'ongoing' || tripPhase === 'lastday';

  // Headline shown in the hero badge for each phase.
  const phaseBadge: { kicker: string; big: string } = (() => {
    const dayN = Math.min(Math.max(dayOfTrip, 1), totalDays);
    switch (tripPhase) {
      case 'upcoming':
        return { kicker: 'Starting Soon', big: daysToStart === 1 ? 'Tomorrow' : `${daysToStart} days left` };
      case 'today':
        return { kicker: 'On Trip', big: `Day 1 of ${totalDays} 🎉` };
      case 'ongoing':
        return { kicker: 'On Trip', big: `Day ${dayN} of ${totalDays}` };
      case 'lastday':
        return { kicker: 'On Trip', big: 'Final day 👋' };
      case 'ended':
        return { kicker: '', big: 'Completed ✓' };
      default:
        return { kicker: '', big: '' };
    }
  })();

  // Filter primary out of the passengers array — many old bookings stored
  // the primary as the first passenger entry too, causing the duplicate.
  const primaryDigits = String(booking.primary_passenger_phone || '').replace(/\D/g, '');
  const primaryName = (booking.primary_passenger_name || '').trim().toLowerCase();
  const additionalPassengers: any[] = Array.isArray(booking.passengers)
    ? booking.passengers.filter((p: any) => {
        if (!p) return false;
        if (p.is_primary === true) return false;
        const pName = String(p.name || '').trim().toLowerCase();
        // Dedup by NAME only — family members often share one phone number
        return !(pName && primaryName && pName === primaryName);
      })
    : [];

  const pax = Number(booking.number_of_participants) || 1;
  const couponDiscount = parseFloat(String(booking.coupon_discount || 0)) || 0;
  const walletUsed = parseFloat(String(booking.wallet_amount_used || 0)) || 0;
  // Seat-lock bookings store only the DEPOSIT in total_price / final_amount, so
  // the real trip price must come from list price × travellers.
  const isSeatLockBooking = booking.payment_method === 'seat_lock' || ['seat_locked', 'remaining_submitted'].includes(status);
  const grossFull = (trip?.discounted_price || 0) * pax;
  // "Trip price" = list total before coupon/wallet.
  const totalAmount = isSeatLockBooking
    ? grossFull
    : (parseFloat(String(booking.total_price || 0)) || grossFull);
  // Net amount actually owed after coupon + wallet.
  const finalAmount = Math.max(0, totalAmount - couponDiscount - walletUsed);
  // Money actually received = verified transactions (source of truth), else payment_amount.
  const txns: any[] = Array.isArray((booking as any).payment_transactions) ? (booking as any).payment_transactions : [];
  const verifiedPaid = txns.filter((t) => t.payment_status === 'verified').reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
  const paidAmount = verifiedPaid || parseFloat(String(booking.payment_amount || (booking as any).amount_paid || 0));
  // Amount the customer has submitted that we haven't verified yet.
  const submittedPending = txns.filter((t) => t.payment_status === 'pending').reduce((s, t) => s + parseFloat(String(t.amount || 0)), 0);
  // Payment Status is derived from money and is INDEPENDENT of booking status — a
  // confirmed booking can still be Partial with a balance to collect offline.
  const refundedTotal = txns.reduce((s, t) => s + parseFloat(String(t.amount_refunded || 0)), 0);
  const custPaymentStatus = derivePaymentStatus(paidAmount, finalAmount, refundedTotal > 0);
  const offlineRemaining = Math.max(0, finalAmount - paidAmount);
  const showOfflineBalance = offlineRemaining > 0 && !['cancelled', 'rejected'].includes(status) && !hasPendingTxn;

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
      case 'remaining_submitted': return { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Seat locked · confirming payment', icon: <Clock className="h-3.5 w-3.5" /> };
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
    { key: 'soon', label: isPast ? 'Trip started' : isLive ? 'Trip in progress' : isStartingSoon ? 'Trip starting soon' : 'Trip starts', done: isPast || isLive, active: isLive || isStartingSoon },
    { key: 'done', label: 'Trip completed', done: isPast, active: isPast },
  ];

  const whatsappLink = trip?.whatsapp_group_link;
  const supportWhatsapp = 'https://wa.me/918218020972';
  const supportPhone = 'tel:+918218020972';

  const copyBookingId = () => {
    navigator.clipboard?.writeText(booking.id);
  };

  /** Download the official ticket PDF — the exact same file sent on WhatsApp. */
  const handleDownloadTicket = async () => {
    try {
      const res = await fetch(`/api/bookings/${booking.id}/ticket`, { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ghumakkars-Ticket-${shortId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ type: 'error', title: 'Could not download ticket', message: 'Please try again in a moment.' });
    }
  };

  /** Open a dedicated clean print window with just the ticket info. */
  const handlePrintTicket = () => {
    const w = window.open('', '_blank', 'width=820,height=1100');
    if (!w) return;
    const allPassengers = [
      { name: booking.primary_passenger_name, age: booking.primary_passenger_age, gender: booking.primary_passenger_gender, phone: booking.primary_passenger_phone, isPrimary: true },
      ...additionalPassengers.map((p: any) => ({ ...p, isPrimary: false })),
    ];
    const passengerRows = allPassengers.map((p: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name || '—'}${p.isPrimary ? ' <span style="background:#ede9fe;color:#6d28d9;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:600;">PRIMARY</span>' : ''}</td>
        <td>${p.age || '—'}</td>
        <td style="text-transform:capitalize;">${p.gender || '—'}</td>
        <td>${p.phone || '—'}</td>
      </tr>`).join('');
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Trip Ticket · ${trip?.title || ''} · ${shortId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #fff; padding: 40px; line-height: 1.5; }
  .ticket { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
  .header { background: #7c3aed; color: #fff; padding: 24px 28px; }
  .brand { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8; margin-bottom: 4px; }
  .ref { font-family: 'Courier New', monospace; font-size: 12px; opacity: 0.9; margin-top: 8px; }
  h1 { font-size: 24px; font-weight: 700; }
  .body { padding: 28px; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; }
  .col { flex: 1; min-width: 180px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
  .value { font-size: 15px; font-weight: 600; color: #0f172a; }
  .section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-weight: 700; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
  th { background: #f9fafb; color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .pay-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .pay-row.total { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 6px; font-size: 16px; font-weight: 700; }
  .stamp { display: inline-block; padding: 4px 10px; border: 2px solid #16a34a; color: #15803d; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 4px; transform: rotate(-4deg); }
  .footer { padding: 16px 28px; background: #f9fafb; font-size: 11px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
  .important { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 14px; margin-top: 16px; font-size: 12px; color: #9a3412; }
  @page { margin: 12mm; size: A4; }
  @media print { body { padding: 0; } .ticket { border: none; box-shadow: none; } }
</style>
</head><body>
<div class="ticket">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p class="brand">Ghumakkars · Trip Ticket</p>
        <h1>${trip?.title || 'Trip'}</h1>
        <p style="margin-top:4px;font-size:13px;opacity:0.9;">${trip?.destination || ''}</p>
        <p class="ref">REF #${shortId}</p>
      </div>
      ${status === 'confirmed' ? '<div class="stamp">Confirmed</div>' : status === 'seat_locked' ? '<div class="stamp" style="border-color:#ea580c;color:#c2410c;">Seat Locked</div>' : ''}
    </div>
  </div>
  <div class="body">
    <div class="row">
      <div class="col"><p class="label">Departure</p><p class="value">${fmtDate(effectiveStart)}</p></div>
      <div class="col"><p class="label">Return</p><p class="value">${fmtDate(effectiveEnd)}</p></div>
      <div class="col"><p class="label">Duration</p><p class="value">${trip?.duration_text || (trip?.duration_days ? `${trip.duration_days} days` : '—')}</p></div>
      <div class="col"><p class="label">Travellers</p><p class="value">${booking.number_of_participants}</p></div>
    </div>
    ${(booking as any).pickup_point ? `<div class="row"><div class="col"><p class="label">Pickup point</p><p class="value">${(booking as any).pickup_point}</p></div></div>` : ''}

    <div class="section">
      <h2>Travellers</h2>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th></tr></thead>
        <tbody>${passengerRows}</tbody>
      </table>
    </div>

    ${(booking.emergency_contact_name || booking.emergency_contact_phone) ? `
    <div class="section">
      <h2>Emergency Contact</h2>
      <div class="row" style="margin:0;">
        <div class="col"><p class="label">Name</p><p class="value">${booking.emergency_contact_name || '—'}</p></div>
        <div class="col"><p class="label">Phone</p><p class="value">${booking.emergency_contact_phone || '—'}</p></div>
      </div>
    </div>` : ''}

    <div class="section">
      <h2>Payment</h2>
      <div class="pay-row"><span>Trip price</span><span>₹${totalAmount.toLocaleString('en-IN')}</span></div>
      ${couponDiscount > 0 ? `<div class="pay-row" style="color:#15803d;"><span>Coupon (${booking.coupon_code || ''})</span><span>−₹${couponDiscount.toLocaleString('en-IN')}</span></div>` : ''}
      ${walletUsed > 0 ? `<div class="pay-row" style="color:#6d28d9;"><span>Wallet used</span><span>−₹${walletUsed.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="pay-row total"><span>Amount paid</span><span>₹${Math.max(paidAmount, finalAmount - remainingAmount).toLocaleString('en-IN')}</span></div>
      ${remainingAmount > 0 ? `<div class="pay-row" style="color:#c2410c;font-weight:700;"><span>Pending balance</span><span>₹${remainingAmount.toLocaleString('en-IN')}</span></div>` : ''}
      ${(booking.reference_id || booking.transaction_id) ? `<p style="margin-top:10px;font-size:11px;color:#6b7280;">Txn ID: <span style="font-family:'Courier New',monospace;color:#0f172a;">${booking.reference_id || booking.transaction_id}</span></p>` : ''}
    </div>

    <div class="important">
      <strong>Please carry:</strong> a printout or digital copy of this ticket + a valid government photo ID (Aadhaar / Driving Licence / Passport). Reach the pickup point 30 minutes before departure.
    </div>
  </div>
  <div class="footer">
    Booked on ${new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Support: support@ghumakkars.in · +91 82180 20972
  </div>
</div>
<script>setTimeout(() => { window.print(); }, 300);</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-32 lg:pb-12">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 w-[calc(100%-2rem)] sm:w-96 animate-toast-in">
          <div className={`rounded-2xl shadow-2xl border overflow-hidden bg-white ${
            toast.type === 'success' ? 'border-green-200' : toast.type === 'error' ? 'border-red-200' : 'border-blue-200'
          }`}>
            <div className={`h-1 ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
            <div className="p-4 flex items-start gap-3">
              <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                toast.type === 'success' ? 'bg-green-100 text-green-600' : toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : toast.type === 'error' ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{toast.title}</p>
                {toast.message && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>}
              </div>
              <button onClick={() => setToast(null)} className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
              {phaseBadge.big && (
                <div className="hidden sm:block bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2.5 text-center">
                  {phaseBadge.kicker && <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{phaseBadge.kicker}</p>}
                  <p className="text-2xl font-extrabold mt-0.5">{phaseBadge.big}</p>
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
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-white/70" />{fmtDateShort(effectiveStart)} to {fmtDateShort(effectiveEnd)}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-white/70" />{booking.number_of_participants} traveller{booking.number_of_participants > 1 ? 's' : ''}</span>
              <button onClick={copyBookingId} className="flex items-center gap-1.5 hover:text-white/100 text-white/85 font-mono text-xs">
                <Copy className="h-3 w-3" />#{shortId}
              </button>
            </div>
            {phaseBadge.big && (
              <div className="sm:hidden mt-4 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 inline-block">
                {phaseBadge.kicker && <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">{phaseBadge.kicker}</p>}
                <p className="text-xl font-extrabold mt-0.5">{phaseBadge.big}</p>
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
            <button onClick={handleDownloadTicket} className="flex-shrink-0 sm:flex-shrink min-w-[120px] sm:min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 sm:py-4 hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col items-start gap-1.5">
              <Download className="h-5 w-5 text-gray-700" />
              <span className="text-xs sm:text-sm font-semibold text-gray-900 text-left">Download ticket</span>
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
          <InfoCard icon={<Calendar className="h-5 w-5 text-purple-600" />} label="Travel dates" value={`${fmtDateShort(effectiveStart)} → ${fmtDateShort(effectiveEnd)}`} />
          <InfoCard icon={<MapPin className="h-5 w-5 text-fuchsia-600" />} label="Destination" value={trip?.destination || '—'} />
          <InfoCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Travellers" value={String(booking.number_of_participants)} />
          <InfoCard icon={<MapPin className="h-5 w-5 text-orange-600" />} label="Pickup point" value={(booking as any).pickup_point || 'Shared 7 days before trip'} />
          <InfoCard icon={<Clock className="h-5 w-5 text-indigo-600" />} label="Duration" value={trip?.duration_text || (trip?.duration_days ? `${trip.duration_days} day${trip.duration_days > 1 ? 's' : ''}` : '—')} />
          <InfoCard icon={<CreditCard className="h-5 w-5 text-green-600" />} label="Payment" value={paymentStatusLabel(custPaymentStatus)} valueClass={custPaymentStatus === 'paid' ? 'text-green-700' : custPaymentStatus === 'refunded' ? 'text-rose-700' : 'text-orange-700'} />
        </div>

        {/* Offline balance — shown when a confirmed/seat-locked booking still owes money to
            be paid in person. Payment Status stays Partial; we never force it to Paid. */}
        {showOfflineBalance && !showRemainingPayment && (
          <div className="mb-4 sm:mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><IndianRupee className="h-5 w-5 text-orange-600" /></div>
              <div className="min-w-0">
                <p className="font-bold text-orange-900">Remaining offline balance: ₹{offlineRemaining.toLocaleString('en-IN')}</p>
                <p className="text-sm text-orange-800/90">To be collected offline during the trip. Trip price ₹{finalAmount.toLocaleString('en-IN')} · Paid ₹{paidAmount.toLocaleString('en-IN')}.</p>
              </div>
            </div>
            <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${paymentStatusChip(custPaymentStatus)}`}>{paymentStatusLabel(custPaymentStatus)}</span>
          </div>
        )}

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
                  <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" />{booking.primary_passenger_phone || '—'}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-xs">
                <div><p className="text-gray-500 mb-0.5">Gender</p><p className="font-semibold text-gray-900 capitalize">{booking.primary_passenger_gender || '—'}</p></div>
                <div><p className="text-gray-500 mb-0.5">Age</p><p className="font-semibold text-gray-900">{booking.primary_passenger_age || '—'}</p></div>
                <div><p className="text-gray-500 mb-0.5">Aadhaar</p><p className="font-semibold text-gray-900 font-mono">{booking.aadhaar_id || '—'}</p></div>
              </div>
            </div>

            {/* Additional passengers */}
            {additionalPassengers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Users className="h-4 w-4 text-blue-700" /></div>
                  <h3 className="font-bold text-gray-900">Additional travellers ({additionalPassengers.length})</h3>
                </div>
                <div className="space-y-3">
                  {additionalPassengers.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                        {(p?.name || 'P')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{p?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{p?.phone || '—'} · {p?.age || '—'} yrs · <span className="capitalize">{p?.gender || '—'}</span></p>
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
              {/* Payment status + breakdown */}
              {(() => {
                const perPerson = (trip?.discounted_price && trip.discounted_price > 0)
                  ? trip.discounted_price
                  : (pax > 0 ? Math.round(totalAmount / pax) : totalAmount);
                const shownPaid = Math.max(paidAmount, finalAmount - remainingAmount);
                const payBefore = resolveDueDate(effectiveStart, trip?.payment_due_days_before, paymentSettings.dueDaysBefore);
                const fmtPay = payBefore ? payBefore.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

                // Status config: drives the big banner at the top of the card.
                const cfg = (() => {
                  if (status === 'rejected') return { kind: 'rejected', emoji: '🔴', label: 'Booking Rejected', card: 'bg-red-50 border-red-200', banner: 'text-red-700', sub: 'border-red-200' };
                  if (status === 'cancelled') return { kind: 'cancelled', emoji: '⚫', label: 'Booking Cancelled', card: 'bg-gray-50 border-gray-200', banner: 'text-gray-700', sub: 'border-gray-200' };
                  if (status === 'remaining_submitted' || status === 'pending') return { kind: 'pending', emoji: '🔵', label: 'Verification Pending', card: 'bg-blue-50/60 border-blue-200', banner: 'text-blue-700', sub: 'border-blue-200' };
                  if (status === 'seat_locked') return { kind: 'seat_locked', emoji: '🟡', label: 'Seat Locked', card: 'bg-amber-50/70 border-amber-200', banner: 'text-amber-700', sub: 'border-amber-200' };
                  return { kind: 'paid', emoji: '🟢', label: 'Fully Paid', card: 'bg-green-50/60 border-green-200', banner: 'text-green-700', sub: 'border-green-200' };
                })();

                const subtotalRows = (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">₹{perPerson.toLocaleString('en-IN')} × {pax} {pax === 1 ? 'traveller' : 'travellers'}</dt>
                      <dd className="font-semibold text-gray-900">₹{totalAmount.toLocaleString('en-IN')}</dd>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-green-700"><dt className="flex items-center gap-1"><Tag className="h-3 w-3" />Coupon {booking.coupon_code ? `(${booking.coupon_code})` : ''}</dt><dd className="font-semibold">−₹{couponDiscount.toLocaleString('en-IN')}</dd></div>
                    )}
                    {walletUsed > 0 && (
                      <div className="flex justify-between text-purple-700"><dt>Wallet used</dt><dd className="font-semibold">−₹{walletUsed.toLocaleString('en-IN')}</dd></div>
                    )}
                  </>
                );

                return (
                  <div className={`rounded-2xl border overflow-hidden ${cfg.card}`}>
                    {/* Status banner — the first thing users see */}
                    <div className="px-5 sm:px-6 pt-5 pb-4">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Payment status</p>
                      <p className={`text-2xl font-extrabold mt-1.5 flex items-center gap-2 ${cfg.banner}`}>
                        <span className="text-xl leading-none">{cfg.emoji}</span>{cfg.label}
                      </p>
                    </div>

                    <div className={`bg-white/70 border-t ${cfg.sub} px-5 sm:px-6 py-4 space-y-2 text-sm`}>
                      {cfg.kind === 'paid' && (
                        <dl className="space-y-2">
                          {subtotalRows}
                          <div className={`pt-2 mt-1 border-t ${cfg.sub} flex justify-between items-baseline`}>
                            <dt className="text-gray-900 font-semibold">Total payable</dt>
                            <dd className="font-bold text-gray-900">₹{finalAmount.toLocaleString('en-IN')}</dd>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <dt className="text-gray-600">Amount paid</dt>
                            <dd className="font-bold text-green-700">₹{shownPaid.toLocaleString('en-IN')}</dd>
                          </div>
                          <p className="flex items-center gap-1.5 text-green-700 font-semibold pt-1"><CheckCircle className="h-4 w-4" />No dues remaining</p>
                        </dl>
                      )}

                      {cfg.kind === 'seat_locked' && (
                        <dl className="space-y-2">
                          {subtotalRows}
                          <div className={`pt-2 mt-1 border-t ${cfg.sub} flex justify-between items-baseline`}>
                            <dt className="text-gray-900 font-semibold">Net Trip Price</dt>
                            <dd className="font-bold text-gray-900">₹{finalAmount.toLocaleString('en-IN')}</dd>
                          </div>
                          <div className={`pt-2 mt-1 border-t ${cfg.sub} flex justify-between items-baseline`}>
                            <dt className="text-gray-600">Seat lock paid</dt>
                            <dd className="font-bold text-gray-900">₹{shownPaid.toLocaleString('en-IN')}</dd>
                          </div>
                          <div className={`pt-3 mt-1 border-t ${cfg.sub}`}>
                            <dt className="text-orange-700 font-semibold text-sm">Remaining amount</dt>
                            <dd className="text-3xl font-extrabold text-orange-600 mt-0.5">₹{remainingAmount.toLocaleString('en-IN')}</dd>
                            {fmtPay && <p className="text-xs text-orange-700 mt-1.5 font-medium">Pay before {fmtPay}</p>}
                          </div>
                        </dl>
                      )}

                      {cfg.kind === 'pending' && (
                        <div className="space-y-2">
                          {submittedPending > 0 ? (
                            <>
                              <p className="text-[11px] uppercase tracking-wider font-bold text-blue-600">Payment submitted · verifying</p>
                              <p className="text-3xl font-extrabold text-blue-700">₹{submittedPending.toLocaleString('en-IN')}</p>
                              {paidAmount > 0 && (
                                <div className="flex justify-between items-baseline text-sm"><span className="text-gray-600">Already paid earlier</span><span className="font-semibold text-gray-900">₹{paidAmount.toLocaleString('en-IN')}</span></div>
                              )}
                            </>
                          ) : (
                            <div className="flex justify-between items-baseline">
                              <span className="text-gray-600">Amount paid</span>
                              <span className="font-bold text-gray-900">₹{shownPaid.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          <p className={`text-sm text-gray-600 pt-2 mt-1 border-t ${cfg.sub} leading-relaxed`}>
                            {submittedPending > 0
                              ? "We've received your payment details and our team is verifying them now. Your seat is held — you'll get an email the moment it's confirmed (usually within a few hours)."
                              : "We're verifying your payment. This usually takes a few minutes — you'll get an email the moment it's confirmed."}
                          </p>
                        </div>
                      )}

                      {cfg.kind === 'rejected' && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Reason</p>
                            <p className="text-sm text-gray-800 mt-0.5">{booking.rejection_reason || 'Your booking could not be verified.'}</p>
                          </div>
                          <div className={`pt-3 border-t ${cfg.sub}`}>
                            <p className="text-sm text-gray-700 mb-3">This booking can no longer be used. Please create a new one.</p>
                            <Link href={trip?.id ? `/trips/${trip.id}` : '/trips'} className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors">
                              Create new booking
                            </Link>
                          </div>
                        </div>
                      )}

                      {cfg.kind === 'cancelled' && (
                        <div className="space-y-2">
                          {shownPaid > 0 && (
                            <div className="flex justify-between items-baseline">
                              <span className="text-gray-600">Amount paid</span>
                              <span className="font-bold text-gray-900">₹{shownPaid.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {booking.rejection_reason && (
                            <div className={`pt-2 mt-1 border-t ${cfg.sub}`}>
                              <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Reason</p>
                              <p className="text-sm text-gray-800 mt-0.5">{booking.rejection_reason}</p>
                            </div>
                          )}
                          {shownPaid > 0 && (
                            <div className={`pt-2 mt-1 border-t ${cfg.sub}`}>
                              <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Refund status</p>
                              <p className="text-sm text-gray-800 mt-0.5">Being processed as per the cancellation policy. Our team will reach out.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {(booking.transaction_id || booking.reference_id) && (
                        <div className={`mt-3 pt-3 border-t ${cfg.sub}`}>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Transaction ID</p>
                          <p className="font-mono text-xs text-gray-700 break-all">{booking.reference_id || booking.transaction_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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

        {/* ─────────── Full payment submitted, awaiting confirmation ─────────── */}
        {booking.booking_status === 'remaining_submitted' && (
          <div className="mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Seat locked — full payment confirmation waiting</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Your seat is locked and we've received your full payment details. Our team is verifying it now and will confirm your booking shortly (usually within a few hours). You'll get an email the moment it's confirmed.
              </p>
            </div>
          </div>
        )}

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
          <button onClick={handleDownloadTicket} className="flex flex-col items-center gap-1 px-2 py-2.5 hover:bg-gray-50 rounded-lg">
            <Download className="h-5 w-5 text-purple-600" />
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
