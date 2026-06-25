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
  Activity, FileText, TrendingUp, History, MessageCircle, Copy, LogIn, Trash2
} from 'lucide-react';

export default function AdminUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [referrer, setReferrer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'activity'>('overview');
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);

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
      setReferrer(data.referrer || null);
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

  // Generate a one-time magic link to sign in AS this user. We DON'T auto-open it
  // in this window — cookie sessions are shared per-browser, so that would replace
  // the admin's session. Instead we surface the link to open in a private window.
  const handleImpersonate = async () => {
    setImpersonating(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/impersonate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create a login link');
      setImpersonateLink(data.link);
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message });
    } finally {
      setImpersonating(false);
    }
  };

  // Permanently delete the user and all their data.
  const handleDeleteUser = async () => {
    setDeleting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${params.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      router.push('/admin/users');
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message });
      setDeleting(false);
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

  const fullName = String(user.full_name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : ''));
  const initials = (fullName.trim() || user.email || 'U').split(' ').map((s: string) => s.charAt(0)).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen pt-16 pb-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <Link href="/admin/users" className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-purple-700 mb-5">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> All users
        </Link>

        {/* Header — utility first, no banner */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-base sm:text-lg flex-shrink-0">
              {user.avatar_url ? <img src={user.avatar_url} alt={fullName} className="w-full h-full rounded-full object-cover" /> : <span>{initials}</span>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{fullName || 'Unnamed user'}</h1>
                {user.role === 'admin' && (<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700">Admin</span>)}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${user.email_verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{user.email_verified ? 'Verified' : 'Unverified'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:text-sm text-gray-600 mt-1">
                <span className="truncate">{user.email || '—'}</span>
                {user.phone && <span>·</span>}
                {user.phone && <span>{user.phone}</span>}
                <span>·</span>
                <span className="font-mono text-[10px] text-gray-400">#{user.id.slice(0,8).toUpperCase()}</span>
              </div>
            </div>
          </div>
          {/* Actions — top right, action-first */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => { setEditForm({ ...user }); setShowEditModal(true); }} className="hidden sm:inline-flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"><Edit className="h-3.5 w-3.5 mr-1.5" /> Edit</button>
            <button onClick={() => setShowWalletModal(true)} className="hidden sm:inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-sm font-semibold">Wallet</button>
            <button onClick={() => setShowCouponModal(true)} className="hidden sm:inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-sm font-semibold">Coupons</button>
            <div className="relative">
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-sm font-semibold">More</button>
              {showMoreMenu && (<div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                {user.phone && <a href={`tel:${user.phone}`} className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Phone className="h-3.5 w-3.5 mr-2 text-gray-400" /> Call</a>}
                {user.phone && <a href={`https://wa.me/91${String(user.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><MessageCircle className="h-3.5 w-3.5 mr-2 text-gray-400" /> WhatsApp</a>}
                {user.email && <a href={`mailto:${user.email}`} className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Mail className="h-3.5 w-3.5 mr-2 text-gray-400" /> Email</a>}
                <button onClick={() => { setEditForm({ ...user }); setShowEditModal(true); setShowMoreMenu(false); }} className="sm:hidden w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Edit className="h-3.5 w-3.5 mr-2 text-gray-400" /> Edit user</button>
                <button onClick={() => { setShowWalletModal(true); setShowMoreMenu(false); }} className="sm:hidden w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Wallet className="h-3.5 w-3.5 mr-2 text-gray-400" /> Wallet</button>
                <button onClick={() => { setShowCouponModal(true); setShowMoreMenu(false); }} className="sm:hidden w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Gift className="h-3.5 w-3.5 mr-2 text-gray-400" /> Coupon</button>
                {getBookingsWithRemainingPayment().length > 0 && (<button onClick={() => { setShowReminderModal(true); setShowMoreMenu(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-orange-700 hover:bg-orange-50"><Send className="h-3.5 w-3.5 mr-2" /> Send reminder ({getBookingsWithRemainingPayment().length})</button>)}
              </div>)}
            </div>
          </div>
        </div>

        {/* Stats strip — compact, bordered, grouped */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-white border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-100 mb-5">
          <div className="px-4 py-3"><p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Bookings</p><p className="text-xl font-bold text-gray-900 leading-tight">{bookingStats.total}</p><p className="text-[11px] text-gray-400">{bookingStats.confirmed} confirmed</p></div>
          <div className="px-4 py-3"><p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Spent</p><p className="text-xl font-bold text-gray-900 leading-tight">₹{totalPaid.toLocaleString('en-IN')}</p><p className="text-[11px] text-gray-400">{bookingStats.cancelled || 0} cancelled</p></div>
          <div className="px-4 py-3"><p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Wallet</p><p className="text-xl font-bold text-gray-900 leading-tight">₹{parseFloat(String(user.wallet_balance || 0)).toLocaleString('en-IN')}</p><p className="text-[11px] text-gray-400">balance</p></div>
          <div className="px-4 py-3"><p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Member since</p><p className="text-xl font-bold text-gray-900 leading-tight">{user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</p><p className="text-[11px] text-gray-400">{user.email_verified ? 'verified' : 'unverified'}</p></div>
        </div>

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
          <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            {/* Profile details — only fields NOT already in the header. Plain dl, no decoration. */}
            {(user.alternative_number || user.college || user.college_name || user.university || user.student_id || user.gender || user.date_of_birth || authUser?.last_sign_in_at || user.bio) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
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
              <div className="bg-white rounded-xl border-2 border-red-200 shadow-md p-4 sm:p-6">
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

            {/* Login activity — timeline */}
            {authUser && (() => {
              const events = [
                authUser.created_at && { dot: 'bg-purple-500', label: 'Account created', when: new Date(authUser.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                authUser.last_sign_in_at && { dot: 'bg-blue-500', label: 'Last login', when: new Date(authUser.last_sign_in_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              ].filter(Boolean) as { dot: string; label: string; when: string }[];
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Login activity</h2>
                  <div className="space-y-0">
                    {events.map((e, i) => (
                      <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <span className={`h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.dot} mt-1`} />
                          {i < events.length - 1 && <span className="w-px flex-1 bg-gray-200 my-1" />}
                        </div>
                        <div className="min-w-0 -mt-0.5">
                          <p className="text-sm font-semibold text-gray-900">{e.label}</p>
                          <p className="text-xs text-gray-500">{e.when}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Sign-in method: <span className="capitalize">{authUser.app_metadata?.provider || authUser.app_metadata?.providers?.[0] || 'email'}</span>. IP/location aren't stored by Supabase Auth by default.</p>
                </div>
              );
            })()}
          </div>

          {/* Quick-actions + wallet rail */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            {/* Quick actions */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <p className="px-4 pt-3.5 pb-1 text-[11px] uppercase tracking-wide font-semibold text-gray-500">Quick actions</p>
              <button onClick={() => { setEditForm({ ...user }); setShowEditModal(true); }} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 border-t border-gray-100"><Edit className="h-4 w-4 text-gray-400" />Edit profile</button>
              <button onClick={() => setShowWalletModal(true)} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 border-t border-gray-100"><Wallet className="h-4 w-4 text-gray-400" />Adjust wallet balance</button>
              <button onClick={() => setShowCouponModal(true)} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 border-t border-gray-100"><Gift className="h-4 w-4 text-gray-400" />Create coupon</button>
              {getBookingsWithRemainingPayment().length > 0 && (
                <button onClick={() => setShowReminderModal(true)} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-orange-700 hover:bg-orange-50 border-t border-gray-100"><Send className="h-4 w-4" />Send payment reminder ({getBookingsWithRemainingPayment().length})</button>
              )}
              {user.email && <a href={`mailto:${user.email}`} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 border-t border-gray-100"><Mail className="h-4 w-4 text-gray-400" />Email user</a>}
              {user.phone && <a href={`https://wa.me/91${String(user.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-800 hover:bg-gray-50 border-t border-gray-100"><MessageCircle className="h-4 w-4 text-gray-400" />WhatsApp</a>}
              <button onClick={handleImpersonate} disabled={impersonating} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-purple-700 hover:bg-purple-50 border-t border-gray-100 disabled:opacity-60">
                {impersonating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" /> : <LogIn className="h-4 w-4" />}Log in as user
              </button>
              <button onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true); }} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-red-600 hover:bg-red-50 border-t border-gray-100">
                <Trash2 className="h-4 w-4" />Delete user
              </button>
            </div>

            {/* Wallet & referral — compact */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><Gift className="h-3.5 w-3.5 text-green-600" />Referral</h3>
              {user.referral_code ? (
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono font-bold text-green-700 text-sm">{user.referral_code}</code>
                  <button onClick={() => navigator.clipboard?.writeText(user.referral_code)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Copy code"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              ) : <p className="text-sm text-gray-400">No referral code</p>}
              {user.referred_by && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1">Referred by</p>
                  {referrer ? (
                    <Link href={`/admin/users/${referrer.id}`} className="text-sm font-medium text-gray-900 hover:text-purple-700 hover:underline truncate block">{referrer.full_name || `${referrer.first_name || ''} ${referrer.last_name || ''}`.trim() || referrer.email || '—'}</Link>
                  ) : <p className="text-sm font-mono text-gray-500">{user.referred_by.substring(0, 8)}…</p>}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">Wallet balance</span>
                <span className="font-bold text-gray-900">₹{parseFloat(String(user.wallet_balance || 0)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </aside>
          </div>
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
      {/* Log in as user — link to open in a private window */}
      {impersonateLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0"><LogIn className="h-5 w-5 text-purple-600" /></div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Log in as this user</h3>
                <p className="text-xs text-gray-500">Opens their account exactly as they see it.</p>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 mb-4">
              Open this link in a <strong>private / incognito window</strong>. Opening it here would log you out of admin (browser sessions are shared) — a private window keeps your admin session intact.
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input readOnly value={impersonateLink} onFocus={(e) => e.target.select()} className="flex-1 h-10 px-3 text-xs rounded-lg bg-gray-50 border border-gray-200 text-gray-700 font-mono truncate" />
              <button onClick={() => { navigator.clipboard?.writeText(impersonateLink); setActionMessage({ type: 'success', text: 'Link copied — paste it into an incognito window.' }); setTimeout(() => setActionMessage(null), 4000); }} className="px-4 h-10 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 flex items-center gap-1.5 flex-shrink-0"><Copy className="h-4 w-4" />Copy</button>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">One-time link · expires shortly.</p>
            <button onClick={() => setImpersonateLink(null)} className="w-full py-2.5 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50">Done</button>
          </div>
        </div>
      )}

      {/* Delete user confirmation */}
      {showDeleteModal && user && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete this user?</h3>
                <p className="text-xs text-gray-500">This is permanent and cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Deleting <strong>{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}</strong> will permanently remove their account and <strong>all</strong> of the data below:
            </p>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm mb-4">
              <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Bookings</span><span className="font-semibold text-gray-900">{bookings.length}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Revenue collected</span><span className="font-semibold text-green-700">₹{Number(totalPaid || 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Pending dues</span><span className="font-semibold text-orange-600">₹{Number(totalPending || 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Wallet balance</span><span className="font-semibold text-gray-900">₹{parseFloat(String(user.wallet_balance || 0)).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Payment records &amp; referrals</span><span className="font-semibold text-gray-900">Erased</span></div>
            </div>
            <p className="text-xs text-gray-600 mb-2">Type <strong className="font-mono text-red-600">DELETE</strong> to confirm:</p>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE"
              className="w-full h-11 px-4 mb-4 text-sm rounded-xl bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting} className="flex-1 py-3 rounded-xl font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleDeleteUser} disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {deleting ? <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />Deleting…</> : <>Delete permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowEditModal(false); setEditForm(user); }}>
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900">Edit user</h2>
              <button onClick={() => { setShowEditModal(false); setEditForm(user); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First name">
                  <input type="text" value={editForm?.first_name || ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Last name">
                  <input type="text" value={editForm?.last_name || ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Full name" className="sm:col-span-2">
                  <input type="text" value={editForm?.full_name || ''} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Phone">
                  <input type="text" value={editForm?.phone || editForm?.phone_number || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value, phone_number: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Alternative phone">
                  <input type="text" value={editForm?.alternative_number || ''} onChange={(e) => setEditForm({ ...editForm, alternative_number: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Gender">
                  <select value={editForm?.gender || ''} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className={inputCls}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Date of birth">
                  <input type="date" value={editForm?.date_of_birth ? String(editForm.date_of_birth).split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Aadhaar ID" className="sm:col-span-2">
                  <input type="text" value={editForm?.aadhaar_id || ''} onChange={(e) => setEditForm({ ...editForm, aadhaar_id: e.target.value })} className={inputCls} placeholder="12 digit number" />
                </Field>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Emergency contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Name">
                    <input type="text" value={editForm?.emergency_contact_name || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Phone">
                    <input type="text" value={editForm?.emergency_contact || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Relation">
                    <input type="text" value={editForm?.emergency_contact_relation || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_relation: e.target.value })} className={inputCls} placeholder="Father, Mother…" />
                  </Field>
                </div>
              </div>

              <Field label="Bio">
                <textarea value={editForm?.bio || ''} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} className={inputCls + ' resize-none'} />
              </Field>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex justify-end gap-2">
              <button onClick={() => { setShowEditModal(false); setEditForm(user); }} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleUpdateUser} disabled={actionLoading} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {actionLoading ? 'Saving…' : 'Save changes'}
              </button>
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


const inputCls = "w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-colors";

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
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
