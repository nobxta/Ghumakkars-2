'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Filter,
  Gift,
  IndianRupee,
  MoreVertical,
  RefreshCw,
  Search,
  SlidersHorizontal,
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
type FilterKey =
  | 'all'
  | 'needs_review'
  | 'pending'
  | 'seat_locked'
  | 'confirmed'
  | 'cancelled'
  | 'referrals'
  | 'upcoming'
  | 'today'
  | 'week';

type Toast = { type: 'success' | 'error'; message: string } | null;

const bookingStatuses = [
  'pending',
  'seat_locked',
  'confirmed',
  'cancelled',
  'rejected',
  'referred',
  'on_trip',
  'completed',
  'remaining_submitted',
];

const paymentStates = [
  'paid',
  'partial',
  'unpaid',
  'pending_verification',
  'failed',
  'rejected',
  'refunded',
  'partially_refunded',
  'pending',
  'cash_pending',
];

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
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function customerName(booking: Booking) {
  const profileName = `${booking.profiles?.first_name || ''} ${booking.profiles?.last_name || ''}`.trim();
  return booking.primary_passenger_name || profileName || 'Unknown customer';
}

function customerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function customerContact(booking: Booking) {
  return (
    booking.primary_passenger_email ||
    booking.profiles?.email ||
    booking.primary_passenger_phone ||
    booking.profiles?.phone ||
    'No contact'
  );
}

function departureDate(booking: Booking) {
  return booking.departure_date || booking.trips?.start_date || null;
}

function pickup(booking: Booking) {
  return booking.pickup_point || booking.pickup_location || '';
}

function optionLabel(booking: Booking) {
  if (booking.payment_mode === 'cash') return 'Pay in Person';
  if (
    booking.payment_method === 'seat_lock' ||
    booking.booking_status === 'seat_locked' ||
    booking.booking_status === 'remaining_submitted'
  )
    return 'Seat Lock';
  if (booking.payment_method === 'full') return 'Full Payment';
  return booking.payment_method ? titleCase(booking.payment_method) : 'Not selected';
}

function optionKey(booking: Booking) {
  if (booking.payment_mode === 'cash') return 'cash';
  if (
    booking.payment_method === 'seat_lock' ||
    booking.booking_status === 'seat_locked' ||
    booking.booking_status === 'remaining_submitted'
  )
    return 'seat_lock';
  if (booking.payment_method === 'full') return 'full';
  return String(booking.payment_method || '').toLowerCase();
}

function methodKey(booking: Booking) {
  return String(
    booking.payment_mode || booking.payment_transactions?.[0]?.payment_mode || ''
  ).toLowerCase();
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
    (a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0];
}

function hasPendingTransaction(booking: Booking) {
  return (booking.payment_transactions || []).some(
    (p: any) => p.payment_status === 'pending'
  );
}

function needsReview(booking: Booking) {
  return (
    hasPendingTransaction(booking) ||
    (booking.payment_mode === 'cash' &&
      ['cash_pending', 'pending_cash'].includes(String(booking.payment_status)))
  );
}

function isReferralBooking(booking: Booking) {
  return Boolean(
    booking.booking_status === 'referred' ||
      booking.referral_partner ||
      Number(booking.referral_commission || 0) > 0
  );
}

function partnerLabel(booking: Booking) {
  return booking.referral_partner || 'Partner not set';
}

function commissionAmount(booking: Booking) {
  if (booking.referral_commission != null && booking.referral_commission !== '')
    return Number(booking.referral_commission);
  return null;
}

function paymentState(booking: Booking) {
  const pendingTxn = (booking.payment_transactions || []).find(
    (p: any) => p.payment_status === 'pending'
  );
  if (pendingTxn) return 'pending_verification';
  const rejectedTxn = latestTxn(booking)?.payment_status === 'rejected';
  if (rejectedTxn || booking.payment_status === 'rejected') return 'rejected';
  if (['failed', 'cancelled'].includes(String(booking.payment_status)))
    return String(booking.payment_status);
  if (['cash_pending', 'pending_cash'].includes(String(booking.payment_status)))
    return 'unpaid';
  const money = moneyOf(booking);
  if (money.refunded > 0 && money.paid <= 0.5) return 'refunded';
  if (money.refunded > 0) return 'partially_refunded';
  if (money.status === 'pending') return money.paid > 0 ? 'partial' : 'unpaid';
  return money.status;
}

function badgeClasses(kind: 'booking' | 'payment', status: string) {
  if (['paid', 'confirmed', 'verified'].includes(status))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['partial', 'seat_locked', 'remaining_submitted', 'pending'].includes(status))
    return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['pending_verification', 'referred', 'on_trip', 'completed'].includes(status))
    return 'bg-[#F3EEFF] text-[#7541F5] border-[#DDD6FE]';
  if (['failed', 'rejected', 'cancelled'].includes(status))
    return 'bg-rose-50 text-rose-700 border-rose-200';
  if (['refunded', 'partially_refunded'].includes(status))
    return 'bg-rose-50 text-rose-700 border-rose-200';
  return kind === 'payment'
    ? 'bg-slate-50 text-slate-700 border-slate-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';
}

