'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Calendar, User, MapPin, IndianRupee, CheckCircle, Clock, XCircle, Filter, Eye, X, Check, Image as ImageIcon, Mail, Phone, Heart, GraduationCap, Users, AlertCircle, CreditCard, Search, TrendingUp, DollarSign, AlertTriangle, RefreshCw, Banknote, Smartphone, Lock, Wallet } from 'lucide-react';

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
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
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

  const totalRevenue = bookings
    .filter(b => b.booking_status === 'confirmed')
    .reduce((sum, b) => sum + (parseFloat(b.final_amount || b.total_price || 0)), 0);

  const pendingRevenue = bookings
    .filter(b => (b.payment_status === 'pending' || b.payment_status === 'cash_pending') && b.booking_status !== 'cancelled')
    .reduce((sum, b) => sum + (parseFloat(b.final_amount || b.total_price || 0)), 0);

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
      {/* Header Section - Compact */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-1">All Bookings</h1>
          <p className="text-xs text-gray-600">View and manage all trip bookings</p>
        </div>
        <button
          onClick={fetchBookings}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Key Stats Cards - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="h-5 w-5 mr-1" />
            {totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Confirmed bookings</p>
        </div>

        {/* Pending Revenue */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200 p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-sm">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          </div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Pending Revenue</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="h-5 w-5 mr-1" />
            {pendingRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">{stats.pendingPayments} pending</p>
        </div>

        {/* Urgent Actions */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-200 p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-sm">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">
              {stats.cashPending + stats.manualPending + stats.razorpayPending}
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Requires Action</p>
          <p className="text-2xl font-bold text-gray-900">{stats.cashPending + stats.manualPending + stats.razorpayPending}</p>
          <div className="flex flex-wrap gap-1.5 mt-1 text-xs">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded border border-orange-200">
              {stats.cashPending} Cash
            </span>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-200">
              {stats.manualPending} Manual
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200">
              {stats.razorpayPending} Razorpay
            </span>
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Total Bookings</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.confirmed} confirmed</p>
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

      {/* Search and Filters Section - Compact */}
      <div className="bg-white rounded-xl border-2 border-purple-200 shadow-md p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Trip Filter */}
          <div className="lg:w-64">
            <select
              value={selectedTripId}
              onChange={(e) => {
                setSelectedTripId(e.target.value);
                setFilter('all'); // Reset status filter when trip changes
              }}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm text-gray-900 font-medium"
            >
              <option value="all">All Trips</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title} - {trip.destination}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, email, or booking ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="lg:w-40">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm text-gray-900 font-medium"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Pills - Compact */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilter('all');
              setSearchTerm('');
            }}
            className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all flex items-center space-x-1.5 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>All ({tripStats.total})</span>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all flex items-center space-x-1.5 ${
              filter === 'pending'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-2 border-yellow-200'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Pending ({tripStats.pending})</span>
            {stats.pendingPayments > 0 && (
              <span className="px-2 py-0.5 bg-white/30 rounded-full text-xs font-bold">
                {stats.pendingPayments} payments
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all flex items-center space-x-1.5 ${
              filter === 'confirmed'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border-2 border-green-200'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirmed ({tripStats.confirmed})</span>
          </button>
          <button
            onClick={() => setFilter('seat_locked')}
            className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all flex items-center space-x-1.5 ${
              filter === 'seat_locked'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-2 border-orange-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Seat Locked ({tripStats.seatLocked})</span>
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-3 py-1.5 rounded-full font-semibold text-xs transition-all flex items-center space-x-1.5 ${
              filter === 'cancelled'
                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md'
                : 'bg-red-50 text-red-700 hover:bg-red-100 border-2 border-red-200'
            }`}
          >
            <XCircle className="h-4 w-4" />
            <span>Cancelled ({tripStats.cancelled})</span>
          </button>
        </div>
      </div>

      {/* Bookings Table - Compact Design */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 via-purple-100 to-purple-50 border-b-2 border-purple-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Booking</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount & Details</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
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
                    <td className="px-4 py-3">
                      <Link 
                        href={`/admin/bookings/${booking.id}`}
                        className="block group"
                      >
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                              {booking.trips?.title || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {booking.trips?.destination || 'N/A'}
                            </div>
                            <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                              <div className="font-semibold text-xs text-gray-900 truncate">
                                {booking.primary_passenger_name || 
                                 (booking.profiles?.first_name && booking.profiles?.last_name
                                   ? `${booking.profiles.first_name} ${booking.profiles.last_name}`
                                   : booking.profiles?.full_name || 'N/A')}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                {booking.primary_passenger_email || booking.profiles?.email || 'N/A'}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </td>

                    {/* Amount & Details - Compact */}
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        <div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold border ${
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
                          {booking.payment_transactions && booking.payment_transactions.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 text-xs">
                              {booking.payment_transactions.length}
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
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold border ${getStatusColor(booking.booking_status || 'pending')}`}>
                        {getStatusIcon(booking.booking_status || 'pending')}
                        <span className="ml-1">
                          {(booking.booking_status || 'pending') === 'seat_locked' 
                            ? 'Seat Locked' 
                            : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')
                          }
                        </span>
                      </span>
                    </td>

                    {/* Actions - Compact */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 min-w-[120px]">
                        {/* Cash Payment Approval */}
                        {booking.payment_mode === 'cash' && booking.payment_status === 'cash_pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCashPaymentModal(booking);
                            }}
                            className="w-full px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-md text-xs font-bold hover:from-green-700 hover:to-green-800 transition-all shadow-sm hover:shadow flex items-center justify-center space-x-1"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve Cash</span>
                          </button>
                        )}
                        {/* Manual Payment Review */}
                        {booking.payment_mode === 'manual' && (booking.payment_status === 'pending' || booking.reference_id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaymentModal(booking);
                            }}
                            className="w-full px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-md text-xs font-bold hover:from-purple-700 hover:to-purple-800 transition-all shadow-sm hover:shadow flex items-center justify-center space-x-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Review</span>
                          </button>
                        )}
                        {/* View Payments */}
                        {booking.payment_transactions && booking.payment_transactions.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPaymentModal(booking);
                            }}
                            className={`w-full px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center space-x-1 ${
                              booking.payment_transactions.some((p: any) => p.payment_status === 'pending')
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300'
                            }`}
                          >
                            <Eye className="h-3 w-3" />
                            <span>Payments</span>
                            {booking.payment_transactions.filter((p: any) => p.payment_status === 'pending').length > 0 && (
                              <span className="ml-1 px-1 py-0.5 bg-white rounded text-xs font-bold">
                                {booking.payment_transactions.filter((p: any) => p.payment_status === 'pending').length}
                              </span>
                            )}
                          </button>
                        )}
                        {/* View Details */}
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1 border border-gray-200"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Details</span>
                        </Link>
                      </div>
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
          <div className="bg-white rounded-3xl border-2 border-purple-200 shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-600 p-6 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                  <CreditCard className="h-6 w-6 text-white" />
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

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Booking Overview Card */}
              <div className="bg-gradient-to-br from-purple-50 via-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-200 p-6 shadow-lg">
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
                      <IndianRupee className="h-5 w-5 mr-1" />
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
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border-2 border-purple-200">
                        {selectedBooking.payment_transactions.length} {selectedBooking.payment_transactions.length === 1 ? 'transaction' : 'transactions'}
                      </span>
                    </div>
                    {selectedBooking.payment_transactions.some((p: any) => p.payment_status === 'pending') && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border-2 border-orange-200 flex items-center space-x-1">
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
                                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 flex items-center space-x-1 ${
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
                                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${
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
                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 flex items-center space-x-1 ${
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
                                      <IndianRupee className="h-6 w-6 mr-1" />
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
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transform hover:scale-105"
                  >
                      <CheckCircle className="h-6 w-6" />
                      <span>✓ Verify Payment</span>
                  </button>
                  <button
                    onClick={() => handleReviewPayment(selectedTransaction, 'rejected')}
                    disabled={reviewing || !rejectionReason}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-bold text-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transform hover:scale-105"
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
                  <IndianRupee className="h-5 w-5" />
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
