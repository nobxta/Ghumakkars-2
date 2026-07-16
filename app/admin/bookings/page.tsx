'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Banknote,
  Calendar,
  CheckCircle,
  ChevronDown,
  CreditCard,
  Eye,
  Filter,
  MoreVertical,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Users,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { bookingStatusLabel, effectiveBookingStatus } from '@/lib/booking-status-labels';
import { moneyOf } from '@/lib/booking-money';
import OfflineBookingForm from '@/components/admin/OfflineBookingForm';

type Booking = any;
type FilterKey = 'all' | 'needs_review' | 'pending' | 'seat_locked' | 'confirmed' | 'cancelled' | 'upcoming' | 'today' | 'week' | 'referrals';
type Toast = { type: 'success' | 'error'; message: string } | null;

const bookingStatuses = ['pending', 'seat_locked', 'confirmed', 'cancelled', 'rejected', 'referred', 'on_trip', 'completed', 'remaining_submitted'];
const paymentStates = ['paid', 'partial', 'unpaid', 'pending_verification', 'failed', 'rejected', 'refunded', 'partially_refunded', 'pending', 'cash_pending'];
const paymentMethods = ['razorpay', 'manual', 'cash', 'wallet'];
const paymentOptions = ['seat_lock', 'full'];
const activeBookingStatuses = ['pending', 'seat_locked', 'confirmed', 'remaining_submitted'];

const rejectionReasons = [
  { value: 'fake_payment', label: 'Fake Payment / Invalid Transaction ID' },
  { value: 'fake_details', label: 'Fake Details / Invalid Information' },
  { value: 'seats_full', label: 'Seats Full' },
  { value: 'other', label: 'Other (specify in notes)' },
];