function statusLabel(status: string, kind: 'booking' | 'payment' = 'payment') {
  if (kind === 'booking')
    return status === 'referred' ? 'Partner Booking' : bookingStatusLabel(status);
  if (status === 'pending_verification') return 'Pending Verification';
  if (status === 'unpaid') return 'Not Collected';
  if (status === 'partial') return 'Partial';
  return titleCase(status || 'pending');
}

function bookingStatus(booking: Booking) {
  if (isReferralBooking(booking) && booking.booking_status === 'referred')
    return 'confirmed';
  return effectiveBookingStatus(
    booking.booking_status || 'pending',
    departureDate(booking),
    booking.trips?.end_date
  );
}

function actionLabel(booking: Booking) {
  if (hasPendingTransaction(booking)) return 'Review Payment';
  if (
    booking.payment_mode === 'cash' &&
    ['cash_pending', 'pending_cash'].includes(String(booking.payment_status))
  )
    return 'Review Booking';
  return 'View';
}

function compactActionLabel(booking: Booking) {
  return actionLabel(booking).startsWith('Review') ? 'Review' : 'View';
}

function actionHref(booking: Booking) {
  return `/admin/bookings/${booking.id}`;
}

const selectClass =
  'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-none outline-none transition focus:border-[#7541F5] focus:ring-1 focus:ring-[#7541F5]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

