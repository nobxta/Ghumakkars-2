'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Calendar, User, MapPin, IndianRupee, CheckCircle, Clock, XCircle, Filter, Eye, X, Check, Image as ImageIcon, Mail, Phone, Heart, GraduationCap, Users, AlertCircle, CreditCard, Search, TrendingUp, DollarSign, AlertTriangle, RefreshCw, Banknote, Smartphone, Lock, Wallet, MoreVertical } from 'lucide-react';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'seat_locked' | 'pending' | 'cancelled'>('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('fake_payment');
  const [cashAmountPaid, setCashAmountPaid] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [approvingCash, setApprovingCash] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [selectedTripId, setSelectedTripId] = useState<string>('all');
  const [trips, setTrips] = useState<any[]>([]);
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<'none' | 'today' | 'week' | 'pending_payment' | 'upcoming'>('none');
  const supabase = createClient();

  const rejectionReasons = [
    { value: 'fake_payment', label: 'Fake Payment / Invalid Transaction ID' },
    { value: 'fake_details', label: 'Fake Details / Invalid Information' },
    { value: 'seats_full', label: 'Seats Full' },
    { value: 'other', label: 'Other (specify in notes)' },
  ];

  useEffect(() => {
    fetchBookings();
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, destination')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      setError(null);
      // Use API route that uses admin client
      const response = await fetch('/api/admin/bookings');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch bookings');
      }

      const { bookings: data } = await response.json();
      setBookings(data || []);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      setError(`Error loading bookings: ${error.message || 'Unknown error'}`);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
    seatLocked: bookings.filter(b => b.booking_status === 'seat_locked').length,
    pending: bookings.filter(b => b.booking_status === 'pending').length,
    cancelled: bookings.filter(b => b.booking_status === 'cancelled').length,
    pendingPayments: bookings.filter(b => 
      (b.payment_status === 'pending' || b.payment_status === 'cash_pending') || 
      (b.payment_transactions && b.payment_transactions.some((p: any) => p.payment_status === 'pending'))
    ).length,
    cashPending: bookings.filter(b => b.payment_mode === 'cash' && b.payment_status === 'cash_pending').length,
    manualPending: bookings.filter(b => b.payment_mode === 'manual' && (b.payment_status === 'pending' || b.reference_id)).length,
    razorpayPending: bookings.filter(b => 
      b.payment_mode === 'razorpay' && 
      (b.payment_status === 'pending' || 
       (b.payment_transactions && b.payment_transactions.some((p: any) => p.payment_status === 'pending' && p.payment_mode === 'razorpay')))
    ).length,
  };

  // Money actually received for a booking. Online bookings track it as
  // verified payment transactions (UPI/manual you approved); offline bookings
  // track it on amount_paid.
  const paidOf = (b: any): number => {
    if (b.is_offline_booking || !b.user_id) return parseFloat(b.amount_paid || 0);
    const txnPaid = (b.payment_transactions || [])
      .filter((p: any) => p.payment_status === 'verified')
      .reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0);
    return txnPaid || parseFloat(b.amount_paid || 0);
  };

  // Full amount owed after the customer's coupon + wallet discounts.
  const fullOf = (b: any): number => {
    const pax = Number(b.number_of_participants) || 1;
    const coupon = parseFloat(b.coupon_discount || 0);
    const wallet = parseFloat(b.wallet_amount_used || 0);
    // Seat-lock: total_price / final_amount only hold the DEPOSIT, so the full
    // trip cost must come from the list price x participants.
    if (b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked') {
      const gross = (Number(b.trips?.discounted_price) || 0) * pax;
      return Math.max(0, gross - coupon - wallet);
    }
    // Full-payment: final_amount is already the net (post-discount) total owed.
    const fa = parseFloat(b.final_amount || 0);
    if (fa > 0) return fa;
    const gross = parseFloat(b.total_price || 0) || (Number(b.trips?.discounted_price) || 0) * pax;
    return Math.max(0, gross - coupon - wallet);
  };

  // Revenue = money actually collected on active (non-cancelled) bookings,
  // including the deposit on seat-locked bookings.
  const confirmedRevenue = bookings
    .filter(b => b.booking_status === 'confirmed')
    .reduce((sum, b) => sum + paidOf(b), 0);

  const seatLockRevenue = bookings
    .filter(b => b.booking_status === 'seat_locked')
    .reduce((sum, b) => sum + paidOf(b), 0);

  const totalRevenue = confirmedRevenue + seatLockRevenue;

  // Pending = balance still left to pay across all active bookings (e.g. the
  // remaining amount on a seat-locked booking).
  const pendingRevenue = bookings
    .filter(b => !['cancelled', 'rejected'].includes(b.booking_status))
    .reduce((sum, b) => sum + Math.max(0, fullOf(b) - paidOf(b)), 0);

  const needsAttention = bookings.filter(b =>
    b.payment_transactions?.some((p: any) => p.payment_status === 'pending') ||
    (b.booking_status === 'pending' && b.payment_mode !== 'razorpay')
  ).length;

  const conversionRate = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;

  // Get filtered bookings by trip first (for count calculations)
  const tripFilteredBookings = selectedTripId !== 'all' 
    ? bookings.filter(b => b.trip_id === selectedTripId)
    : bookings;

  // Calculate counts for selected trip
  const tripStats = {
    total: tripFilteredBookings.length,
    confirmed: tripFilteredBookings.filter(b => b.booking_status === 'confirmed').length,
    seatLocked: tripFilteredBookings.filter(b => b.booking_status === 'seat_locked').length,
    pending: tripFilteredBookings.filter(b => b.booking_status === 'pending').length,
    cancelled: tripFilteredBookings.filter(b => b.booking_status === 'cancelled').length,
  };

  // Filter and search bookings
  let filteredBookings = tripFilteredBookings;

  // Filter by status
  if (filter !== 'all') {
    filteredBookings = filteredBookings.filter(b => b.booking_status === filter);
  }

  // Quick filters (Today / This week / Pending payment / Upcoming)
  if (quickFilter !== 'none') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    filteredBookings = filteredBookings.filter(b => {
      if (quickFilter === 'today') {
        const c = new Date(b.created_at);
        return c >= startOfToday;
      }
      if (quickFilter === 'week') {
        const c = new Date(b.created_at);
        return c >= startOfWeek;
      }
      if (quickFilter === 'pending_payment') {
        return Math.max(0, fullOf(b) - paidOf(b)) > 0 && !['cancelled', 'rejected'].includes(b.booking_status);
      }
      if (quickFilter === 'upcoming') {
        const dep = b.departure_date || b.trips?.start_date;
        return dep ? new Date(dep) >= startOfToday : false;
      }
      return true;
    });
  }

  // Apply search
  if (searchTerm) {
    filteredBookings = filteredBookings.filter(b => {
      const searchLower = searchTerm.toLowerCase();
      return (
        b.trips?.title?.toLowerCase().includes(searchLower) ||
        b.trips?.destination?.toLowerCase().includes(searchLower) ||
        b.primary_passenger_name?.toLowerCase().includes(searchLower) ||
        b.primary_passenger_email?.toLowerCase().includes(searchLower) ||
        b.profiles?.email?.toLowerCase().includes(searchLower) ||
        b.profiles?.first_name?.toLowerCase().includes(searchLower) ||
        b.profiles?.last_name?.toLowerCase().includes(searchLower) ||
        b.reference_id?.toLowerCase().includes(searchLower) ||
        b.id.toLowerCase().includes(searchLower)
      );
    });
  }

  // Sort bookings
  filteredBookings = [...filteredBookings].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return parseFloat(b.final_amount || b.total_price || 0) - parseFloat(a.final_amount || a.total_price || 0);
      case 'status':
        const statusOrder = { 'pending': 0, 'seat_locked': 1, 'confirmed': 2, 'cancelled': 3 };
        return (statusOrder[a.booking_status as keyof typeof statusOrder] || 99) - (statusOrder[b.booking_status as keyof typeof statusOrder] || 99);
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'seat_locked':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
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
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };


  const handleReviewPayment = async (transaction: any, status: 'verified' | 'rejected') => {
    if (status === 'rejected' && !rejectionReason) {
      alert('Please select a rejection reason');
      return;
    }

    if (!transaction || !transaction.id) {
      alert('Invalid transaction data');
      return;
    }

    console.log('Reviewing payment transaction:', { transactionId: transaction.id, status, rejectionReason });
    
    setReviewing(true);
    try {
      // Use API route for payment transaction review
      const reviewResponse = await fetch('/api/admin/bookings/review-payment-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: transaction.id,
          status: status,
          reviewNotes: reviewNotes || null,
          rejectionReason: status === 'rejected' 
            ? (rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason)
            : null,
        }),
      });

      const reviewData = await reviewResponse.json();

      if (!reviewResponse.ok) {
        throw new Error(reviewData.error || 'Failed to review payment');
      }

      // Send email notification if needed
      try {
        const userEmail = selectedBooking?.primary_passenger_email || selectedBooking?.profiles?.email;
        const userName = selectedBooking?.primary_passenger_name || 
          (selectedBooking?.profiles 
            ? `${selectedBooking.profiles.first_name || ''} ${selectedBooking.profiles.last_name || ''}`.trim()
            : '') || 'User';
        
        if (userEmail && status === 'rejected') {
          await fetch('/api/bookings/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: selectedBooking?.id,
              status: 'rejected',
              rejectionReason: rejectionReasons.find(r => r.value === rejectionReason)?.label || rejectionReason,
              tripDetails: selectedBooking?.trips,
              userEmail,
              userName,
            }),
          });
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
      }

      // Refresh bookings
      await fetchBookings();
      setShowPaymentModal(false);
      setSelectedBooking(null);
      setSelectedTransaction(null);
      setReviewNotes('');
      setRejectionReason('fake_payment');
      
      // Show success message
      alert(`Payment transaction ${status === 'verified' ? 'verified' : 'rejected'} successfully!`);
    } catch (error: any) {
      console.error('Error reviewing payment:', error);
      alert(error.message || 'Failed to update payment status');
    } finally {
      setReviewing(false);
    }
  };

  const openPaymentModal = (booking: any) => {
    setSelectedBooking(booking);
    setSelectedTransaction(null);
    setShowPaymentModal(true);
    setReviewNotes('');
    setRejectionReason('fake_payment'); // Reset to default
    setReviewing(false); // Reset reviewing state
  };

  const handleDeleteBooking = async (booking: any) => {
    const name = booking.primary_passenger_name || booking.profiles?.email || 'this booking';
    const isCounted = ['confirmed', 'seat_locked'].includes(booking.booking_status);
    const msg =
      `Permanently delete the booking for "${name}"?\n\n` +
      `• Trip: ${booking.trips?.title || '—'}\n` +
      `• Status: ${booking.booking_status}\n` +
      `• All payment records for this booking will also be deleted.\n` +
      (isCounted ? `• ${booking.number_of_participants || 1} seat(s) will be freed on the trip.\n` : '') +
      `\nThis cannot be undone. Use this only for spam or test bookings.`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to delete booking');
        return;
      }
      alert('Booking deleted');
      fetchBookings();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const openTransactionModal = (booking: any, transaction: any) => {
    setSelectedBooking(booking);
    setSelectedTransaction(transaction);
    setShowPaymentModal(true);
    setReviewNotes('');
    setRejectionReason('fake_payment');
    setReviewing(false);
  };

  const openCashPaymentModal = (booking: any) => {
    setSelectedBooking(booking);
    setCashAmountPaid(booking.final_amount || booking.total_price || '');
    setCashNotes('');
    setShowCashPaymentModal(true);
  };

  const handleApproveCashPayment = async () => {
    if (!cashAmountPaid || parseFloat(cashAmountPaid) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!selectedBooking) {
      alert('No booking selected');
      return;
    }

    setApprovingCash(true);
    try {
      const response = await fetch('/api/admin/bookings/approve-cash-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          amountPaid: parseFloat(cashAmountPaid),
          notes: cashNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve cash payment');
      }

      alert('Cash payment approved successfully!');
      setShowCashPaymentModal(false);
      setSelectedBooking(null);
      setCashAmountPaid('');
      setCashNotes('');
      await fetchBookings();
    } catch (error: any) {
      console.error('Error approving cash payment:', error);
      alert(error.message || 'Failed to approve cash payment');
    } finally {
      setApprovingCash(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading bookings...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">All Bookings</h1>
        <p className="text-[11px] sm:text-xs text-gray-500">Manage all trip bookings</p>
      </div>

      {/* Compact KPI strip */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100">
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-gray-500"><DollarSign className="h-3.5 w-3.5 text-green-600" /><span className="text-[10px] font-semibold uppercase tracking-wide">Revenue</span></div>
          <p className="text-lg font-bold text-gray-900 leading-tight">₹{totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-400">collected</p>
        </div>
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-gray-500"><Clock className="h-3.5 w-3.5 text-amber-600" /><span className="text-[10px] font-semibold uppercase tracking-wide">Pending</span></div>
          <p className="text-lg font-bold text-gray-900 leading-tight">₹{pendingRevenue.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-400">balance to collect</p>
        </div>
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-gray-500"><AlertCircle className={`h-3.5 w-3.5 ${needsAttention > 0 ? 'text-orange-600' : 'text-gray-400'}`} /><span className="text-[10px] font-semibold uppercase tracking-wide">Attention</span></div>
          <p className="text-lg font-bold text-gray-900 leading-tight">{needsAttention}</p>
          <p className="text-[11px] text-gray-400">{needsAttention === 0 ? 'all caught up' : 'to verify'}</p>
        </div>
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-gray-500"><Calendar className="h-3.5 w-3.5 text-purple-600" /><span className="text-[10px] font-semibold uppercase tracking-wide">Bookings</span></div>
          <p className="text-lg font-bold text-gray-900 leading-tight">{stats.total}</p>
          <p className="text-[11px] text-gray-400">{stats.confirmed} confirmed · {conversionRate}%</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={fetchBookings}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Toolbar: search + filters + actions in one row */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer, email or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm text-gray-900"
            />
          </div>
          <select
            value={selectedTripId}
            onChange={(e) => { setSelectedTripId(e.target.value); setFilter('all'); }}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 outline-none text-sm text-gray-900 font-medium bg-white max-w-[220px]"
          >
            <option value="all">All trips</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.title} - {trip.destination}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-400 outline-none text-sm text-gray-900 font-medium bg-white"
          >
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="status">Sort: Status</option>
          </select>
          <button
            onClick={fetchBookings}
            className="sm:ml-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
            Refresh
          </button>
        </div>

        {/* Status segmented control */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {([
              ['all', `All (${tripStats.total})`],
              ['pending', `Pending (${tripStats.pending})`],
              ['confirmed', `Confirmed (${tripStats.confirmed})`],
              ['seat_locked', `Seat locked (${tripStats.seatLocked})`],
              ['cancelled', `Cancelled (${tripStats.cancelled})`],
            ] as const).map(([val, label], i) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200' : ''} ${
                  filter === val ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quick filters */}
          <span className="hidden sm:inline h-5 w-px bg-gray-200 mx-1" />
          {([
            ['today', 'Today'],
            ['week', 'This week'],
            ['pending_payment', 'Pending payment'],
            ['upcoming', 'Upcoming'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setQuickFilter(quickFilter === val ? 'none' : val)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                quickFilter === val ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table - Compact Design */}
      <div className="bg-white rounded-xl sm:rounded-2xl border sm:border-2 border-purple-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gradient-to-r from-purple-50 via-purple-100 to-purple-50 border-b-2 border-purple-200">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">Booking</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">Amount & Details</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBookings.map((booking, index) => {
                const hasPendingPayment = (booking.payment_status === 'pending' || booking.payment_status === 'cash_pending') || 
                  (booking.payment_transactions && booking.payment_transactions.some((p: any) => p.payment_status === 'pending'));
                const isUrgent = hasPendingPayment && booking.booking_status !== 'cancelled';
                
                return (
                <tr 
                  key={booking.id} 
                    className={`transition-all hover:bg-purple-50/50 ${
                      isUrgent 
                        ? 'bg-gradient-to-r from-yellow-50/50 to-orange-50/50 border-l-4 border-orange-400' 
                        : ''
                    }`}
                  >
                    {/* Booking Info - Compact */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <Link 
                        href={`/admin/bookings/${booking.id}`}
                        className="block group"
                      >
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                              {booking.trips?.title || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />{booking.trips?.destination || 'N/A'}
                            </div>
                            {booking.trips?.start_date && (
                              <div className="text-[10px] text-purple-700 font-semibold truncate mt-0.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3 flex-shrink-0" />Departs {new Date(booking.trips.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </div>
                            )}
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-start gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-purple-700 mt-0.5">
                                {((booking.primary_passenger_name || booking.profiles?.first_name || '?')[0] || '?').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs text-gray-900 truncate">
                                  {booking.primary_passenger_name ||
                                   (booking.profiles?.first_name && booking.profiles?.last_name
                                     ? `${booking.profiles.first_name} ${booking.profiles.last_name}`
                                     : booking.profiles?.full_name || 'N/A')}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                  {booking.primary_passenger_email || booking.profiles?.email || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between">
                              <span className="font-mono">#{booking.id.slice(0, 8).toUpperCase()}</span>
                              <span>{new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </td>

                    {/* Amount & Details - Compact */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-1">
                          <IndianRupee className="h-3.5 w-3.5 text-purple-600" />
                          <span className="text-base font-bold text-gray-900">
                            {parseFloat(booking.final_amount || booking.total_price || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="flex items-center text-gray-600">
                            <Users className="h-3 w-3 mr-1" />
                            {booking.number_of_participants || 1}
                          </span>
                          {booking.wallet_amount_used > 0 && (
                            <span className="text-green-600 flex items-center">
                              <Wallet className="h-3 w-3 mr-0.5" />
                              ₹{parseFloat(String(booking.wallet_amount_used || 0)).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Payment Info - Compact */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <div className="space-y-1.5">
                        <div>
                          <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-bold border ${
                            booking.payment_status === 'paid' || booking.payment_status === 'verified'
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : booking.payment_status === 'rejected'
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : booking.payment_status === 'cash_pending'
                              ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          }`}>
                            {booking.payment_status === 'paid' || booking.payment_status === 'verified' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : booking.payment_status === 'rejected' ? (
                              <XCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <Clock className="h-3 w-3 mr-1" />
                            )}
                            <span className="capitalize">{(booking.payment_status || 'pending').replace(/_/g, ' ')}</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs">
                          {booking.payment_mode === 'cash' ? (
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 font-semibold flex items-center">
                              <Banknote className="h-3 w-3 mr-0.5" />
                              <span>Cash</span>
                            </span>
                          ) : booking.payment_mode === 'razorpay' ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-semibold flex items-center">
                              <CreditCard className="h-3 w-3 mr-0.5" />
                              <span>Razorpay</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 font-semibold flex items-center">
                              <Smartphone className="h-3 w-3 mr-0.5" />
                              <span>Manual</span>
                            </span>
                          )}
                        </div>
                        {hasPendingPayment && (
                          <div className="flex items-center space-x-1 text-xs text-orange-600 font-semibold">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Action Required</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Booking Status - Compact */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-xs font-bold border ${getStatusColor(booking.booking_status || 'pending')}`}>
                        {getStatusIcon(booking.booking_status || 'pending')}
                        <span className="ml-1">
                          {(booking.booking_status || 'pending') === 'seat_locked' 
                            ? 'Seat Locked' 
                            : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')
                          }
                        </span>
                      </span>
                    </td>

                    {/* Actions - primary + overflow */}
                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                      {(() => {
                        const needsManualReview = booking.payment_mode === 'manual' && (booking.payment_status === 'pending' || booking.reference_id);
                        const needsCashApproval = booking.payment_mode === 'cash' && booking.payment_status === 'cash_pending';
                        const hasTxns = booking.payment_transactions && booking.payment_transactions.length > 0;
                        const phone = booking.primary_passenger_phone || booking.profiles?.phone;
                        const pendingTxns = hasTxns ? booking.payment_transactions.filter((p: any) => p.payment_status === 'pending').length : 0;
                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Primary action: review if something needs it, else view */}
                            {needsCashApproval ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openCashPaymentModal(booking); }}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Approve cash
                              </button>
                            ) : needsManualReview ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); openPaymentModal(booking); }}
                                className="relative px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" /> Review
                                {pendingTxns > 0 && <span className="ml-0.5 px-1 bg-white/25 rounded text-[10px] font-bold">{pendingTxns}</span>}
                              </button>
                            ) : (
                              <Link
                                href={`/admin/bookings/${booking.id}`}
                                className="px-3 py-1.5 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <Eye className="h-3.5 w-3.5 text-gray-500" /> View
                              </Link>
                            )}

                            {/* Overflow menu */}
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenRowMenu(openRowMenu === booking.id ? null : booking.id); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                                title="More actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {openRowMenu === booking.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpenRowMenu(null); }} />
                                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden py-1">
                                    <Link href={`/admin/bookings/${booking.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                      <Eye className="h-3.5 w-3.5 text-gray-500" /> View booking
                                    </Link>
                                    {(needsManualReview || hasTxns) && (
                                      <button onClick={(e) => { e.stopPropagation(); setOpenRowMenu(null); openPaymentModal(booking); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                                        <CreditCard className="h-3.5 w-3.5 text-gray-500" /> Payments{pendingTxns > 0 ? ` (${pendingTxns})` : ''}
                                      </button>
                                    )}
                                    {phone && (
                                      <a href={`tel:${phone}`} onClick={(e) => { e.stopPropagation(); setOpenRowMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <Phone className="h-3.5 w-3.5 text-gray-500" /> Call customer
                                      </a>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); setOpenRowMenu(null); handleDeleteBooking(booking); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left border-t border-gray-100">
                                      <XCircle className="h-3.5 w-3.5" /> Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredBookings.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No bookings found</p>
            {searchTerm && (
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            )}
          </div>
        )}
      </div>

      {/* Payment Review Modal */}
      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-purple-200 shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-600 p-3 sm:p-4 md:p-6 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-4">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Review Payment</h2>
                  <p className="text-sm text-purple-100">Booking ID: {selectedBooking.id.substring(0, 8)}...</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedBooking(null);
                  setSelectedTransaction(null);
                  setReviewNotes('');
                  setRejectionReason('fake_payment');
                  setReviewing(false);
                }}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors border-2 border-white/30"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
              {/* Booking Overview Card */}
              <div className="bg-gradient-to-br from-purple-50 via-purple-50 to-indigo-50 rounded-xl sm:rounded-2xl border border-purple-200 p-3 sm:p-4 md:p-6 shadow-md">
                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-bold text-gray-900">Booking Overview</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Trip</p>
                    </div>
                    <p className="font-bold text-gray-900 text-lg">{selectedBooking.trips?.title || 'N/A'}</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedBooking.trips?.destination || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</p>
                    </div>
                    <p className="font-bold text-gray-900 text-lg">
                      {selectedBooking.primary_passenger_name || 
                       `${selectedBooking.profiles?.first_name || ''} ${selectedBooking.profiles?.last_name || ''}`.trim() || 
                       'N/A'}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {selectedBooking.primary_passenger_email || selectedBooking.profiles?.email || 'N/A'}
                  </p>
                      {selectedBooking.primary_passenger_phone && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          {selectedBooking.primary_passenger_phone}
                        </p>
                      )}
                </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                    <div className="flex items-center space-x-2 mb-2">
                      <IndianRupee className="h-4 w-4 text-purple-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</p>
                    </div>
                    <p className="font-bold text-gray-900 text-2xl flex items-center">
                      <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                      {parseFloat(selectedBooking.final_amount || selectedBooking.total_price || 0).toLocaleString()}
                  </p>
                    {selectedBooking.wallet_amount_used > 0 && (
                      <p className="text-xs text-green-600 mt-1 flex items-center space-x-1">
                        <Wallet className="h-3 w-3" />
                        <span>Wallet used: ₹{parseFloat(String(selectedBooking.wallet_amount_used || 0)).toLocaleString()}</span>
                      </p>
                    )}
                </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-purple-100">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Participants</p>
                    </div>
                    <p className="font-bold text-gray-900 text-2xl">{selectedBooking.number_of_participants || 1}</p>
                    <p className="text-xs text-gray-600 mt-1 flex items-center space-x-1">
                      {selectedBooking.payment_method === 'seat_lock' ? (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Seat Lock</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-3 w-3" />
                          <span>Full Payment</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Transactions Section */}
              {selectedBooking.payment_transactions && selectedBooking.payment_transactions.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                      <h3 className="text-lg font-bold text-gray-900">Payment Transactions</h3>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">
                        {selectedBooking.payment_transactions.length} {selectedBooking.payment_transactions.length === 1 ? 'transaction' : 'transactions'}
                      </span>
                    </div>
                    {selectedBooking.payment_transactions.some((p: any) => p.payment_status === 'pending') && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200 flex items-center space-x-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{selectedBooking.payment_transactions.filter((p: any) => p.payment_status === 'pending').length} Pending</span>
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {selectedBooking.payment_transactions.map((transaction: any, index: number) => {
                      const isPending = transaction.payment_status === 'pending';
                      const isVerified = transaction.payment_status === 'verified';
                      const isRejected = transaction.payment_status === 'rejected';
                      
                      return (
                      <div 
                        key={transaction.id} 
                          className={`rounded-2xl border-2 shadow-lg overflow-hidden transition-all ${
                            isVerified
                              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300' 
                              : isRejected
                              ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                              : 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300'
                        }`}
                      >
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-3">
                                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center space-x-1 ${
                                    transaction.payment_type === 'seat_lock' 
                                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                                      : transaction.payment_type === 'remaining'
                                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                                      : 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                  }`}>
                                    {transaction.payment_type === 'seat_lock' ? (
                                      <>
                                        <Lock className="h-3 w-3" />
                                        <span>Seat Lock</span>
                                      </>
                                    ) : transaction.payment_type === 'remaining' ? (
                                      <>
                                        <DollarSign className="h-3 w-3" />
                                        <span>Remaining Payment</span>
                                      </>
                                    ) : (
                                      <>
                                        <CreditCard className="h-3 w-3" />
                                        <span>Full Payment</span>
                                      </>
                                    )}
                              </span>
                                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                    isVerified
                                      ? 'bg-green-100 text-green-700 border-green-300' 
                                      : isRejected
                                      ? 'bg-red-100 text-red-700 border-red-300'
                                      : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              }`}>
                                    {isVerified ? (
                                      <span className="flex items-center">
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                        Verified
                              </span>
                                    ) : isRejected ? (
                                      <span className="flex items-center">
                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                        Rejected
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <Clock className="h-3.5 w-3.5 mr-1" />
                                        Pending Review
                                      </span>
                                    )}
                                  </span>
                                  {transaction.payment_mode && (
                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center space-x-1 ${
                                      transaction.payment_mode === 'cash'
                                        ? 'bg-green-100 text-green-700 border-green-300'
                                        : transaction.payment_mode === 'razorpay'
                                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                                        : 'bg-purple-100 text-purple-700 border-purple-300'
                                    }`}>
                                      {transaction.payment_mode === 'cash' ? (
                                        <>
                                          <Banknote className="h-3 w-3" />
                                          <span>Cash</span>
                                        </>
                                      ) : transaction.payment_mode === 'razorpay' ? (
                                        <>
                                          <CreditCard className="h-3 w-3" />
                                          <span>Razorpay</span>
                                        </>
                                      ) : (
                                        <>
                                          <Smartphone className="h-3 w-3" />
                                          <span>Manual</span>
                                        </>
                                      )}
                                    </span>
                                  )}
                            </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border-2 border-white/50">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Transaction ID</p>
                                    <div className="flex items-center space-x-2">
                                      <p className="font-mono text-sm font-bold text-gray-900 break-all flex-1">
                                        {transaction.transaction_id || 'N/A'}
                                      </p>
                                      {transaction.transaction_id && (
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(transaction.transaction_id);
                                            alert('Transaction ID copied!');
                                          }}
                                          className="p-2 hover:bg-purple-100 rounded-lg transition-colors border-2 border-purple-200"
                                          title="Copy Transaction ID"
                                        >
                                          <Eye className="h-4 w-4 text-purple-600" />
                                        </button>
                                      )}
                              </div>
                              </div>
                                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border-2 border-white/50">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Amount</p>
                                    <p className="text-2xl font-bold text-gray-900 flex items-center">
                                      <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 mr-1" />
                                      {parseFloat(String(transaction.amount || 0)).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border-2 border-white/50">
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Payment Date</p>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {new Date(transaction.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {new Date(transaction.created_at).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                              </div>
                              {transaction.payment_reviewed_at && (
                                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border-2 border-white/50">
                                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Reviewed At</p>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {new Date(transaction.payment_reviewed_at).toLocaleDateString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </p>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {new Date(transaction.payment_reviewed_at).toLocaleTimeString('en-IN', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                </div>
                              )}
                                </div>
                                
                              {transaction.rejection_reason && (
                                  <div className="mt-4 bg-red-50 rounded-xl p-4 border-2 border-red-200">
                                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Rejection Reason</p>
                                    <p className="text-sm font-semibold text-red-900">{transaction.rejection_reason}</p>
                                </div>
                              )}
                            </div>
                              {isPending && (
                            <button
                              onClick={() => openTransactionModal(selectedBooking, transaction)}
                                  className="ml-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl text-sm font-bold hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg flex items-center space-x-2"
                            >
                                  <Eye className="h-4 w-4" />
                                  <span>Review Now</span>
                            </button>
                          )}
                        </div>
                      </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedBooking.transaction_id ? (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200 p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <CreditCard className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-900">Transaction ID</h3>
                  </div>
                  <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-lg font-bold text-gray-900 break-all pr-4">
                      {selectedBooking.transaction_id}
                    </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedBooking.transaction_id);
                      alert('Transaction ID copied to clipboard!');
                    }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2 flex-shrink-0"
                  >
                        <Eye className="h-4 w-4" />
                        <span>Copy</span>
                  </button>
                </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-2 border-yellow-200 p-6 text-center">
                  <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                  <p className="text-gray-700 font-semibold">No payment transactions found</p>
                  <p className="text-sm text-gray-600 mt-1">This booking may not have any payment records yet.</p>
                </div>
              )}

              {/* Review Form - Only show when a transaction is selected */}
              {selectedTransaction && selectedTransaction.payment_status === 'pending' && (
                <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50 rounded-2xl border-2 border-purple-200 p-6 shadow-lg">
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertCircle className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-bold text-gray-900">Review This Payment</h3>
                  </div>

              {/* Review Notes */}
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Review Notes <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 bg-white"
                      placeholder="Add any notes about this payment review (e.g., verified with bank statement, screenshot received, etc.)..."
                />
                    <p className="text-xs text-gray-500 mt-2">These notes will be saved for your records.</p>
              </div>

                  {/* Rejection Reason */}
              <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Rejection Reason <span className="text-red-500">*</span>
                      <span className="text-gray-500 font-normal ml-2">(Required only if rejecting)</span>
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 bg-white font-medium"
                >
                  {rejectionReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                    <p className="text-xs text-gray-600 mt-2 flex items-start space-x-1">
                      <Mail className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>This reason will be sent to the user via email if you reject the payment.</span>
                    </p>
              </div>
                </div>
              )}

              {/* Action Buttons Section */}
              {selectedTransaction && selectedTransaction.payment_status === 'pending' && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200 p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => handleReviewPayment(selectedTransaction, 'verified')}
                    disabled={reviewing}
                      className="flex-1 px-3 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:from-green-700 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                      <CheckCircle className="h-6 w-6" />
                      <span>✓ Verify Payment</span>
                  </button>
                  <button
                    onClick={() => handleReviewPayment(selectedTransaction, 'rejected')}
                    disabled={reviewing || !rejectionReason}
                      className="flex-1 px-3 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:from-red-700 hover:to-rose-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                      <XCircle className="h-6 w-6" />
                      <span>✗ Reject Payment</span>
                  </button>
                  </div>
                  {reviewing && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center space-x-3 px-4 py-2 bg-purple-100 rounded-lg border-2 border-purple-200">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
                        <p className="text-sm font-semibold text-purple-700">Processing your review...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedTransaction && selectedTransaction.payment_status !== 'pending' && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200 p-6 text-center">
                  <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg ${
                    selectedTransaction.payment_status === 'verified'
                      ? 'bg-green-100 text-green-700 border-2 border-green-200'
                      : 'bg-red-100 text-red-700 border-2 border-red-200'
                  }`}>
                    {selectedTransaction.payment_status === 'verified' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <p className="font-semibold">
                    This payment transaction has already been {selectedTransaction.payment_status === 'verified' ? 'verified' : 'rejected'}.
                  </p>
                  </div>
                  {selectedTransaction.payment_reviewed_at && (
                    <p className="text-sm text-gray-600 mt-2">
                      Reviewed on {new Date(selectedTransaction.payment_reviewed_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}
              
              {!selectedTransaction && selectedBooking.payment_transactions && selectedBooking.payment_transactions.some((p: any) => p.payment_status === 'pending') && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-2 border-yellow-200 p-6 text-center">
                  <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 mb-2">Select a Transaction to Review</p>
                  <p className="text-sm text-gray-600">
                    Click <span className="font-bold text-purple-600">&quot;Review Now&quot;</span> on a pending payment transaction above to verify or reject it.
                  </p>
                </div>
              )}

              {!selectedTransaction && (!selectedBooking.payment_transactions || selectedBooking.payment_transactions.length === 0) && !selectedBooking.transaction_id && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200 p-6 text-center">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">No payment information available</p>
                  <p className="text-sm text-gray-600 mt-1">This booking may not have any payment records yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash Payment Approval Modal */}
      {showCashPaymentModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-purple-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Approve Cash Payment</h2>
              <button
                onClick={() => {
                  setShowCashPaymentModal(false);
                  setSelectedBooking(null);
                  setCashAmountPaid('');
                  setCashNotes('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Booking ID</p>
                <p className="font-semibold text-gray-900">{selectedBooking.id.substring(0, 8)}...</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Customer</p>
                <p className="font-semibold text-gray-900">
                  {selectedBooking.profiles?.first_name && selectedBooking.profiles?.last_name
                    ? `${selectedBooking.profiles.first_name} ${selectedBooking.profiles.last_name}`
                    : selectedBooking.primary_passenger_name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Amount</p>
                <p className="font-semibold text-purple-600 text-lg flex items-center">
                  <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
                  {parseFloat(selectedBooking.final_amount || selectedBooking.total_price || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount Received <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={cashAmountPaid}
                  onChange={(e) => setCashAmountPaid(e.target.value)}
                  placeholder="Enter amount paid"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the cash amount received from the customer
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this payment..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900"
                />
              </div>
              <div className="flex space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={handleApproveCashPayment}
                  disabled={approvingCash || !cashAmountPaid || parseFloat(cashAmountPaid) <= 0}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {approvingCash ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Approve Payment</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCashPaymentModal(false);
                    setSelectedBooking(null);
                    setCashAmountPaid('');
                    setCashNotes('');
                  }}
                  disabled={approvingCash}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