const fmtMoney = (value: number) =>
  `\u20B9${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

const fmtDate = (value?: string | null, includeTime = false) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const titleCase = (value?: string | null) =>
  String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function customerName(booking: Booking) {
  const profileName = `${booking.profiles?.first_name || ''} ${booking.profiles?.last_name || ''}`.trim();
  return booking.primary_passenger_name || profileName || 'Unknown customer';
}

function customerContact(booking: Booking) {
  return booking.primary_passenger_email || booking.profiles?.email || booking.primary_passenger_phone || booking.profiles?.phone || 'No contact';
}

function departureDate(booking: Booking) {
  return booking.departure_date || booking.trips?.start_date || null;
}

function pickup(booking: Booking) {
  return booking.pickup_point || booking.pickup_location || '';
}

function optionLabel(booking: Booking) {
  if (booking.payment_mode === 'cash') return 'Pay in Person';
  if (booking.payment_method === 'seat_lock' || booking.booking_status === 'seat_locked' || booking.booking_status === 'remaining_submitted') return 'Seat Lock';
  if (booking.payment_method === 'full') return 'Full Payment';
  return booking.payment_method ? titleCase(booking.payment_method) : 'Not selected';
}

function optionKey(booking: Booking) {
  if (booking.payment_mode === 'cash') return 'cash';
  if (booking.payment_method === 'seat_lock' || booking.booking_status === 'seat_locked' || booking.booking_status === 'remaining_submitted') return 'seat_lock';
  if (booking.payment_method === 'full') return 'full';
  return String(booking.payment_method || '').toLowerCase();
}

function methodKey(booking: Booking) {
  return String(booking.payment_mode || booking.payment_transactions?.[0]?.payment_mode || '').toLowerCase();
}

function methodLabel(booking: Booking) {
  const key = methodKey(booking);
  if (key === 'razorpay') return 'Razorpay';
  if (key === 'manual') return 'Manual UPI / QR';
  if (key === 'cash') return 'Cash / Offline';
  if (key === 'wallet') return 'Wallet';
  return key ? titleCase(key) : 'Not recorded';
}

function latestTxn(booking: Booking) {
  return [...(booking.payment_transactions || [])].sort(
    (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  )[0];
}

function hasPendingTransaction(booking: Booking) {
  return (booking.payment_transactions || []).some((p: any) => p.payment_status === 'pending');
}

function needsReview(booking: Booking) {
  return hasPendingTransaction(booking) || (booking.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(booking.payment_status)));
}

function isReferralBooking(booking: Booking) {
  return Boolean(booking.booking_status === 'referred' || booking.referral_partner || Number(booking.referral_commission || 0) > 0);
}

function partnerLabel(booking: Booking) {
  return booking.referral_partner || 'Partner not set';
}

function commissionAmount(booking: Booking) {
  if (booking.referral_commission != null && booking.referral_commission !== '') return Number(booking.referral_commission);
  return null;
}

function paymentState(booking: Booking) {
  const pendingTxn = (booking.payment_transactions || []).find((p: any) => p.payment_status === 'pending');
  if (pendingTxn) return 'pending_verification';
  const rejectedTxn = latestTxn(booking)?.payment_status === 'rejected';
  if (rejectedTxn || booking.payment_status === 'rejected') return 'rejected';
  if (['failed', 'cancelled'].includes(String(booking.payment_status))) return String(booking.payment_status);
  if (['cash_pending', 'pending_cash'].includes(String(booking.payment_status))) return 'unpaid';
  const money = moneyOf(booking);
  if (money.refunded > 0 && money.paid <= 0.5) return 'refunded';
  if (money.refunded > 0) return 'partially_refunded';
  if (money.status === 'pending') return money.paid > 0 ? 'partial' : 'unpaid';
  return money.status;
}

function badgeClasses(kind: 'booking' | 'payment', status: string) {
  if (['paid', 'confirmed', 'verified'].includes(status)) return 'bg-green-50 text-green-700 border-green-200';
  if (['partial', 'seat_locked', 'remaining_submitted', 'pending'].includes(status)) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (['pending_verification', 'referred', 'on_trip', 'completed'].includes(status)) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (['failed', 'rejected', 'cancelled'].includes(status)) return 'bg-red-50 text-red-700 border-red-200';
  if (['refunded', 'partially_refunded'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
  return kind === 'payment' ? 'bg-gray-50 text-gray-700 border-gray-200' : 'bg-gray-100 text-gray-700 border-gray-200';
}

function statusLabel(status: string, kind: 'booking' | 'payment' = 'payment') {
  if (kind === 'booking') return status === 'referred' ? 'Partner Booking' : bookingStatusLabel(status);
  if (status === 'pending_verification') return 'Pending Verification';
  if (status === 'unpaid') return 'Not Collected';
  if (status === 'partial') return 'Partial';
  return titleCase(status || 'pending');
}

function bookingStatus(booking: Booking) {
  if (isReferralBooking(booking) && booking.booking_status === 'referred') return 'confirmed';
  return effectiveBookingStatus(booking.booking_status || 'pending', departureDate(booking), booking.trips?.end_date);
}

function actionLabel(booking: Booking) {
  if (hasPendingTransaction(booking)) return 'Review Payment';
  if (booking.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(booking.payment_status))) return 'Review Booking';
  return 'View';
}

function compactActionLabel(booking: Booking) {
  return actionLabel(booking).startsWith('Review') ? 'Review' : 'View';
}

function actionHref(booking: Booking) {
  return `/admin/bookings/${booking.id}`;
}

function SortIcon() {
  return <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />;
}

const controlClass = 'h-11 w-full min-w-0 rounded-[12px] border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 shadow-none outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [deleteBooking, setDeleteBooking] = useState<Booking | null>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('fake_payment');
  const [reviewing, setReviewing] = useState(false);
  const [cashAmountPaid, setCashAmountPaid] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [approvingCash, setApprovingCash] = useState(false);

  const initial = (key: string, fallback = '') => searchParams.get(key) || fallback;
  const [search, setSearch] = useState(initial('q'));
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tripId, setTripId] = useState(initial('trip', 'all'));
  const [dateFrom, setDateFrom] = useState(initial('from'));
  const [dateTo, setDateTo] = useState(initial('to'));
  const [bookingFilter, setBookingFilter] = useState(initial('bookingStatus', 'all'));
  const [paymentFilter, setPaymentFilter] = useState(initial('paymentStatus', 'all'));
  const [methodFilter, setMethodFilter] = useState(initial('paymentMethod', 'all'));
  const [optionFilter, setOptionFilter] = useState(initial('paymentOption', 'all'));
  const [sourceFilter, setSourceFilter] = useState(initial('source', 'all'));
  const [sortBy, setSortBy] = useState(initial('sort', 'created_desc'));
  const [quick, setQuick] = useState<FilterKey>((initial('quick', 'all') as FilterKey) || 'all');

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/bookings', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to fetch bookings');
      setBookings(payload.bookings || []);
      setSummary(payload.summary || null);
    } catch (err: any) {
      setError(err.message || 'Bookings could not be loaded');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!deleteBooking) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingBookingId) setDeleteBooking(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [deleteBooking, deletingBookingId]);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [rowMenu]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (tripId !== 'all') params.set('trip', tripId);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (bookingFilter !== 'all') params.set('bookingStatus', bookingFilter);
    if (paymentFilter !== 'all') params.set('paymentStatus', paymentFilter);
    if (methodFilter !== 'all') params.set('paymentMethod', methodFilter);
    if (optionFilter !== 'all') params.set('paymentOption', optionFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (sortBy !== 'created_desc') params.set('sort', sortBy);
    if (quick !== 'all') params.set('quick', quick);
    const next = params.toString() ? `/admin/bookings?${params.toString()}` : '/admin/bookings';
    router.replace(next, { scroll: false });
  }, [debouncedSearch, tripId, dateFrom, dateTo, bookingFilter, paymentFilter, methodFilter, optionFilter, sourceFilter, sortBy, quick, router]);

  const trips = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    bookings.forEach((b) => {
      if (b.trip_id) map.set(b.trip_id, { id: b.trip_id, label: b.trips?.title || b.trips?.destination || b.trip_id });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    let rows = bookings.filter((booking) => {
      const haystack = [
        booking.id,
        customerName(booking),
        customerContact(booking),
        booking.primary_passenger_phone,
        booking.profiles?.phone,
        booking.trips?.title,
        booking.trips?.destination,
      ].filter(Boolean).join(' ').toLowerCase();
      if (debouncedSearch && !haystack.includes(debouncedSearch.toLowerCase())) return false;
      if (tripId !== 'all' && booking.trip_id !== tripId) return false;
      const dep = departureDate(booking);
      if (dateFrom && (!dep || dep < dateFrom)) return false;
      if (dateTo && (!dep || dep > dateTo)) return false;
      if (bookingFilter !== 'all' && bookingStatus(booking) !== bookingFilter && booking.booking_status !== bookingFilter) return false;
      if (paymentFilter !== 'all' && paymentState(booking) !== paymentFilter) return false;
      if (methodFilter !== 'all' && methodKey(booking) !== methodFilter) return false;
      if (optionFilter !== 'all' && optionKey(booking) !== optionFilter) return false;
      if (sourceFilter === 'direct' && isReferralBooking(booking)) return false;
      if (sourceFilter === 'referral' && !isReferralBooking(booking)) return false;
      if (quick === 'needs_review' && !needsReview(booking)) return false;
      if (quick === 'referrals' && !isReferralBooking(booking)) return false;
      if (['pending', 'seat_locked', 'confirmed', 'cancelled'].includes(quick) && booking.booking_status !== quick) return false;
      if (quick === 'upcoming') return dep ? new Date(dep) >= today : false;
      if (quick === 'today') return dep ? new Date(dep).toDateString() === today.toDateString() : false;
      if (quick === 'week') {
        if (!dep) return false;
        const d = new Date(dep);
        return d >= today && d <= weekEnd;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'departure_asc') return String(departureDate(a) || '').localeCompare(String(departureDate(b) || ''));
      if (sortBy === 'amount_desc') return moneyOf(b).owed - moneyOf(a).owed;
      if (sortBy === 'due_desc') return moneyOf(b).remaining - moneyOf(a).remaining;
      if (sortBy === 'status') return bookingStatus(a).localeCompare(bookingStatus(b));
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return rows;
  }, [bookings, debouncedSearch, tripId, dateFrom, dateTo, bookingFilter, paymentFilter, methodFilter, optionFilter, sourceFilter, quick, sortBy]);

  const visibleMethods = paymentMethods.filter((method) => bookings.some((b) => methodKey(b) === method));
  const visibleOptions = paymentOptions.filter((option) => bookings.some((b) => optionKey(b) === option));
  const activeFilters = [
    debouncedSearch && `Search: ${debouncedSearch}`,
    tripId !== 'all' && `Trip: ${trips.find((t) => t.id === tripId)?.label || tripId}`,
    dateFrom && `From: ${fmtDate(dateFrom)}`,
    dateTo && `To: ${fmtDate(dateTo)}`,
    bookingFilter !== 'all' && `Booking: ${statusLabel(bookingFilter, 'booking')}`,
    paymentFilter !== 'all' && `Payment: ${statusLabel(paymentFilter)}`,
    methodFilter !== 'all' && `Method: ${titleCase(methodFilter)}`,
    optionFilter !== 'all' && `Option: ${optionFilter === 'seat_lock' ? 'Seat Lock' : titleCase(optionFilter)}`,
    sourceFilter !== 'all' && `Source: ${sourceFilter === 'referral' ? 'Partner Bookings' : 'Direct'}`,
    quick !== 'all' && `Quick: ${quick === 'referrals' ? 'Partner Bookings' : titleCase(quick)}`,
  ].filter(Boolean) as string[];

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setTripId('all');
    setDateFrom('');
    setDateTo('');
    setBookingFilter('all');
    setPaymentFilter('all');
    setMethodFilter('all');
    setOptionFilter('all');
    setSourceFilter('all');
    setQuick('all');
    setSortBy('created_desc');
  };

  const openPaymentModal = (booking: Booking, transaction?: any) => {
    setSelectedBooking(booking);
    setSelectedTransaction(transaction || (booking.payment_transactions || []).find((p: any) => p.payment_status === 'pending') || null);
    setReviewNotes('');
    setRejectionReason('fake_payment');
    setShowPaymentModal(true);
  };

  const openCashPaymentModal = (booking: Booking) => {
    const money = moneyOf(booking);
    setSelectedBooking(booking);
    setCashAmountPaid(money.remaining > 0 ? String(money.remaining) : '');
    setCashNotes('');
    setShowCashPaymentModal(true);
  };

  const handlePrimaryAction = (booking: Booking) => {
    if (hasPendingTransaction(booking)) {
      openPaymentModal(booking);
      return;
    }
    if (booking.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(booking.payment_status))) {
      openCashPaymentModal(booking);
      return;
    }
    router.push(actionHref(booking));
  };

  const handleReviewPayment = async (transaction: any, status: 'verified' | 'rejected') => {
    if (!transaction?.id) return alert('Invalid transaction data');
    if (status === 'rejected' && !rejectionReason) return alert('Please select a rejection reason');
    setReviewing(true);
    try {
      const response = await fetch('/api/admin/bookings/review-payment-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          status,
          reviewNotes: reviewNotes || null,
          rejectionReason: status === 'rejected'
            ? (rejectionReasons.find((r) => r.value === rejectionReason)?.label || rejectionReason)
            : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to review payment');
      setShowPaymentModal(false);
      setSelectedBooking(null);
      setSelectedTransaction(null);
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to update payment');
    } finally {
      setReviewing(false);
    }
  };

  const handleApproveCashPayment = async () => {
    if (!selectedBooking || !cashAmountPaid || parseFloat(cashAmountPaid) <= 0) return alert('Please enter a valid amount');
    setApprovingCash(true);
    try {
      const response = await fetch('/api/admin/bookings/approve-cash-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, amountPaid: parseFloat(cashAmountPaid), notes: cashNotes || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to approve cash payment');
      setShowCashPaymentModal(false);
      setSelectedBooking(null);
      await fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to approve cash payment');
    } finally {
      setApprovingCash(false);
    }
  };

  const requestDeleteBooking = (booking: Booking) => {
    setRowMenu(null);
    setDeleteBooking(booking);
  };

  const confirmDeleteBooking = async () => {
    if (!deleteBooking || deletingBookingId) return;
    setDeletingBookingId(deleteBooking.id);
    try {
      const response = await fetch(`/api/admin/bookings/${deleteBooking.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete booking');
      setToast({ type: 'success', message: 'Booking deleted.' });
      setDeleteBooking(null);
      await fetchBookings();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to delete booking' });
    } finally {
      setDeletingBookingId(null);
    }
  };

  const localPartnerCommission = bookings.reduce((sum, booking) => {
    const amount = commissionAmount(booking);
    return isReferralBooking(booking) && amount != null && Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const localPartnerBookings = bookings.filter(isReferralBooking).length;

  const summaryData = summary ? {
    ...summary,
    referralCommission: {
      total: localPartnerCommission,
      count: localPartnerBookings,
    },
  } : {
    collected: bookings.filter((b) => activeBookingStatuses.includes(String(b.booking_status))).reduce((sum, b) => sum + moneyOf(b).paid, 0),
    outstanding: bookings.filter((b) => activeBookingStatuses.includes(String(b.booking_status))).reduce((sum, b) => sum + moneyOf(b).remaining, 0),
    needsReview: bookings.filter(needsReview).length,
    totalBookings: bookings.length,
    activeBookings: bookings.filter((b) => activeBookingStatuses.includes(String(b.booking_status))).length,
    byBookingStatus: {},
    referralCommission: {
      total: localPartnerCommission,
      count: localPartnerBookings,
    },
  };

  const renderFilterControls = (includeSearch = true) => (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        {includeSearch && (
          <Field label="Search" className="md:col-span-2 xl:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, phone or booking ID"
                className={`${controlClass} pl-9 ${search ? 'pr-9' : 'pr-3'}`}
                aria-label="Search by customer name, email, phone or booking ID"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
        )}
        <Field label="Trip" className="xl:col-span-2">
          <div className="relative">
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Trip">
              <option value="all">All trips</option>
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.label}</option>)}
            </select>
            <SortIcon />
          </div>
        </Field>
        <Field label="Departure from" className="xl:col-span-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={controlClass} aria-label="Departure from" />
        </Field>
        <Field label="Departure to" className="xl:col-span-2">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={controlClass} aria-label="Departure to" />
        </Field>
        <Field label="Booking status/type" className="xl:col-span-1">
          <div className="relative">
            <select value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Booking status or type">
              <option value="all">All statuses</option>
              {bookingStatuses.map((s) => <option key={s} value={s}>{statusLabel(s, 'booking')}</option>)}
            </select>
            <SortIcon />
          </div>
        </Field>
        <Field label="Payment status" className="xl:col-span-2">
          <div className="relative">
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Payment status">
              <option value="all">All payment statuses</option>
              {paymentStates.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            <SortIcon />
          </div>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <Field label="Payment method" className="xl:col-span-2">
          <div className="relative">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Payment method">
              <option value="all">All methods</option>
              {visibleMethods.map((m) => <option key={m} value={m}>{m === 'manual' ? 'Manual UPI / QR' : m === 'cash' ? 'Cash / Offline' : titleCase(m)}</option>)}
            </select>
            <SortIcon />
          </div>
        </Field>
        <Field label="Payment option" className="xl:col-span-2">
          <div className="relative">
            <select value={optionFilter} onChange={(e) => setOptionFilter(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Payment option">
              <option value="all">All options</option>
              {visibleOptions.map((o) => <option key={o} value={o}>{o === 'seat_lock' ? 'Seat Lock' : 'Full Payment'}</option>)}
              {bookings.some((b) => b.payment_mode === 'cash') && <option value="cash">Pay in Person</option>}
            </select>
            <SortIcon />
          </div>
        </Field>
        <Field label="Sort" className="xl:col-span-2">
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Sort bookings">
              <option value="created_desc">Newest booked</option>
              <option value="departure_asc">Departure date</option>
              <option value="amount_desc">Highest total</option>
              <option value="due_desc">Highest due</option>
              <option value="status">Booking status</option>
            </select>
            <SortIcon />
          </div>
        </Field>
        <Field label="Booking source" className="xl:col-span-2">
          <div className="relative">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={`${controlClass} appearance-none pr-9`} aria-label="Booking source">
              <option value="all">All sources</option>
              <option value="direct">Direct</option>
              <option value="referral">Partner Bookings</option>
            </select>
            <SortIcon />
          </div>
        </Field>
        {activeFilters.length > 0 && (
          <div className="flex items-end xl:col-span-2">
            <button onClick={clearFilters} className="h-[42px] rounded-[10px] border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-100">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderActionMenu = (booking: Booking, align: 'right' | 'left' = 'right') => (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRowMenu(rowMenu === booking.id ? null : booking.id);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-100"
        aria-label={`Booking actions for ${customerName(booking)}`}
        aria-haspopup="menu"
        aria-expanded={rowMenu === booking.id}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {rowMenu === booking.id && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-40 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white py-1 text-left text-sm shadow-xl`}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={actionHref(booking)} className="flex min-h-11 items-center gap-2 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50" role="menuitem">
            <Eye className="h-4 w-4" />View Booking
          </Link>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => requestDeleteBooking(booking)}
            className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-semibold text-red-700 hover:bg-red-50"
            role="menuitem"
            aria-label={`Delete booking for ${customerName(booking)}`}
          >
            <Trash2 className="h-4 w-4" />Delete Booking
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50/70 px-3.5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-8 lg:p-6">
      <div className="mx-auto w-full max-w-[1680px] space-y-4 overflow-x-hidden">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h1 className="text-[21px] font-bold leading-tight tracking-tight text-gray-950 sm:text-2xl">All Bookings</h1>
            <p className="mt-1 text-sm leading-5 text-gray-600">Manage bookings, payments and pending actions.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => setShowOfflineModal(true)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Add offline booking
            </button>
            <button onClick={fetchBookings} disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-4 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-60 sm:w-auto">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <button onClick={() => setPaymentFilter('paid')} className="min-h-[94px] rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-100 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Collected</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-green-700 sm:text-xl">{fmtMoney(summaryData.collected)}</p>
            <p className="mt-1 text-xs leading-4 text-gray-500">Successfully collected</p>
          </button>
          <button onClick={() => setSortBy('due_desc')} className="min-h-[94px] rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-100 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Outstanding</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-orange-700 sm:text-xl">{fmtMoney(summaryData.outstanding)}</p>
            <p className="mt-1 text-xs leading-4 text-gray-500">Across active bookings</p>
          </button>
          <button onClick={() => setQuick('referrals')} className="col-span-2 min-h-[94px] rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-100 sm:p-4 xl:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Partner Commission</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-purple-700 sm:text-xl">{fmtMoney(summaryData.referralCommission?.total || 0)}</p>
            <p className="mt-1 text-xs leading-4 text-gray-500">{summaryData.referralCommission?.count || 0} partner booking{Number(summaryData.referralCommission?.count || 0) === 1 ? '' : 's'}</p>
          </button>
          <div className="min-h-[94px] rounded-2xl border border-gray-200 bg-white p-3.5 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Active / Total Bookings</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-950 sm:text-xl">{summaryData.activeBookings || 0} / {summaryData.totalBookings || 0}</p>
            <p className="mt-1 truncate text-xs leading-4 text-gray-500">
              Confirmed {summaryData.byBookingStatus?.confirmed || 0} - Seat Locked {summaryData.byBookingStatus?.seat_locked || 0} - Pending {summaryData.byBookingStatus?.pending || 0}
            </p>
          </div>
          <button onClick={() => setQuick('needs_review')} className={`min-h-[94px] rounded-2xl border bg-white p-3.5 text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-100 sm:p-4 ${summaryData.needsReview ? 'border-purple-200' : 'border-gray-200'}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Needs Review</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-purple-700 sm:text-xl">{summaryData.needsReview || 0}</p>
            <p className="mt-1 text-xs leading-4 text-gray-500">{summaryData.needsReview ? 'Manual or cash review' : 'No pending reviews'}</p>
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-100/60">
          <div className="hidden md:block">{renderFilterControls(true)}</div>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <label className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings" className={`${controlClass} pl-9 ${search ? 'pr-9' : 'pr-3'}`} aria-label="Search bookings" />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <button onClick={() => setMobileFiltersOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-100">
              <Filter className="h-4 w-4" />
              Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
            </button>
          </div>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {(['all', 'needs_review', 'pending', 'seat_locked', 'confirmed', 'cancelled', 'referrals', 'upcoming', 'today', 'week'] as FilterKey[]).map((item) => (
              <button key={item} onClick={() => setQuick(item)} className={`h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-100 ${quick === item ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                {item === 'all' ? 'All' : item === 'needs_review' ? 'Needs Review' : item === 'week' ? 'This Week' : item === 'referrals' ? 'Partner Bookings' : titleCase(item)}
              </button>
            ))}
          </div>
          {activeFilters.length > 0 && (
            <div className="-mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1 text-xs [scrollbar-width:none]">
              {activeFilters.map((item) => <span key={item} className="whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{item}</span>)}
              <button onClick={clearFilters} className="whitespace-nowrap font-semibold text-purple-700 hover:text-purple-900">Clear all</button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <button onClick={fetchBookings} className="rounded-lg bg-white px-3 py-2 font-semibold text-red-700">Retry</button>
            </div>
          </div>
        )}

        <div className="hidden lg:block">
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,.82fr)_minmax(0,.9fr)_minmax(0,1.1fr)_minmax(0,.72fr)_minmax(84px,.55fr)] gap-3 px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <div>Booking & Customer</div>
            <div>Trip</div>
            <div>Amount / Commission</div>
            <div>Payment / Operator</div>
            <div>Partner / Source</div>
            <div>Booking Status</div>
            <div className="text-right">Action</div>
          </div>
          <div className="mt-2 flex flex-col gap-3">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-xl border border-gray-200 bg-white" />
            ))}
            {!loading && filteredBookings.map((booking) => {
              const money = moneyOf(booking);
              const payState = paymentState(booking);
              const bookState = bookingStatus(booking);
              const pendingTxn = (booking.payment_transactions || []).find((p: any) => p.payment_status === 'pending');
              const referral = isReferralBooking(booking);
              const amount = commissionAmount(booking);
              return (
                <div
                  key={booking.id}
                  onClick={() => router.push(actionHref(booking))}
                  className={`grid min-h-[108px] cursor-pointer grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_minmax(0,.82fr)_minmax(0,.9fr)_minmax(0,1.1fr)_minmax(0,.72fr)_minmax(84px,.55fr)] gap-3 rounded-xl border px-4 py-4 transition hover:border-purple-200 hover:shadow-sm ${needsReview(booking) ? 'border-l-4 border-l-amber-400 bg-white' : referral ? 'border-l-4 border-l-purple-500 bg-purple-50/35' : 'border-gray-200 bg-white'}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-950" title={customerName(booking)}>{customerName(booking)}</p>
                      {referral && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">Partner Booking</span>}
                    </div>
                    <p className="mt-1 font-mono text-xs uppercase text-gray-500" title={booking.id}>#{booking.id.slice(0, 8)}</p>
                    <p className="mt-1 truncate text-xs text-gray-600" title={customerContact(booking)}>{customerContact(booking)}</p>
                    <p className="mt-1 text-xs text-gray-500">Booked {fmtDate(booking.created_at, true)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950" title={booking.trips?.title}>{booking.trips?.title || 'Trip not found'}</p>
                    <p className="mt-1 text-sm font-semibold text-purple-700">{fmtDate(departureDate(booking))}</p>
                    <p className="mt-1 truncate text-xs text-gray-500" title={pickup(booking)}>{pickup(booking) || booking.trips?.destination || 'Pickup not recorded'}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-700"><Users className="h-3.5 w-3.5" />{booking.number_of_participants || 1} traveller{Number(booking.number_of_participants || 1) > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-sm tabular-nums">
                    {referral ? (
                      <div className="rounded-xl bg-purple-50/70 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700">Our Commission</p>
                        {amount == null ? (
                          <p className="mt-1 text-xs font-semibold text-gray-600">Commission not set</p>
                        ) : (
                          <p className="mt-1 text-base font-bold text-purple-700">{fmtMoney(amount)}</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-[42px_1fr] gap-y-1">
                        <span className="text-gray-500">Total</span><span className="text-right font-semibold text-gray-950">{fmtMoney(money.owed)}</span>
                        <span className="text-gray-500">Paid</span><span className={`text-right font-semibold ${money.paid > 0 ? 'text-green-700' : 'text-gray-500'}`}>{fmtMoney(money.paid)}</span>
                        <span className="text-gray-500">Due</span><span className={`text-right font-semibold ${money.remaining > 0 ? 'text-orange-700' : 'text-green-700'}`}>{money.remaining > 0 ? fmtMoney(money.remaining) : 'Fully paid'}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    {referral ? (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Referred to Partner</p>
                        <p className="mt-1 truncate text-sm font-semibold text-gray-950" title={partnerLabel(booking)}>{partnerLabel(booking)}</p>
                        <p className="mt-1 text-xs text-gray-600">Partner-operated booking</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{optionLabel(booking)}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">{methodKey(booking) === 'razorpay' ? <CreditCard className="h-3.5 w-3.5" /> : methodKey(booking) === 'cash' ? <Banknote className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}{methodLabel(booking)}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClasses('payment', payState)}`}>{statusLabel(payState)}</span>
                        {pendingTxn?.amount && <p className="mt-1 text-xs text-purple-700">Submitted {fmtMoney(Number(pendingTxn.amount))}</p>}
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    {referral ? (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Operated by</p>
                        <p className="mt-1 truncate text-sm font-semibold text-gray-950" title={partnerLabel(booking)}>{partnerLabel(booking)}</p>
                        <p className="mt-1 text-xs text-gray-500">Partner-operated booking</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Our Commission</p>
                        {amount == null ? (
                          <p className="mt-1 text-xs font-semibold text-gray-500">Commission not set</p>
                        ) : (
                          <p className="mt-1 text-sm font-bold tabular-nums text-purple-700">{fmtMoney(amount)}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-700">Direct Booking</p>
                        <p className="mt-1 text-xs text-gray-500">No referral commission</p>
                      </>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${badgeClasses('booking', bookState)}`}>{statusLabel(bookState, 'booking')}</span>
                    {needsReview(booking) && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertCircle className="h-3.5 w-3.5" />Review</p>}
                  </div>
                  <div className="text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handlePrimaryAction(booking)} className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-200 ${needsReview(booking) ? 'bg-purple-600 text-white hover:bg-purple-700' : 'border border-gray-200 bg-white text-gray-700 hover:bg-purple-50 hover:text-purple-700'}`}>
                      {compactActionLabel(booking)}
                    </button>
                    <div className="mt-2">{renderActionMenu(booking)}</div>
                  </div>
                </div>
              );
            })}
            {!loading && filteredBookings.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-600">
                {activeFilters.length ? 'No bookings match the active filters.' : 'No bookings found.'}
                {activeFilters.length > 0 && <button onClick={clearFilters} className="ml-2 font-semibold text-purple-700">Clear filters</button>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white" />)}
          {!loading && filteredBookings.map((booking) => {
            const money = moneyOf(booking);
            const payState = paymentState(booking);
            const bookState = bookingStatus(booking);
            const referral = isReferralBooking(booking);
            const amount = commissionAmount(booking);
            return (
              <article key={booking.id} className={`overflow-visible rounded-2xl border shadow-sm shadow-gray-100/50 ${needsReview(booking) ? 'border-l-4 border-l-amber-400 bg-white' : referral ? 'border-l-4 border-l-purple-500 bg-purple-50/35' : 'border-gray-200 bg-white'}`}>
                <button onClick={() => router.push(actionHref(booking))} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3 p-4 pb-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-[15px] font-bold leading-5 text-gray-950">{customerName(booking)}</h2>
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                        <p className="font-mono text-xs uppercase text-gray-500">#{booking.id.slice(0, 8)}</p>
                        {referral && <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Partner Booking</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-bold ${badgeClasses('booking', bookState)}`}>{statusLabel(bookState, 'booking')}</span>
                  </div>
                  <div className="border-t border-gray-100 px-4 py-3">
                    <p className="truncate text-[15px] font-semibold text-gray-950" title={booking.trips?.title}>{booking.trips?.title || 'Trip not found'}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-purple-700"><Calendar className="h-4 w-4" />{fmtDate(departureDate(booking))}</p>
                    <p className="mt-1 truncate text-sm text-gray-600" title={pickup(booking) || booking.trips?.destination || ''}>{pickup(booking) || booking.trips?.destination || 'Pickup not recorded'} - {booking.number_of_participants || 1} traveller{Number(booking.number_of_participants || 1) > 1 ? 's' : ''}</p>
                  </div>
                  {referral ? (
                    <div className="mx-4 rounded-xl border border-purple-100 bg-white/80 p-3 text-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Operated by</p>
                      <p className="mt-1 font-semibold text-gray-950" title={partnerLabel(booking)}>{partnerLabel(booking)}</p>
                      <p className="mt-1 text-xs text-gray-600">Partner-operated booking</p>
                      <div className="mt-3 rounded-lg bg-purple-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700">Our Commission</p>
                        {amount == null ? (
                          <p className="mt-1 text-sm font-semibold text-gray-600">Commission not set</p>
                        ) : (
                          <p className="mt-1 text-lg font-bold tabular-nums text-purple-700">{fmtMoney(amount)}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-sm tabular-nums">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">Booking Amount</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-4"><span className="text-gray-500">Total</span><span className="font-semibold text-gray-950">{fmtMoney(money.owed)}</span></div>
                          <div className="flex items-center justify-between gap-4"><span className="text-gray-500">Paid</span><span className={money.paid > 0 ? 'font-semibold text-green-700' : 'font-semibold text-gray-500'}>{fmtMoney(money.paid)}</span></div>
                          <div className="flex items-center justify-between gap-4"><span className="text-gray-500">Due</span><span className={money.remaining > 0 ? 'font-semibold text-orange-700' : 'font-semibold text-green-700'}>{money.remaining > 0 ? fmtMoney(money.remaining) : 'Paid'}</span></div>
                        </div>
                      </div>
                      {money.refunded > 0 && <p className="mx-4 mt-2 text-sm font-semibold text-rose-700">Refunded {fmtMoney(money.refunded)}</p>}
                      <div className="mx-4 mt-3 rounded-xl border border-gray-100 p-3 text-sm text-gray-700">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Payment</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold text-gray-950">{optionLabel(booking)}</span>
                          <span className="text-gray-500">{methodLabel(booking)}</span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClasses('payment', payState)}`}>{statusLabel(payState)}</span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="mx-4 mt-3 rounded-xl border border-gray-100 bg-white/80 p-3 text-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Source</p>
                    <div className="mt-1">
                      {referral ? (
                        <p className="font-semibold text-purple-700">Partner Booking</p>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-700">Direct Booking</p>
                          <p className="text-xs text-gray-500">Managed by Ghumakkars</p>
                        </>
                      )}
                    </div>
                  </div>
                </button>
                <div className="mt-3 space-y-3 border-t border-gray-100 bg-white/80 p-4 pt-3">
                  <p className="text-xs text-gray-500">Booked {fmtDate(booking.created_at, true)}</p>
                  <div className="flex min-w-0 items-center gap-2">
                    <button onClick={() => handlePrimaryAction(booking)} className={`h-11 min-w-0 flex-1 rounded-xl px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-100 ${needsReview(booking) ? 'bg-purple-600 text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>{actionLabel(booking)}</button>
                    {renderActionMenu(booking)}
                  </div>
                </div>
              </article>
            );
          })}
          {!loading && filteredBookings.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
              {activeFilters.length ? 'No bookings match the active filters.' : 'No bookings found.'}
              {activeFilters.length > 0 && <button onClick={clearFilters} className="ml-2 font-semibold text-purple-700">Clear filters</button>}
            </div>
          )}
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 md:hidden" role="dialog" aria-modal="true" aria-label="Booking filters">
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[22px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Filters</h2>
                <p className="text-sm text-gray-500">Refine the bookings list</p>
              </div>
              <button onClick={() => setMobileFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-100" aria-label="Close filters"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {renderFilterControls(false)}
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
              <button onClick={clearFilters} className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-100">Clear all</button>
              <button onClick={() => setMobileFiltersOpen(false)} className="h-11 flex-1 rounded-xl bg-purple-600 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-200">Apply filters</button>
            </div>
          </div>
        </div>
      )}

      {deleteBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/45 p-3" role="dialog" aria-modal="true" aria-labelledby="delete-booking-title">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="delete-booking-title" className="text-lg font-bold text-gray-950">Delete booking?</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    This will permanently delete the booking for {customerName(deleteBooking)}. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  autoFocus
                  disabled={Boolean(deletingBookingId)}
                  onClick={() => setDeleteBooking(null)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingBookingId)}
                  onClick={confirmDeleteBooking}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingBookingId ? 'Deleting...' : 'Delete Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-3" role="dialog" aria-modal="true" aria-labelledby="offline-booking-title">
          <div className="my-6 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 sm:px-5">
              <div>
                <h2 id="offline-booking-title" className="text-lg font-bold text-gray-950">Add offline booking</h2>
                <p className="text-sm text-gray-500">Choose trip, batch, passenger details, add-ons and collected amount.</p>
              </div>
              <button onClick={() => setShowOfflineModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-100" aria-label="Close offline booking">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <OfflineBookingForm
                onCreated={async () => {
                  setShowOfflineModal(false);
                  setToast({ type: 'success', message: 'Offline booking added.' });
                  await fetchBookings();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Review Payment</h2>
                <p className="text-sm text-gray-500">{customerName(selectedBooking)} - {selectedBooking.id.slice(0, 8)}...</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-4">
              {(selectedBooking.payment_transactions || []).map((transaction: any) => (
                <button key={transaction.id} onClick={() => setSelectedTransaction(transaction)} className={`w-full rounded-lg border p-3 text-left ${selectedTransaction?.id === transaction.id ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-950">{transaction.transaction_id || 'No transaction ID'}</p>
                      <p className="mt-1 text-sm text-gray-600">{methodLabel({ payment_mode: transaction.payment_mode })} - {titleCase(transaction.payment_type || 'payment')}</p>
                      {transaction.rejection_reason && <p className="mt-1 text-sm text-red-700">{transaction.rejection_reason}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-gray-950">{fmtMoney(Number(transaction.amount || 0))}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClasses('payment', transaction.payment_status)}`}>{statusLabel(transaction.payment_status)}</span>
                    </div>
                  </div>
                </button>
              ))}
              {selectedTransaction?.payment_status === 'pending' ? (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <label className="block text-sm font-semibold text-gray-700">Review notes</label>
                  <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" placeholder="Optional admin note" />
                  <label className="mt-3 block text-sm font-semibold text-gray-700">Rejection reason</label>
                  <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-500">
                    {rejectionReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                  </select>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button disabled={reviewing} onClick={() => handleReviewPayment(selectedTransaction, 'verified')} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-bold text-white disabled:opacity-60"><CheckCircle className="h-4 w-4" />Verify Payment</button>
                    <button disabled={reviewing} onClick={() => handleReviewPayment(selectedTransaction, 'rejected')} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white disabled:opacity-60"><XCircle className="h-4 w-4" />Reject Payment</button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">{selectedTransaction ? 'This transaction is not pending review.' : 'Select a pending transaction to review.'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showCashPaymentModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-950">Review Cash Payment</h2>
              <button onClick={() => setShowCashPaymentModal(false)} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-gray-950">{customerName(selectedBooking)}</p>
                <p className="mt-1 text-gray-600">Outstanding {fmtMoney(moneyOf(selectedBooking).remaining)}</p>
              </div>
              <label className="block text-sm font-semibold text-gray-700">Amount received</label>
              <input type="number" value={cashAmountPaid} onChange={(e) => setCashAmountPaid(e.target.value)} className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              <label className="block text-sm font-semibold text-gray-700">Notes</label>
              <textarea value={cashNotes} onChange={(e) => setCashNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              <button disabled={approvingCash} onClick={handleApproveCashPayment} className="h-10 w-full rounded-lg bg-green-600 text-sm font-bold text-white disabled:opacity-60">Approve Payment</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed right-3 top-20 z-[70] w-[calc(100%-1.5rem)] max-w-sm rounded-xl border bg-white p-4 text-sm font-semibold shadow-xl ${toast.type === 'success' ? 'border-green-200 text-green-800' : 'border-red-200 text-red-800'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