function SortIcon() {
  return (
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
  const [quick, setQuick] = useState<FilterKey>(
    (initial('quick', 'all') as FilterKey) || 'all'
  );

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/bookings', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || 'Failed to fetch bookings');
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
    const next = params.toString()
      ? `/admin/bookings?${params.toString()}`
      : '/admin/bookings';
    router.replace(next, { scroll: false });
  }, [
    debouncedSearch,
    tripId,
    dateFrom,
    dateTo,
    bookingFilter,
    paymentFilter,
    methodFilter,
    optionFilter,
    sourceFilter,
    sortBy,
    quick,
    router,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    tripId,
    dateFrom,
    dateTo,
    bookingFilter,
    paymentFilter,
    methodFilter,
    optionFilter,
    sourceFilter,
    sortBy,
    quick,
  ]);

  const trips = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    bookings.forEach((b) => {
      if (b.trip_id)
        map.set(b.trip_id, {
          id: b.trip_id,
          label: b.trips?.title || b.trips?.destination || b.trip_id,
        });
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (debouncedSearch && !haystack.includes(debouncedSearch.toLowerCase()))
        return false;
      if (tripId !== 'all' && booking.trip_id !== tripId) return false;

      const dep = departureDate(booking);
      if (dateFrom && (!dep || dep < dateFrom)) return false;
      if (dateTo && (!dep || dep > dateTo)) return false;
      if (
        bookingFilter !== 'all' &&
        bookingStatus(booking) !== bookingFilter &&
        booking.booking_status !== bookingFilter
      )
        return false;
      if (paymentFilter !== 'all' && paymentState(booking) !== paymentFilter)
        return false;
      if (methodFilter !== 'all' && methodKey(booking) !== methodFilter)
        return false;
      if (optionFilter !== 'all' && optionKey(booking) !== optionFilter)
        return false;
      if (sourceFilter === 'direct' && isReferralBooking(booking)) return false;
      if (sourceFilter === 'referral' && !isReferralBooking(booking)) return false;
      if (quick === 'needs_review' && !needsReview(booking)) return false;
      if (quick === 'referrals' && !isReferralBooking(booking)) return false;
      if (
        ['pending', 'seat_locked', 'confirmed', 'cancelled'].includes(quick) &&
        booking.booking_status !== quick
      )
        return false;
      if (quick === 'upcoming') return dep ? new Date(dep) >= today : false;
      if (quick === 'today')
        return dep ? new Date(dep).toDateString() === today.toDateString() : false;
      if (quick === 'week') {
        if (!dep) return false;
        const d = new Date(dep);
        return d >= today && d <= weekEnd;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'departure_asc')
        return String(departureDate(a) || '').localeCompare(
          String(departureDate(b) || '')
        );
      if (sortBy === 'amount_desc') return moneyOf(b).owed - moneyOf(a).owed;
      if (sortBy === 'due_desc')
        return moneyOf(b).remaining - moneyOf(a).remaining;
      if (sortBy === 'status')
        return bookingStatus(a).localeCompare(bookingStatus(b));
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    return rows;
  }, [
    bookings,
    debouncedSearch,
    tripId,
    dateFrom,
    dateTo,
    bookingFilter,
    paymentFilter,
    methodFilter,
    optionFilter,
    sourceFilter,
    quick,
    sortBy,
  ]);

  const visibleMethods = paymentMethods.filter((method) =>
    bookings.some((b) => methodKey(b) === method)
  );
  const visibleOptions = paymentOptions.filter((option) =>
    bookings.some((b) => optionKey(b) === option)
  );

  const activeFilters = [
    debouncedSearch && `Search: ${debouncedSearch}`,
    tripId !== 'all' && `Trip: ${trips.find((t) => t.id === tripId)?.label || tripId}`,
    dateFrom && `From: ${fmtDate(dateFrom)}`,
    dateTo && `To: ${fmtDate(dateTo)}`,
    bookingFilter !== 'all' && `Booking: ${statusLabel(bookingFilter, 'booking')}`,
    paymentFilter !== 'all' && `Payment: ${statusLabel(paymentFilter)}`,
    methodFilter !== 'all' && `Method: ${titleCase(methodFilter)}`,
    optionFilter !== 'all' &&
      `Option: ${optionFilter === 'seat_lock' ? 'Seat Lock' : titleCase(optionFilter)}`,
    sourceFilter !== 'all' &&
      `Source: ${sourceFilter === 'referral' ? 'Partner Bookings' : 'Direct'}`,
    quick !== 'all' &&
      `Quick: ${quick === 'referrals' ? 'Partner Bookings' : titleCase(quick)}`,
  ].filter(Boolean) as string[];

  const activeAdvancedCount = [
    bookingFilter !== 'all',
    paymentFilter !== 'all',
    methodFilter !== 'all',
    optionFilter !== 'all',
    sourceFilter !== 'all',
    sortBy !== 'created_desc',
  ].filter(Boolean).length;

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
    setCurrentPage(1);
  };

  const openPaymentModal = (booking: Booking, transaction?: any) => {
    setSelectedBooking(booking);
    setSelectedTransaction(
      transaction ||
        (booking.payment_transactions || []).find(
          (p: any) => p.payment_status === 'pending'
        ) ||
        null
    );
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
    if (
      booking.payment_mode === 'cash' &&
      ['cash_pending', 'pending_cash'].includes(String(booking.payment_status))
    ) {
      openCashPaymentModal(booking);
      return;
    }
    router.push(actionHref(booking));
  };

  const handleReviewPayment = async (
    transaction: any,
    status: 'verified' | 'rejected'
  ) => {
    if (!transaction?.id) return alert('Invalid transaction data');
    if (status === 'rejected' && !rejectionReason)
      return alert('Please select a rejection reason');
    setReviewing(true);
    try {
      const response = await fetch(
        '/api/admin/bookings/review-payment-transaction',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: transaction.id,
            status,
            reviewNotes: reviewNotes || null,
            rejectionReason:
              status === 'rejected'
                ? rejectionReasons.find((r) => r.value === rejectionReason)?.label ||
                  rejectionReason
                : null,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || 'Failed to review payment');
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
    if (
      !selectedBooking ||
      !cashAmountPaid ||
      parseFloat(cashAmountPaid) <= 0
    )
      return alert('Please enter a valid amount');
    setApprovingCash(true);
    try {
      const response = await fetch(
        '/api/admin/bookings/approve-cash-payment',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: selectedBooking.id,
            amountPaid: parseFloat(cashAmountPaid),
            notes: cashNotes || null,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || 'Failed to approve cash payment');
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
      const response = await fetch(`/api/admin/bookings/${deleteBooking.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || 'Failed to delete booking');
      setToast({ type: 'success', message: 'Booking deleted.' });
      setDeleteBooking(null);
      await fetchBookings();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to delete booking',
      });
    } finally {
      setDeletingBookingId(null);
    }
  };

  const localPartnerCommission = bookings.reduce((sum, booking) => {
    const amount = commissionAmount(booking);
    return isReferralBooking(booking) && amount != null && Number.isFinite(amount)
      ? sum + amount
      : sum;
  }, 0);
  const localPartnerBookings = bookings.filter(isReferralBooking).length;

  const summaryData = summary
    ? {
        ...summary,
        referralCommission: {
          total: localPartnerCommission,
          count: localPartnerBookings,
        },
      }
    : {
        collected: bookings
          .filter((b) => activeBookingStatuses.includes(String(b.booking_status)))
          .reduce((sum, b) => sum + moneyOf(b).paid, 0),
        outstanding: bookings
          .filter((b) => activeBookingStatuses.includes(String(b.booking_status)))
          .reduce((sum, b) => sum + moneyOf(b).remaining, 0),
        needsReview: bookings.filter(needsReview).length,
        totalBookings: bookings.length,
        activeBookings: bookings.filter((b) =>
          activeBookingStatuses.includes(String(b.booking_status))
        ).length,
        byBookingStatus: {},
        referralCommission: {
          total: localPartnerCommission,
          count: localPartnerBookings,
        },
      };

  // Pagination calculations
  const totalCount = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, startIndex, endIndex]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [
        1,
        '...',
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages,
    ];
  }, [currentPage, totalPages]);

  const quickChips: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'needs_review', label: 'Needs Review' },
    { key: 'pending', label: 'Pending' },
    { key: 'seat_locked', label: 'Seat Locked' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'referrals', label: 'Partner Bookings' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
  ];

  const renderActionMenu = (booking: Booking) => (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRowMenu(rowMenu === booking.id ? null : booking.id);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition focus:outline-none"
        aria-label={`Booking actions for ${customerName(booking)}`}
        aria-haspopup="menu"
        aria-expanded={rowMenu === booking.id}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {rowMenu === booking.id && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white py-1 text-left text-xs shadow-xl animate-fade-in"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={actionHref(booking)}
            className="flex items-center gap-2 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 transition"
            role="menuitem"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            View Booking
          </Link>

          {hasPendingTransaction(booking) && (
            <button
              type="button"
              onClick={() => {
                setRowMenu(null);
                openPaymentModal(booking);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-[#7541F5] hover:bg-purple-50 transition"
              role="menuitem"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Review Payment
            </button>
          )}

          {booking.payment_mode === 'cash' &&
            ['cash_pending', 'pending_cash'].includes(
              String(booking.payment_status)
            ) && (
              <button
                type="button"
                onClick={() => {
                  setRowMenu(null);
                  openCashPaymentModal(booking);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-amber-700 hover:bg-amber-50 transition"
                role="menuitem"
              >
                <Banknote className="h-3.5 w-3.5" />
                Review Cash Payment
              </button>
            )}

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => requestDeleteBooking(booking)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 transition"
            role="menuitem"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Booking
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#7541F5] border border-[#DDD6FE]">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Bookings
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-normal">
              Manage bookings, payments and pending actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowOfflineModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#7541F5] hover:bg-[#6332DE] text-white text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add offline booking</span>
          </button>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards - 5 in one row on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Card 1: Collected */}
        <button
          onClick={() =>
            setPaymentFilter(paymentFilter === 'paid' ? 'all' : 'paid')
          }
          className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none ${
            paymentFilter === 'paid'
              ? 'border-emerald-300 ring-1 ring-emerald-200'
              : 'border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
            <IndianRupee className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Collected
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {fmtMoney(summaryData.collected)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              Successfully collected
            </p>
          </div>
        </button>

        {/* Card 2: Outstanding */}
        <button
          onClick={() =>
            setSortBy(sortBy === 'due_desc' ? 'created_desc' : 'due_desc')
          }
          className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none ${
            sortBy === 'due_desc'
              ? 'border-amber-300 ring-1 ring-amber-200'
              : 'border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Outstanding
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {fmtMoney(summaryData.outstanding)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              Across active bookings
            </p>
          </div>
        </button>

        {/* Card 3: Partner Commission */}
        <button
          onClick={() =>
            setQuick(quick === 'referrals' ? 'all' : 'referrals')
          }
          className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none ${
            quick === 'referrals'
              ? 'border-purple-300 ring-1 ring-purple-200'
              : 'border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3EEFF] text-[#7541F5] border border-[#DDD6FE]">
            <Gift className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Partner Commission
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-[#7541F5] tabular-nums">
              {fmtMoney(summaryData.referralCommission?.total || 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {summaryData.referralCommission?.count || 0} partner booking
              {Number(summaryData.referralCommission?.count || 0) === 1 ? '' : 's'}
            </p>
          </div>
        </button>

        {/* Card 4: Active / Total Bookings */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white text-left shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Active / Total Bookings
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {summaryData.activeBookings || 0} / {summaryData.totalBookings || 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              Confirmed {summaryData.byBookingStatus?.confirmed || 0} · Locked{' '}
              {summaryData.byBookingStatus?.seat_locked || 0} · Pending{' '}
              {summaryData.byBookingStatus?.pending || 0}
            </p>
          </div>
        </div>

        {/* Card 5: Needs Review */}
        <button
          onClick={() =>
            setQuick(quick === 'needs_review' ? 'all' : 'needs_review')
          }
          className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white text-left transition hover:border-purple-200 hover:shadow-sm focus:outline-none ${
            quick === 'needs_review'
              ? 'border-purple-300 ring-1 ring-purple-200'
              : summaryData.needsReview
              ? 'border-amber-200/80 bg-amber-50/20 shadow-xs'
              : 'border-slate-200/80 shadow-xs'
          }`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3EEFF] text-[#7541F5] border border-[#DDD6FE]">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Needs Review
            </p>
            <p className="mt-0.5 text-xl font-bold tracking-tight text-[#7541F5] tabular-nums">
              {summaryData.needsReview || 0}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {summaryData.needsReview
                ? 'Manual or cash review'
                : 'No pending reviews'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. Search and Filters Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-xs space-y-3">
        {/* Primary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone or booking ID"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8.5 pr-8 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#7541F5] focus:ring-1 focus:ring-[#7541F5]/20"
              aria-label="Search by customer name, email, phone or booking ID"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Trip Selector */}
          <div className="relative sm:col-span-1 lg:col-span-3">
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className={`${selectClass} appearance-none pr-8`}
              aria-label="Trip selector"
            >
              <option value="all">All trips</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.label}
                </option>
              ))}
            </select>
            <SortIcon />
          </div>

          {/* Departure From Date */}
          <div className="relative sm:col-span-1 lg:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectClass}
              title="Departure from date"
              aria-label="Departure from date"
            />
          </div>

          {/* Departure To Date */}
          <div className="relative sm:col-span-1 lg:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectClass}
              title="Departure to date"
              aria-label="Departure to date"
            />
          </div>

          {/* Advanced Filters Button */}
          <div className="sm:col-span-1 lg:col-span-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
              className={`h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition ${
                advancedFiltersOpen || activeAdvancedCount > 0
                  ? 'border-purple-300 bg-purple-50 text-[#7541F5]'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
              aria-label="Toggle advanced filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Filters</span>
              {activeAdvancedCount > 0 && (
                <span className="h-4 w-4 rounded-full bg-[#7541F5] text-white text-[10px] font-bold flex items-center justify-center">
                  {activeAdvancedCount}
                </span>
              )}
            </button>

            {/* Mobile Filter Sheet Button */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
              aria-label="Open mobile filter sheet"
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {quickChips.map((chip) => {
            const active = quick === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setQuick(chip.key)}
                className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-[#F3EEFF] text-[#7541F5] font-semibold border border-[#DDD6FE]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {advancedFiltersOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 animate-slide-down">
            {/* Booking Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Booking Status
              </label>
              <div className="relative">
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="all">All statuses</option>
                  {bookingStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, 'booking')}
                    </option>
                  ))}
                </select>
                <SortIcon />
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Payment Status
              </label>
              <div className="relative">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="all">All payment statuses</option>
                  {paymentStates.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <SortIcon />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Payment Method
              </label>
              <div className="relative">
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="all">All methods</option>
                  {visibleMethods.map((m) => (
                    <option key={m} value={m}>
                      {m === 'manual'
                        ? 'Manual UPI / QR'
                        : m === 'cash'
                        ? 'Cash / Offline'
                        : titleCase(m)}
                    </option>
                  ))}
                </select>
                <SortIcon />
              </div>
            </div>

            {/* Payment Option */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Payment Option
              </label>
              <div className="relative">
                <select
                  value={optionFilter}
                  onChange={(e) => setOptionFilter(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="all">All options</option>
                  {visibleOptions.map((o) => (
                    <option key={o} value={o}>
                      {o === 'seat_lock' ? 'Seat Lock' : 'Full Payment'}
                    </option>
                  ))}
                  {bookings.some((b) => b.payment_mode === 'cash') && (
                    <option value="cash">Pay in Person</option>
                  )}
                </select>
                <SortIcon />
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Sort Bookings
              </label>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="created_desc">Newest booked</option>
                  <option value="departure_asc">Departure date</option>
                  <option value="amount_desc">Highest total</option>
                  <option value="due_desc">Highest due</option>
                  <option value="status">Booking status</option>
                </select>
                <SortIcon />
              </div>
            </div>

            {/* Booking Source */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Booking Source
              </label>
              <div className="relative">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className={`${selectClass} appearance-none pr-8`}
                >
                  <option value="all">All sources</option>
                  <option value="direct">Direct</option>
                  <option value="referral">Partner Bookings</option>
                </select>
                <SortIcon />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips with Clear all */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs border-t border-slate-100">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Active:
            </span>
            {activeFilters.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
              >
                {item}
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-[#7541F5] hover:text-[#5B21B6] ml-1 transition"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              onClick={fetchBookings}
              className="rounded-lg bg-white px-3 py-1.5 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* 4. Desktop Booking Table (7 columns) */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold tracking-wider text-slate-500 uppercase h-10 select-none">
                <th className="px-4 py-2 w-[22%]">Booking & Customer</th>
                <th className="px-3 py-2 w-[20%]">Trip</th>
                <th className="px-3 py-2 w-[16%]">Financials</th>
                <th className="px-3 py-2 w-[15%]">Payment / Operator</th>
                <th className="px-3 py-2 w-[12%]">Partner / Source</th>
                <th className="px-3 py-2 w-[8%]">Status</th>
                <th className="px-4 py-2 w-[7%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="h-[100px] animate-pulse">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200" />
                        <div className="space-y-2 flex-1">
                          <div className="h-3.5 bg-slate-200 rounded w-1/4" />
                          <div className="h-3 bg-slate-100 rounded w-1/3" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
                paginatedBookings.map((booking) => {
                  const money = moneyOf(booking);
                  const payState = paymentState(booking);
                  const bookState = bookingStatus(booking);
                  const pendingTxn = (booking.payment_transactions || []).find(
                    (p: any) => p.payment_status === 'pending'
                  );
                  const referral = isReferralBooking(booking);
                  const amount = commissionAmount(booking);
                  const hasReview = needsReview(booking);

                  return (
                    <tr
                      key={booking.id}
                      onClick={() => router.push(actionHref(booking))}
                      className={`h-[100px] hover:bg-[#FAF9FD]/80 transition-colors cursor-pointer group ${
                        hasReview
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/15'
                          : referral
                          ? 'border-l-4 border-l-[#7541F5] bg-purple-50/15'
                          : ''
                      }`}
                    >
                      {/* Column 1: Booking & Customer */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-start gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#F3EEFF] text-[#7541F5] font-bold text-xs flex items-center justify-center shrink-0 border border-[#DDD6FE] mt-0.5">
                            {customerInitials(customerName(booking))}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-semibold text-sm text-slate-900 truncate"
                                title={customerName(booking)}
                              >
                                {customerName(booking)}
                              </span>
                              {referral && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-[#7541F5] border border-purple-200 text-[10px] font-semibold shrink-0">
                                  Partner
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-slate-400 tracking-tight mt-0.5">
                              #{booking.id.slice(0, 8)}
                            </div>
                            <div
                              className="text-xs text-slate-500 truncate mt-0.5"
                              title={customerContact(booking)}
                            >
                              {customerContact(booking)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Booked {fmtDate(booking.created_at, true)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Trip */}
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-0">
                          <div
                            className="font-semibold text-sm text-slate-900 truncate"
                            title={booking.trips?.title}
                          >
                            {booking.trips?.title || 'Trip not found'}
                          </div>
                          <div className="text-xs font-semibold text-[#7541F5] flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            <span>{fmtDate(departureDate(booking))}</span>
                          </div>
                          <div
                            className="text-xs text-slate-500 truncate mt-0.5"
                            title={pickup(booking)}
                          >
                            {pickup(booking) ||
                              booking.trips?.destination ||
                              'Pickup not recorded'}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3 text-slate-400" />
                            <span>
                              {booking.number_of_participants || 1} traveller
                              {Number(booking.number_of_participants || 1) > 1
                                ? 's'
                                : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Financials */}
                      <td className="px-3 py-3 align-middle text-xs tabular-nums">
                        {referral ? (
                          <div className="rounded-lg bg-purple-50/70 border border-purple-100 p-2">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7541F5]">
                              Our Commission
                            </span>
                            {amount == null ? (
                              <span className="text-xs text-slate-500 font-medium">
                                Not set
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-[#7541F5]">
                                {fmtMoney(amount)}
                              </span>
                            )}
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              Partner operated
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-3 text-slate-500">
                              <span>Total:</span>
                              <span className="font-semibold text-slate-900">
                                {fmtMoney(money.owed)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-slate-500">
                              <span>Paid:</span>
                              <span
                                className={`font-semibold ${
                                  money.paid > 0
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              >
                                {fmtMoney(money.paid)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-slate-500">
                              <span>Due:</span>
                              <span
                                className={`font-semibold ${
                                  money.remaining > 0
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {money.remaining > 0
                                  ? fmtMoney(money.remaining)
                                  : 'Paid'}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Payment / Operator */}
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-0">
                          {referral ? (
                            <>
                              <div
                                className="text-xs font-semibold text-slate-900 truncate"
                                title={partnerLabel(booking)}
                              >
                                {partnerLabel(booking)}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Partner-operated
                              </div>
                              <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-[#7541F5] border border-purple-200">
                                Partner Booking
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-semibold text-slate-800">
                                {optionLabel(booking)}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                {methodKey(booking) === 'razorpay' ? (
                                  <CreditCard className="h-3 w-3" />
                                ) : methodKey(booking) === 'cash' ? (
                                  <Banknote className="h-3 w-3" />
                                ) : (
                                  <Smartphone className="h-3 w-3" />
                                )}
                                <span>{methodLabel(booking)}</span>
                              </div>
                              <span
                                className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClasses(
                                  'payment',
                                  payState
                                )}`}
                              >
                                {statusLabel(payState)}
                              </span>
                              {pendingTxn?.amount && (
                                <div className="text-[10px] font-semibold text-[#7541F5] mt-0.5">
                                  Submitted {fmtMoney(Number(pendingTxn.amount))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Partner / Source */}
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-0">
                          {referral ? (
                            <>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-[#7541F5] border border-purple-200">
                                Partner Booking
                              </span>
                              <div
                                className="text-xs font-semibold text-slate-800 truncate mt-1"
                                title={partnerLabel(booking)}
                              >
                                {partnerLabel(booking)}
                              </div>
                              {amount != null && (
                                <div className="text-[11px] text-slate-500">
                                  Comm:{' '}
                                  <span className="font-semibold text-[#7541F5]">
                                    {fmtMoney(amount)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Direct Booking
                              </span>
                              <div className="text-[11px] text-slate-400 mt-1">
                                Managed by Ghumakkars
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Column 6: Status */}
                      <td className="px-3 py-3 align-middle">
                        <div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClasses(
                              'booking',
                              bookState
                            )}`}
                          >
                            {statusLabel(bookState, 'booking')}
                          </span>
                          {hasReview && (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 mt-1.5">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span>Needs Review</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 7: Actions */}
                      <td
                        className="px-4 py-3 align-middle text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrimaryAction(booking)}
                            className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition ${
                              hasReview
                                ? 'bg-[#7541F5] hover:bg-[#6332DE] text-white shadow-xs'
                                : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {compactActionLabel(booking)}
                          </button>
                          {renderActionMenu(booking)}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading && filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <p className="font-medium">No bookings found.</p>
                    {activeFilters.length > 0 && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-xs font-semibold text-[#7541F5] hover:underline"
                      >
                        Clear active filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!loading && filteredBookings.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>
                Showing{' '}
                <span className="font-semibold text-slate-900">
                  {totalCount === 0 ? 0 : startIndex + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-900">
                  {endIndex}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-900">
                  {totalCount}
                </span>{' '}
                bookings
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1 self-center sm:self-auto">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((page, i) =>
                  typeof page === 'number' ? (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                        currentPage === page
                          ? 'bg-[#7541F5] text-white shadow-xs'
                          : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={i} className="px-1 text-slate-400">
                      ...
                    </span>
                  )
                )}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Mobile & Tablet Card Layout (< 1024px) */}
      <div className="space-y-3 lg:hidden">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}

        {!loading &&
          paginatedBookings.map((booking) => {
            const money = moneyOf(booking);
            const payState = paymentState(booking);
            const bookState = bookingStatus(booking);
            const referral = isReferralBooking(booking);
            const amount = commissionAmount(booking);
            const hasReview = needsReview(booking);

            return (
              <article
                key={booking.id}
                className={`rounded-xl border bg-white shadow-xs overflow-hidden ${
                  hasReview
                    ? 'border-l-4 border-l-amber-400'
                    : referral
                    ? 'border-l-4 border-l-[#7541F5]'
                    : 'border-slate-200/80'
                }`}
              >
                {/* Card Top: Customer & Status */}
                <div
                  onClick={() => router.push(actionHref(booking))}
                  className="p-3.5 pb-2 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[#F3EEFF] text-[#7541F5] font-bold text-xs flex items-center justify-center shrink-0 border border-[#DDD6FE]">
                        {customerInitials(customerName(booking))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-semibold text-sm text-slate-900 truncate">
                            {customerName(booking)}
                          </h2>
                          {referral && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-[#7541F5] border border-purple-200 text-[10px] font-semibold shrink-0">
                              Partner
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-slate-400">
                          #{booking.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClasses(
                        'booking',
                        bookState
                      )}`}
                    >
                      {statusLabel(bookState, 'booking')}
                    </span>
                  </div>

                  {/* Trip Details */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <p className="font-semibold text-xs text-slate-900 truncate">
                      {booking.trips?.title || 'Trip not found'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-[#7541F5] flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(departureDate(booking))}
                      </span>
                      <span>
                        {pickup(booking) ||
                          booking.trips?.destination ||
                          'Pickup not recorded'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {booking.number_of_participants || 1} traveller
                        {Number(booking.number_of_participants || 1) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Financials / Commission */}
                  <div className="mt-2.5 rounded-lg bg-slate-50/70 p-2.5 border border-slate-100 text-xs">
                    {referral ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7541F5]">
                            Our Commission
                          </span>
                          <span className="font-bold text-[#7541F5] tabular-nums">
                            {amount == null ? 'Not set' : fmtMoney(amount)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Operated by {partnerLabel(booking)}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 tabular-nums text-center">
                        <div>
                          <span className="block text-[10px] font-medium text-slate-400 uppercase">
                            Total
                          </span>
                          <span className="font-semibold text-slate-900">
                            {fmtMoney(money.owed)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-medium text-slate-400 uppercase">
                            Paid
                          </span>
                          <span
                            className={`font-semibold ${
                              money.paid > 0
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {fmtMoney(money.paid)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-medium text-slate-400 uppercase">
                            Due
                          </span>
                          <span
                            className={`font-semibold ${
                              money.remaining > 0
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {money.remaining > 0
                              ? fmtMoney(money.remaining)
                              : 'Paid'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment option & method */}
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {optionLabel(booking)} · {methodLabel(booking)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClasses(
                        'payment',
                        payState
                      )}`}
                    >
                      {statusLabel(payState)}
                    </span>
                  </div>
                </div>

                {/* Card Actions Bottom Bar */}
                <div className="p-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    {fmtDate(booking.created_at, true)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrimaryAction(booking)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold transition ${
                        hasReview
                          ? 'bg-[#7541F5] hover:bg-[#6332DE] text-white shadow-xs'
                          : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {actionLabel(booking)}
                    </button>
                    {renderActionMenu(booking)}
                  </div>
                </div>
              </article>
            );
          })}

        {!loading && filteredBookings.length === 0 && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-500">
            <p className="font-medium">No bookings match the active filters.</p>
            {activeFilters.length > 0 && (
              <button
                onClick={clearFilters}
                className="mt-2 font-semibold text-[#7541F5] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Mobile Pagination */}
        {!loading && filteredBookings.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-600">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Mobile Filters Drawer Sheet */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Booking filters"
        >
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Filters</h2>
                <p className="text-xs text-slate-500">
                  Refine bookings by trip, dates and statuses
                </p>
              </div>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trip
                </label>
                <select
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All trips</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departure From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={selectClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departure To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={selectClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Booking Status
                </label>
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All statuses</option>
                  {bookingStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s, 'booking')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All payment statuses</option>
                  {paymentStates.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All methods</option>
                  {visibleMethods.map((m) => (
                    <option key={m} value={m}>
                      {m === 'manual'
                        ? 'Manual UPI / QR'
                        : m === 'cash'
                        ? 'Cash / Offline'
                        : titleCase(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={selectClass}
                >
                  <option value="created_desc">Newest booked</option>
                  <option value="departure_asc">Departure date</option>
                  <option value="amount_desc">Highest total</option>
                  <option value="due_desc">Highest due</option>
                  <option value="status">Booking status</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white p-4">
              <button
                onClick={clearFilters}
                className="h-10 flex-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear all
              </button>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="h-10 flex-1 rounded-lg bg-[#7541F5] hover:bg-[#6332DE] text-xs font-bold text-white shadow-xs"
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Delete Booking Confirmation Modal */}
      {deleteBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-xs p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-booking-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2
                  id="delete-booking-title"
                  className="text-base font-bold text-slate-900"
                >
                  Delete booking?
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Permanently delete booking #{deleteBooking.id.slice(0, 8)} for{' '}
                  <span className="font-semibold text-slate-700">
                    {customerName(deleteBooking)}
                  </span>
                  . This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingBookingId)}
                onClick={() => setDeleteBooking(null)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingBookingId)}
                onClick={confirmDeleteBooking}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingBookingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Offline Booking Modal */}
      {showOfflineModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-xs p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-booking-title"
        >
          <div className="my-6 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
              <div>
                <h2
                  id="offline-booking-title"
                  className="text-base font-bold text-slate-900"
                >
                  Add offline booking
                </h2>
                <p className="text-xs text-slate-500">
                  Choose trip, batch, passenger details, add-ons and collected
                  amount.
                </p>
              </div>
              <button
                onClick={() => setShowOfflineModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close offline booking modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <OfflineBookingForm
                onCreated={async () => {
                  setShowOfflineModal(false);
                  setToast({
                    type: 'success',
                    message: 'Offline booking added.',
                  });
                  await fetchBookings();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. Review Payment Modal */}
      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl border border-slate-200">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Review Payment
                </h2>
                <p className="text-xs text-slate-500">
                  {customerName(selectedBooking)} · #{selectedBooking.id.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 p-4">
              {(selectedBooking.payment_transactions || []).map(
                (transaction: any) => (
                  <button
                    key={transaction.id}
                    onClick={() => setSelectedTransaction(transaction)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedTransaction?.id === transaction.id
                        ? 'border-purple-300 bg-purple-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-xs text-slate-900">
                          {transaction.transaction_id || 'No transaction ID'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {methodLabel({
                            payment_mode: transaction.payment_mode,
                          })}{' '}
                          · {titleCase(transaction.payment_type || 'payment')}
                        </p>
                        {transaction.rejection_reason && (
                          <p className="mt-1 text-xs text-rose-600">
                            {transaction.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold tabular-nums text-xs text-slate-900">
                          {fmtMoney(Number(transaction.amount || 0))}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClasses(
                            'payment',
                            transaction.payment_status
                          )}`}
                        >
                          {statusLabel(transaction.payment_status)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              )}

              {selectedTransaction?.payment_status === 'pending' ? (
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3.5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Review notes (optional)
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-[#7541F5]"
                      placeholder="Add an internal note..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Rejection reason (if rejecting)
                    </label>
                    <select
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className={selectClass}
                    >
                      {rejectionReasons.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      disabled={reviewing}
                      onClick={() =>
                        handleReviewPayment(selectedTransaction, 'verified')
                      }
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white disabled:opacity-60 shadow-xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Verify Payment
                    </button>
                    <button
                      disabled={reviewing}
                      onClick={() =>
                        handleReviewPayment(selectedTransaction, 'rejected')
                      }
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white disabled:opacity-60 shadow-xs"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject Payment
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  {selectedTransaction
                    ? 'This transaction is not pending review.'
                    : 'Select a pending transaction to review.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. Review Cash Payment Modal */}
      {showCashPaymentModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-base font-bold text-slate-900">
                Review Cash Payment
              </h2>
              <button
                onClick={() => setShowCashPaymentModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                <p className="font-semibold text-slate-900">
                  {customerName(selectedBooking)}
                </p>
                <p className="mt-0.5 text-slate-500">
                  Outstanding: {fmtMoney(moneyOf(selectedBooking).remaining)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount received (₹)
                </label>
                <input
                  type="number"
                  value={cashAmountPaid}
                  onChange={(e) => setCashAmountPaid(e.target.value)}
                  className={selectClass}
                  placeholder="Enter collected amount"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-[#7541F5]"
                  placeholder="Collected in cash by..."
                />
              </div>

              <button
                disabled={approvingCash}
                onClick={handleApproveCashPayment}
                className="h-9 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white disabled:opacity-60 shadow-xs"
              >
                Approve Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Toast Notifications */}
      {toast && (
        <div
          className={`fixed right-4 top-16 z-50 w-full max-w-sm rounded-xl border bg-white p-3.5 text-xs font-semibold shadow-xl transition-all ${
            toast.type === 'success'
              ? 'border-emerald-200 text-emerald-800'
              : 'border-rose-200 text-rose-800'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
