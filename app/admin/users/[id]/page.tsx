'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ArrowLeft, User, Mail, Phone, Calendar, MapPin, IndianRupee, 
  CreditCard, Clock, Package, CheckCircle, XCircle, Users, 
  GraduationCap, Heart, Eye, AlertCircle, Shield, 
  Wallet, UserCircle, PhoneCall, Calendar as CalendarIcon, 
  Hash, AlertTriangle, Edit, Plus, Send, Gift, X, 
  Activity, FileText, TrendingUp, History, MessageCircle
} from 'lucide-react';

export default function AdminUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'activity'>('overview');
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  
  // Form states
  const [editForm, setEditForm] = useState<any>(null);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletAction, setWalletAction] = useState<'add' | 'set'>('add');
  const [couponAmount, setCouponAmount] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [couponDescription, setCouponDescription] = useState('Get ₹500 Discount on next booking');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    checkUser();
    fetchUserDetails();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push('/auth/signin?redirect=/admin/users');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }
  };

  const fetchUserDetails = async () => {
    try {
      const response = await fetch(`/api/admin/users/${params.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user details');
      }

      const data = await response.json();
      
      setUser(data.user);
      setAuthUser(data.authUser);
      setBookings(data.bookings || []);
      setActivities(data.activities || []);
      setEditForm(data.user);

      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      setError(error.message || 'Failed to load user details');
      setLoading(false);
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
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'seat_locked':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleUpdateUser = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      const data = await response.json();
      setUser(data.user);
      setEditForm(data.user);
      setShowEditModal(false);
      setActionMessage({ type: 'success', text: 'User updated successfully!' });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity'); // Switch to activity tab to see the logged action
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateWallet = async () => {
    if (!walletAmount || isNaN(parseFloat(walletAmount))) {
      setActionMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: walletAmount, action: walletAction }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update wallet');
      }

      const data = await response.json();
      setUser({ ...user, wallet_balance: data.wallet_balance });
      setShowWalletModal(false);
      setWalletAmount('');
      setActionMessage({ type: 'success', text: `Wallet ${walletAction === 'add' ? 'credited' : 'updated'} successfully!` });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity'); // Switch to activity tab to see the logged action
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateCoupon = async () => {
    if (!couponAmount || isNaN(parseFloat(couponAmount))) {
      setActionMessage({ type: 'error', text: 'Please enter a valid discount amount' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/generate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountAmount: couponAmount,
          expiryDate: couponExpiry || null,
          description: couponDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate coupon');
      }

      const data = await response.json();
      setShowCouponModal(false);
      setCouponAmount('');
      setCouponExpiry('');
      setActionMessage({ type: 'success', text: data.warning || 'Coupon generated and email sent successfully!' });
      setTimeout(() => setActionMessage(null), 5000);
      await fetchUserDetails();
      setActiveTab('activity'); // Switch to activity tab to see the logged action
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedBooking) {
      setActionMessage({ type: 'error', text: 'Please select a booking' });
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/send-payment-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reminder');
      }

      setShowReminderModal(false);
      setSelectedBooking(null);
      setActionMessage({ type: 'success', text: 'Payment reminder sent successfully!' });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity'); // Switch to activity tab to see the logged action
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const getBookingsWithRemainingPayment = () => {
    return bookings.filter(booking => {
      if (booking.booking_status === 'confirmed' || booking.booking_status === 'cancelled' || booking.booking_status === 'rejected') {
        return false;
      }
      const totalPaid = booking.payment_transactions
        ?.filter((pt: any) => pt.payment_status === 'verified')
        .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;
      const remaining = parseFloat(String(booking.final_amount || booking.total_price || 0)) - totalPaid;
      return remaining > 0;
    });
  };

  const totalSpent = bookings
    .filter(b => b.booking_status === 'confirmed' || b.booking_status === 'seat_locked')
    .reduce((sum, b) => sum + parseFloat(String(b.final_amount || 0)), 0);

  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/admin/users"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Users</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Calculate booking stats
  const bookingStats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
    pending: bookings.filter(b => b.booking_status === 'pending' || b.booking_status === 'seat_locked').length,
    cancelled: bookings.filter(b => b.booking_status === 'cancelled' || b.booking_status === 'rejected').length,
    withRemainingPayment: getBookingsWithRemainingPayment().length,
  };

  const totalPaid = bookings.reduce((sum, booking) => {
    const paid = booking.payment_transactions
      ?.filter((pt: any) => pt.payment_status === 'verified')
      .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0) || 0;
    return sum + paid;
  }, 0);

  const totalPending = bookings.reduce((sum, booking) => {
    const total = parseFloat(String(booking.final_amount || booking.total_price || 0));
    const paid = booking.payment_transactions
      ?.filter((pt: any) => pt.payment_status === 'verified')
      .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0) || 0;
    return sum + (total - paid);
  }, 0);

  const fullName: string = user.full_name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '');
  const initials: string = (fullName.trim() || user.email || 'U').split(' ').map((s: string) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header - Compact */}
        <div className="mb-6">
          <Link 
            href="/admin/users" 
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium transition-all group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span>Back to All Users</span>
          </Link>
          
          {/* Premium User Hero Card */}
          <>
              {/* Hero */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                {/* Top gradient strip */}
                <div className="h-16 sm:h-20 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                </div>
                <div className="px-4 sm:px-6 pb-4 sm:pb-5 -mt-10 sm:-mt-12">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    {/* Avatar + Identity */}
                    <div className="flex items-end gap-3 sm:gap-4 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg ring-4 ring-white text-white text-2xl sm:text-3xl font-extrabold">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={fullName} className="w-full h-full rounded-2xl object-cover" />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        {user.email_verified && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-3 border-white flex items-center justify-center">
                            <CheckCircle className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{fullName || 'Unnamed User'}</h1>
                          {user.role === 'admin' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white">
                              <Shield className="h-2.5 w-2.5 inline mr-0.5" /> Admin
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${user.email_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {user.email_verified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 font-medium mb-2">
                          {bookingStats.confirmed > 2 ? '⭐ Loyal Customer' : bookingStats.total > 0 ? 'Customer' : 'New User'} · Joined {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-700">
                          <span className="flex items-center gap-1 truncate"><Mail className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />{user.email || '—'}</span>
                          {user.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-purple-500" />{user.phone}</span>}
                          <span className="flex items-center gap-1 font-mono text-[10px]"><Hash className="h-3 w-3 text-gray-400" />{user.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Single action row — admin tasks only, neutral palette */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
                    <button onClick={() => { setEditForm({ ...user }); setShowEditModal(true); }}
                            className="inline-flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors">
                      <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit user
                    </button>
                    {user.phone && (
                      <a href={`https://wa.me/91${String(user.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-purple-300 text-gray-700 rounded-lg text-sm font-semibold transition-colors">
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-green-600" /> WhatsApp
                      </a>
                    )}
                    {user.phone && (
                      <a href={`tel:${user.phone}`} className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-purple-300 text-gray-700 rounded-lg text-sm font-semibold transition-colors">
                        <Phone className="h-3.5 w-3.5 mr-1.5 text-purple-600" /> Call
                      </a>
                    )}
                    {user.email && (
                      <a href={`mailto:${user.email}`} className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-purple-300 text-gray-700 rounded-lg text-sm font-semibold transition-colors">
                        <Mail className="h-3.5 w-3.5 mr-1.5 text-purple-600" /> Email
                      </a>
                    )}
                    {getBookingsWithRemainingPayment().length > 0 && (
                      <button onClick={() => setShowReminderModal(true)}
                              className="inline-flex items-center px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition-colors ml-auto">
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Remind ({getBookingsWithRemainingPayment().length})
                      </button>
                    )}
                  </div>
                </div>
              </div>

            {/* Stats — three cards only, parent metrics only */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Bookings" value={String(bookingStats.total)} sub={`${bookingStats.confirmed} confirmed${bookingStats.cancelled ? ` · ${bookingStats.cancelled} cancelled` : ''}`} />
              <Stat label="Spent" value={`₹${totalPaid.toLocaleString('en-IN')}`} sub="lifetime" />
              <Stat label="Wallet" value={`₹${parseFloat(String(user.wallet_balance || 0)).toLocaleString('en-IN')}`} sub="balance" />
            </div>
              </>

        {/* Tabs Navigation - Compact */}
        <div className="mb-4">
          <div className="flex space-x-1 bg-white rounded-xl p-1 border border-purple-200 shadow-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                activeTab === 'overview'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Overview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                activeTab === 'bookings'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Bookings</span>
                {bookings.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/30 text-xs font-bold">
                    {bookings.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                activeTab === 'activity'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Activity</span>
                {activities.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/30 text-xs font-bold">
                    {activities.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Profile details — only fields NOT already in the header. Plain dl, no decoration. */}
            {(user.alternative_number || user.college || user.college_name || user.university || user.student_id || user.gender || user.date_of_birth || authUser?.last_sign_in_at || user.bio) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Profile details</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  {user.alternative_number && (<div><dt className="text-xs text-gray-500">Alt. phone</dt><dd className="font-semibold text-gray-900">{user.alternative_number}</dd></div>)}
                  {(user.college_name || user.college || user.university) && (<div><dt className="text-xs text-gray-500">College</dt><dd className="font-semibold text-gray-900 truncate">{user.college_name || user.college || user.university}</dd></div>)}
                  {user.student_id && (<div><dt className="text-xs text-gray-500">Student ID</dt><dd className="font-semibold text-gray-900">{user.student_id}</dd></div>)}
                  {user.gender && (<div><dt className="text-xs text-gray-500">Gender</dt><dd className="font-semibold text-gray-900 capitalize">{user.gender}</dd></div>)}
                  {user.date_of_birth && (<div><dt className="text-xs text-gray-500">Date of birth</dt><dd className="font-semibold text-gray-900">{new Date(user.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>)}
                  {authUser?.last_sign_in_at && (<div><dt className="text-xs text-gray-500">Last login</dt><dd className="font-semibold text-gray-900">{new Date(authUser.last_sign_in_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</dd></div>)}
                  {user.bio && (<div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-gray-500">Bio</dt><dd className="font-semibold text-gray-900">{user.bio}</dd></div>)}
                </dl>
              </div>
            )}

            {/* Emergency Contact - Compact */}
            {(user.emergency_contact || user.emergency_contact_name) && (
              <div className="bg-white rounded-xl border-2 border-red-200 shadow-md p-4 sm:p-6 mb-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    Emergency Contact
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {user.emergency_contact_name && (
                    <div className="bg-red-50 rounded-lg p-2 sm:p-3 border border-red-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</p>
                      <p className="font-bold text-gray-900 text-sm">
                        {user.emergency_contact_name}
                      </p>
                    </div>
                  )}
                  {user.emergency_contact && (
                    <div className="bg-red-50 rounded-lg p-2 sm:p-3 border border-red-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Number</p>
                      <p className="font-bold text-gray-900 text-sm flex items-center">
                        <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5 text-red-600 flex-shrink-0" />
                        {user.emergency_contact}
                      </p>
                    </div>
                  )}
                  {user.emergency_contact_relation && (
                    <div className="bg-red-50 rounded-lg p-2 sm:p-3 border border-red-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Relation</p>
                      <p className="font-bold text-gray-900 text-sm">
                        {user.emergency_contact_relation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wallet & Referral - Compact */}
            {(user.wallet_balance !== undefined || user.referral_code || user.referred_by) && (
              <div className="bg-white rounded-xl border-2 border-green-200 shadow-md p-4 sm:p-6 mb-4">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-green-100">
                  <Wallet className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    Wallet & Referrals
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {user.referral_code && (
                    <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Referral Code</p>
                      <p className="font-mono font-bold text-green-600 text-sm">{user.referral_code}</p>
                    </div>
                  )}
                  {user.referred_by && (
                    <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Referred By</p>
                      <p className="font-bold text-gray-900 text-xs">
                        <span className="font-mono">{user.referred_by.substring(0, 8)}...</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-xl border-2 border-blue-200 shadow-md p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Booking History
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
                  {bookings.length} total
                </span>
                {bookingStats.withRemainingPayment > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                    {bookingStats.withRemainingPayment} pending payment
                  </span>
                )}
              </div>
            </div>
            {bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.map((booking) => {
                  const totalPaid = booking.payment_transactions
                    ?.filter((pt: any) => pt.payment_status === 'verified')
                    .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;
                  const remaining = parseFloat(String(booking.final_amount || booking.total_price || 0)) - totalPaid;
                  const hasPendingPayment = remaining > 0 && booking.booking_status !== 'confirmed' && booking.booking_status !== 'cancelled' && booking.booking_status !== 'rejected';
                  
                  return (
                    <Link
                      key={booking.id}
                      href={`/admin/bookings/${booking.id}`}
                      className={`block bg-white border-2 rounded-lg p-3 sm:p-4 hover:shadow-md transition-all ${
                        hasPendingPayment 
                          ? 'border-orange-300 bg-orange-50/30' 
                          : 'border-blue-100 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                                {booking.trips?.title || 'Trip'}
                              </h3>
                              <p className="text-xs text-gray-600 flex items-center mt-0.5">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{booking.trips?.destination || 'N/A'}</span>
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border flex-shrink-0 ml-2 ${getStatusColor(booking.booking_status || 'pending')}`}>
                              {getStatusIcon(booking.booking_status || 'pending')}
                              <span className="ml-1">
                                {(booking.booking_status || 'pending') === 'seat_locked' 
                                  ? 'Seat Locked' 
                                  : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')
                                }
                              </span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
                            <div>
                              <p className="text-gray-600 mb-0.5">Trip Date</p>
                              <p className="font-semibold text-gray-900">
                                {booking.trips?.start_date 
                                  ? new Date(booking.trips.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) 
                                  : 'TBD'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">Participants</p>
                              <p className="font-semibold text-gray-900 flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                {booking.number_of_participants || 1}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">Amount</p>
                              <p className="font-semibold text-purple-600 flex items-center">
                                <IndianRupee className="h-3 w-3" />
                                {parseFloat(String(booking.final_amount || 0)).toLocaleString()}
                              </p>
                              {hasPendingPayment && (
                                <p className="text-xs text-orange-600 font-semibold mt-0.5">
                                  Remaining: ₹{remaining.toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">Booked</p>
                              <p className="font-semibold text-gray-900">
                                {new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                          {booking.coupon_code && (
                            <div className="mt-2">
                              <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
                                Coupon: {booking.coupon_code}
                              </span>
                            </div>
                          )}
                          {booking.payment_transactions && booking.payment_transactions.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="flex flex-wrap gap-1.5">
                                {booking.payment_transactions.map((pt: any) => (
                                  <span 
                                    key={pt.id}
                                    className={`text-xs px-1.5 py-0.5 rounded border ${
                                      pt.payment_status === 'verified' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : pt.payment_status === 'rejected'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    }`}
                                  >
                                    ₹{parseFloat(String(pt.amount || 0)).toLocaleString()} ({pt.payment_status})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end lg:justify-start">
                          <Link
                            href={`/admin/bookings/${booking.id}`}
                            className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                            View Details →
                          </Link>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No bookings found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl border border-purple-200 shadow-md p-4 sm:p-6 mb-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  Admin Activity Log
                </h2>
              </div>
              <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">
                {activities.length} actions
              </span>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const getActionIcon = () => {
                    switch (activity.action_type) {
                      case 'wallet_add':
                      case 'wallet_set':
                        return <Wallet className="h-4 w-4 text-green-600" />;
                      case 'coupon_generated':
                        return <Gift className="h-4 w-4 text-orange-600" />;
                      case 'profile_updated':
                        return <Edit className="h-4 w-4 text-purple-600" />;
                      case 'reminder_sent':
                        return <Send className="h-4 w-4 text-red-600" />;
                      default:
                        return <Activity className="h-4 w-4 text-gray-600" />;
                    }
                  };

                  const getActionColor = () => {
                    switch (activity.action_type) {
                      case 'wallet_add':
                      case 'wallet_set':
                        return 'bg-green-50 border-green-200';
                      case 'coupon_generated':
                        return 'bg-orange-50 border-orange-200';
                      case 'profile_updated':
                        return 'bg-purple-50 border-purple-200';
                      case 'reminder_sent':
                        return 'bg-red-50 border-red-200';
                      default:
                        return 'bg-gray-50 border-gray-200';
                    }
                  };

                  const adminName = activity.admin?.full_name || 
                    (activity.admin?.first_name && activity.admin?.last_name 
                      ? `${activity.admin.first_name} ${activity.admin.last_name}` 
                      : activity.admin?.email || 'Admin');

                  return (
                    <div
                      key={activity.id}
                      className={`${getActionColor()} rounded-lg p-3 border-2 hover:shadow-sm transition-all`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getActionIcon()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm mb-1">
                                {activity.action_description}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{adminName}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(activity.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-white text-xs font-semibold text-gray-700 border border-gray-200 whitespace-nowrap flex-shrink-0">
                              {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <details className="cursor-pointer">
                                <summary className="text-xs font-semibold text-gray-600 hover:text-gray-800">
                                  View Details
                                </summary>
                                <div className="mt-2 p-2 bg-white rounded text-xs font-mono text-gray-700 max-h-32 overflow-y-auto border border-gray-200">
                                  <pre className="whitespace-pre-wrap text-xs">
                                    {JSON.stringify(activity.metadata, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-medium">No activity recorded yet</p>
                <p className="text-xs text-gray-500 mt-1">Admin actions on this account will appear here</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Action Message */}
      {actionMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-sm border-2 animate-slide-up ${
          actionMessage.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-300' 
            : 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-300'
        }`}>
          <div className="flex items-center gap-3">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <p className="font-semibold">{actionMessage.text}</p>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white via-purple-50/50 to-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-100/50 animate-slide-up">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit User Details
              </h2>
              <button onClick={() => {
                setShowEditModal(false);
                setEditForm(user);
              }} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={editForm?.first_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all bg-white/80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editForm?.last_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editForm?.full_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm?.phone || editForm?.phone_number || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">College/University</label>
                  <input
                    type="text"
                    value={editForm?.college_name || editForm?.college || editForm?.university || ''}
                    onChange={(e) => setEditForm({ ...editForm, college_name: e.target.value, college: e.target.value, university: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                  <input
                    type="text"
                    value={editForm?.student_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, student_id: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={editForm?.gender || ''}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm?.date_of_birth ? editForm.date_of_birth.split('T')[0] : ''}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    value={editForm?.emergency_contact || ''}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={editForm?.emergency_contact_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={editForm?.emergency_contact_relation || ''}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_relation: e.target.value })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                    placeholder="e.g., Father, Mother, Friend"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={editForm?.bio || ''}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditForm(user); // Reset form when closing
                  }}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white via-green-50/50 to-white rounded-3xl shadow-2xl max-w-md w-full border border-green-100/50 animate-slide-up">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Update Wallet Balance
              </h2>
              <button onClick={() => setShowWalletModal(false)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-2xl border-2 border-green-200">
                <label className="block text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">Current Balance</label>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent flex items-center">
                  <IndianRupee className="h-7 w-7 text-green-600 mr-1" />
                  {parseFloat(String(user.wallet_balance || 0)).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Action Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWalletAction('add')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                      walletAction === 'add' 
                        ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-md' 
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Add Amount
                  </button>
                  <button
                    onClick={() => setWalletAction('set')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                      walletAction === 'set' 
                        ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-md' 
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Set Amount
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {walletAction === 'add' ? 'Amount to Add' : 'New Balance'}
                </label>
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-green-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none transition-all bg-white/80 text-lg font-semibold"
                />
              </div>
              {walletAmount && !isNaN(parseFloat(walletAmount)) && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                  <p className="text-sm font-semibold text-gray-600 mb-2">
                    {walletAction === 'add' ? 'New Balance:' : 'Balance will be set to:'}
                  </p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    <IndianRupee className="h-6 w-6 inline text-green-600" />
                    {walletAction === 'add' 
                      ? (parseFloat(String(user.wallet_balance || 0)) + parseFloat(walletAmount)).toLocaleString()
                      : parseFloat(walletAmount).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-6 border-t border-green-100">
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateWallet}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {actionLoading ? 'Updating...' : 'Update Wallet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="border-b border-purple-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Generate Discount Coupon</h2>
              <button onClick={() => setShowCouponModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Amount (₹)</label>
                <input
                  type="number"
                  value={couponAmount}
                  onChange={(e) => setCouponAmount(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all bg-white/80 text-lg font-semibold"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={couponExpiry}
                  onChange={(e) => setCouponExpiry(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all bg-white/80"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={couponDescription}
                  onChange={(e) => setCouponDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all bg-white/80 resize-none"
                  placeholder="Get ₹500 Discount on next booking"
                />
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border-2 border-orange-200">
                <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  A unique coupon code will be generated and sent to the user&apos;s email address.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-orange-100">
                <button
                  onClick={() => setShowCouponModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateCoupon}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {actionLoading ? 'Generating...' : 'Generate & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-white via-red-50/50 to-white rounded-3xl shadow-2xl max-w-md w-full border border-red-100/50 animate-slide-up">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Payment Reminder
              </h2>
              <button onClick={() => setShowReminderModal(false)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 sm:p-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Booking</label>
                <select
                  value={selectedBooking?.id || ''}
                  onChange={(e) => {
                    const booking = bookings.find(b => b.id === e.target.value);
                    setSelectedBooking(booking);
                  }}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-red-200 rounded-xl focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all bg-white/80 font-semibold"
                >
                  <option value="">Select a booking...</option>
                  {getBookingsWithRemainingPayment().map((booking) => {
                    const totalPaid = booking.payment_transactions
                      ?.filter((pt: any) => pt.payment_status === 'verified')
                      .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;
                    const remaining = parseFloat(String(booking.final_amount || booking.total_price || 0)) - totalPaid;
                    return (
                      <option key={booking.id} value={booking.id}>
                        {booking.trips?.title || 'Trip'} - Remaining: ₹{remaining.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>
              {selectedBooking && (
                <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-xl border-2 border-red-200">
                  <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    A payment reminder email will be sent to {user.email} for this booking.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-6 border-t border-red-100">
                <button
                  onClick={() => setShowReminderModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendReminder}
                  disabled={actionLoading || !selectedBooking}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-rose-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {actionLoading ? 'Sending...' : 'Send Reminder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}
