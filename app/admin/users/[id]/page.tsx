'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  Copy,
  Edit,
  Eye,
  Gift,
  Hash,
  IndianRupee,
  Info,
  LogIn,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Send,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

type TabKey = 'overview' | 'bookings' | 'activity';

const pageShell = 'min-h-screen bg-[#F7F8FC] text-[#17171C]';
const cardCls = 'rounded-2xl border border-[#E7E8EE] bg-white shadow-[0_8px_24px_rgba(23,23,28,0.04)]';
const inputCls = 'h-11 w-full rounded-xl border border-[#DADCE5] bg-white px-3 text-sm text-[#17171C] outline-none transition placeholder:text-[#9A9DA8] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10 disabled:bg-[#F7F8FC]';
const textareaCls = 'min-h-[96px] w-full rounded-xl border border-[#DADCE5] bg-white px-3 py-2.5 text-sm text-[#17171C] outline-none transition placeholder:text-[#9A9DA8] focus:border-[#8758F6] focus:ring-4 focus:ring-[#8758F6]/10';

function formatCurrency(value: unknown) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions, fallback = 'Not provided') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-IN', options || { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  return String(value);
}

function getFullName(user: any) {
  return String(user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Unnamed user');
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

function maskAadhaar(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• •••• ${digits.slice(-4)}`;
}

function statusLabel(status: string | null | undefined) {
  const raw = status || 'pending';
  if (raw === 'seat_locked') return 'Seat Locked';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status: string | null | undefined) {
  switch (status) {
    case 'confirmed':
    case 'completed':
    case 'verified':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'seat_locked':
    case 'pending':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'cancelled':
    case 'rejected':
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-[#E7E8EE] bg-[#FAFAFD] text-[#666873]';
  }
}

function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants = {
    primary: 'border-[#8758F6] bg-[#8758F6] text-white hover:bg-[#7647E8]',
    secondary: 'border-[#DADCE5] bg-white text-[#17171C] hover:border-[#C9CBD6] hover:bg-[#FAFAFD]',
    danger: 'border-red-200 bg-white text-red-600 hover:bg-red-50',
    ghost: 'border-transparent bg-transparent text-[#666873] hover:bg-[#F7F8FC] hover:text-[#17171C]',
  };

  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-[#8758F6]/15 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, icon, badge, children }: { title: string; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-[#E7E8EE] px-5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-semibold text-[#17171C]">{title}</h2>
        </div>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[#666873]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-[#17171C]">{value}</dd>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-[#4F5260]">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({
  title,
  subtitle,
  icon,
  children,
  footer,
  onClose,
  width = 'max-w-2xl',
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
  width?: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#E7E8EE] bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl ${width}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex min-h-[68px] items-center justify-between gap-4 border-b border-[#E7E8EE] bg-white px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-[#8758F6]">{icon}</div>}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[#17171C]">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-[#666873]">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#666873] outline-none hover:bg-[#F7F8FC] focus:ring-4 focus:ring-[#8758F6]/15" aria-label="Close modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[#E7E8EE] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>
      </div>
    </div>
  );
}

export default function AdminUserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [referrer, setReferrer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<any>(null);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletAction, setWalletAction] = useState<'add' | 'set'>('add');
  const [couponAmount, setCouponAmount] = useState('');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [couponDescription, setCouponDescription] = useState('Get ₹500 Discount on next booking');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailSenders, setEmailSenders] = useState<Array<{ email: string; label: string }>>([]);
  const [emailSenderNames, setEmailSenderNames] = useState<string[]>([]);
  const [emailSender, setEmailSender] = useState('support@ghumakkars.in');
  const [emailSenderName, setEmailSenderName] = useState('Ghumakkars Support');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailInstruction, setEmailInstruction] = useState('');
  const [emailLength, setEmailLength] = useState<'short' | 'standard' | 'detailed'>('standard');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailDraftGenerated, setEmailDraftGenerated] = useState(false);
  const [emailDraftUpdated, setEmailDraftUpdated] = useState(false);

  useEffect(() => {
    checkUser();
    fetchUserDetails();
  }, [params.id]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreMenu]);

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
      setActionMessage({ type: 'success', text: 'User updated successfully.' });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity');
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
      setActionMessage({ type: 'success', text: `Wallet ${walletAction === 'add' ? 'credited' : 'updated'} successfully.` });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity');
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
      setActionMessage({ type: 'success', text: data.warning || 'Coupon generated and email sent successfully.' });
      setTimeout(() => setActionMessage(null), 5000);
      await fetchUserDetails();
      setActiveTab('activity');
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
      setActionMessage({ type: 'success', text: 'Payment reminder sent successfully.' });
      setTimeout(() => setActionMessage(null), 3000);
      await fetchUserDetails();
      setActiveTab('activity');
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const loadEmailSenders = async () => {
    if (emailSenders.length > 0) return;
    const response = await fetch('/api/admin/email-senders');
    if (!response.ok) {
      throw new Error('Could not load sender addresses');
    }
    const data = await response.json();
    setEmailSenders(data.senders || []);
    setEmailSenderNames(data.senderNames || []);
    if (data.senders?.some((sender: any) => sender.email === 'support@ghumakkars.in')) {
      setEmailSender('support@ghumakkars.in');
    } else if (data.senders?.[0]?.email) {
      setEmailSender(data.senders[0].email);
    }
    if (data.senderNames?.includes('Ghumakkars Support')) {
      setEmailSenderName('Ghumakkars Support');
    }
  };

  const openEmailComposer = async () => {
    setShowMoreMenu(false);
    setShowEmailModal(true);
    setShowEmailPreview(false);
    setEmailDraftGenerated(false);
    setEmailDraftUpdated(false);
    setEmailSubject('');
    setEmailMessage('');
    setEmailInstruction('');
    setShowAiPanel(false);
    try {
      await loadEmailSenders();
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Could not load sender addresses' });
    }
  };

  const handleGenerateEmailDraft = async (transform?: string) => {
    if (!emailInstruction.trim() && !transform) {
      setActionMessage({ type: 'error', text: 'Tell AI what the email should say.' });
      return;
    }

    setEmailGenerating(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/email/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: emailInstruction,
          length: emailLength,
          senderEmail: emailSender,
          senderName: emailSenderName,
          existingSubject: emailSubject,
          existingBody: emailMessage,
          transform,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Draft could not be generated');
      setEmailSubject(data.subject || '');
      setEmailMessage(data.body || '');
      setEmailDraftGenerated(true);
      setEmailDraftUpdated(true);
      setTimeout(() => setEmailDraftUpdated(false), 1600);
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Generation failed. Your draft was preserved.' });
    } finally {
      setEmailGenerating(false);
    }
  };

  const handleSendComposedEmail = async () => {
    setEmailSending(true);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${params.id}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: emailSender,
          senderName: emailSenderName,
          subject: emailSubject,
          message: emailMessage,
          idempotencyKey: `${params.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Email could not be sent. Your draft has been preserved.');
      setActionMessage({ type: 'success', text: `Email sent to ${data.recipient || user.email}` });
      setShowEmailModal(false);
      setShowEmailPreview(false);
      setTimeout(() => setActionMessage(null), 4000);
      await fetchUserDetails();
      setActiveTab('activity');
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Email could not be sent. Your draft has been preserved.' });
    } finally {
      setEmailSending(false);
    }
  };

  const handleImpersonate = async () => {
    setImpersonating(true);
    setActionMessage(null);
    setShowMoreMenu(false);
    try {
      const res = await fetch(`/api/admin/users/${params.id}/impersonate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create a login link');
      setImpersonateLink(`${window.location.origin}/auth/impersonate?token_hash=${encodeURIComponent(data.token_hash)}`);
    } catch (e: any) {
      setActionMessage({ type: 'error', text: e.message });
    } finally {
      setImpersonating(false);
    }
  };

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
    return bookings.filter((booking) => {
      if (booking.booking_status === 'confirmed' || booking.booking_status === 'cancelled' || booking.booking_status === 'rejected') return false;
      const totalPaid = booking.payment_transactions
        ?.filter((pt: any) => pt.payment_status === 'verified')
        .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;
      const remaining = parseFloat(String(booking.final_amount || booking.total_price || 0)) - totalPaid;
      return remaining > 0;
    });
  };

  const metrics = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.booking_status === 'confirmed').length;
    const cancelled = bookings.filter((booking) => booking.booking_status === 'cancelled' || booking.booking_status === 'rejected').length;
    const paid = bookings.reduce((sum, booking) => {
      const bookingPaid = booking.payment_transactions
        ?.filter((pt: any) => pt.payment_status === 'verified')
        .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0) || 0;
      return sum + bookingPaid;
    }, 0);
    const pendingDue = bookings.reduce((sum, booking) => {
      const total = parseFloat(String(booking.final_amount || booking.total_price || 0));
      const paidForBooking = booking.payment_transactions
        ?.filter((pt: any) => pt.payment_status === 'verified')
        .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0) || 0;
      return sum + Math.max(0, total - paidForBooking);
    }, 0);

    return { confirmed, cancelled, paid, pendingDue, remainingPaymentCount: getBookingsWithRemainingPayment().length };
  }, [bookings]);

  if (loading) {
    return (
      <div className={`${pageShell} p-4 sm:p-8`}>
        <div className="mx-auto max-w-[1320px] space-y-5">
          <div className="h-5 w-28 animate-pulse rounded bg-[#E7E8EE]" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-[#E7E8EE]" />
              <div className="space-y-2">
                <div className="h-6 w-48 animate-pulse rounded bg-[#E7E8EE]" />
                <div className="h-4 w-72 animate-pulse rounded bg-[#E7E8EE]" />
              </div>
            </div>
            <div className="hidden h-10 w-64 animate-pulse rounded-xl bg-[#E7E8EE] sm:block" />
          </div>
          <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-[#E7E8EE] bg-white sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse border-r border-[#E7E8EE] bg-white" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className={`${pageShell} flex items-center justify-center p-4`}>
        <div className={`${cardCls} max-w-md p-8 text-center`}>
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold">Could not load user</h2>
          <p className="mt-2 text-sm text-[#666873]">{error}</p>
          <Link href="/admin/users" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#8758F6] px-4 text-sm font-semibold text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to users
          </Link>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const fullName = getFullName(user);
  const initials = getInitials(fullName);
  const userIdShort = user.id ? String(user.id).slice(0, 8).toUpperCase() : 'UNKNOWN';
  const remainingPaymentBookings = getBookingsWithRemainingPayment();

  return (
    <div className={pageShell}>
      <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#4F5260] hover:text-[#8758F6]">
          <ArrowLeft className="h-4 w-4" />
          All users
        </Link>

        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E8EAF0] text-base font-bold text-[#273144]">
              {user.avatar_url ? <img src={user.avatar_url} alt={fullName} className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-[#17171C] sm:text-[28px]">{fullName}</h1>
                <Badge className={user.email_verified ? 'border-green-200 bg-green-50 text-green-700' : 'border-[#E7E8EE] bg-[#FAFAFD] text-[#666873]'}>
                  {user.email_verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#4F5260]">
                <span className="max-w-[280px] truncate">{displayValue(user.email)}</span>
                <span className="text-[#B0B3BD]">·</span>
                <span>{displayValue(user.phone || user.phone_number)}</span>
                <span className="text-[#B0B3BD]">·</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(user.id);
                    setActionMessage({ type: 'success', text: 'User ID copied.' });
                    setTimeout(() => setActionMessage(null), 2500);
                  }}
                  className="inline-flex items-center gap-1 rounded-md font-mono text-xs text-[#666873] hover:text-[#8758F6] focus:outline-none focus:ring-4 focus:ring-[#8758F6]/15"
                >
                  #{userIdShort}
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => { setEditForm({ ...user }); setShowEditModal(true); }}>
              <Edit className="h-4 w-4" />
              Edit user
            </Button>
            <Button onClick={() => setShowWalletModal(true)}>Wallet</Button>
            <Button onClick={() => setShowCouponModal(true)}>Create coupon</Button>
            <div className="relative" ref={moreMenuRef}>
              <Button onClick={() => setShowMoreMenu((value) => !value)} aria-expanded={showMoreMenu} aria-haspopup="menu">
                More
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showMoreMenu && (
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[#E7E8EE] bg-white py-1 shadow-xl" role="menu">
                  {user.email && <button type="button" onClick={openEmailComposer} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[#17171C] hover:bg-[#F7F8FC]" role="menuitem"><Mail className="h-4 w-4 text-[#8A8D99]" />Email user</button>}
                  {user.phone && <a href={`https://wa.me/91${String(user.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[#17171C] hover:bg-[#F7F8FC]" role="menuitem"><MessageCircle className="h-4 w-4 text-[#8A8D99]" />WhatsApp</a>}
                  <button type="button" onClick={handleImpersonate} disabled={impersonating} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[#17171C] hover:bg-[#F7F8FC] disabled:opacity-60" role="menuitem">
                    {impersonating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#8758F6] border-t-transparent" /> : <LogIn className="h-4 w-4 text-[#8758F6]" />}
                    View as user
                  </button>
                  <div className="my-1 border-t border-[#E7E8EE]" />
                  <button type="button" onClick={() => { setDeleteConfirm(''); setShowDeleteModal(true); setShowMoreMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50" role="menuitem">
                    <Trash2 className="h-4 w-4" />
                    Delete user
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className={`${cardCls} mb-5 grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4`}>
          <MetricBlock label="Bookings" value={bookings.length} sub={`${metrics.confirmed} confirmed`} />
          <MetricBlock label="Total spent" value={formatCurrency(metrics.paid)} sub={`${metrics.cancelled} cancelled`} />
          <MetricBlock label="Wallet balance" value={formatCurrency(user.wallet_balance)} sub="balance" />
          <MetricBlock label="Member since" value={formatDate(user.created_at, { month: 'short', year: 'numeric' }, 'Not provided')} sub={user.email_verified ? 'verified' : 'unverified'} />
        </section>

        <nav className={`${cardCls} mb-5 flex overflow-x-auto p-1`} aria-label="User detail tabs">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Hash className="h-4 w-4" />}>Overview</TabButton>
          <TabButton active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} icon={<Package className="h-4 w-4" />}>Bookings <span className="rounded-full bg-white/60 px-1.5 text-xs">{bookings.length}</span></TabButton>
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={<Activity className="h-4 w-4" />}>Activity</TabButton>
        </nav>

        {activeTab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <SectionCard title="Profile Details" icon={<User className="h-5 w-5 text-[#8758F6]" />}>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <DetailItem label="Full name" value={fullName} />
                  <DetailItem label="Email" value={displayValue(user.email)} />
                  <DetailItem label="Primary phone" value={displayValue(user.phone || user.phone_number)} />
                  <DetailItem label="Alternative phone" value={displayValue(user.alternative_number)} />
                  <DetailItem label="Gender" value={<span className="capitalize">{displayValue(user.gender)}</span>} />
                  <DetailItem label="Date of birth" value={formatDate(user.date_of_birth)} />
                  <DetailItem label="Aadhaar ID" value={maskAadhaar(user.aadhaar_id)} />
                  <DetailItem label="Last login" value={formatDateTime(authUser?.last_sign_in_at)} />
                  <DetailItem label="Account created" value={formatDateTime(authUser?.created_at || user.created_at)} />
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-[#666873]">Bio</dt>
                    <dd className="mt-1 text-sm font-medium text-[#17171C]">{displayValue(user.bio)}</dd>
                  </div>
                  {(user.emergency_contact || user.emergency_contact_name || user.emergency_contact_relation) && (
                    <div className="grid gap-4 rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-4 sm:col-span-2 sm:grid-cols-3">
                      <DetailItem label="Emergency name" value={displayValue(user.emergency_contact_name)} />
                      <DetailItem label="Emergency phone" value={displayValue(user.emergency_contact)} />
                      <DetailItem label="Relation" value={displayValue(user.emergency_contact_relation)} />
                    </div>
                  )}
                </dl>
              </SectionCard>

              <SectionCard title="Login Activity" icon={<Activity className="h-5 w-5 text-[#8758F6]" />}>
                <div className="space-y-4">
                  <TimelineItem title="Account created" date={formatDateTime(authUser?.created_at || user.created_at)} icon={<User className="h-4 w-4" />} />
                  <TimelineItem title="Last login" date={formatDateTime(authUser?.last_sign_in_at)} icon={<LogIn className="h-4 w-4" />} />
                </div>
                <div className="mt-5 rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-3 text-xs text-[#666873]">
                  Sign-in method: <span className="capitalize">{authUser?.app_metadata?.provider || authUser?.app_metadata?.providers?.[0] || 'email'}</span>. IP/location data is not stored by Supabase Auth by default.
                </div>
              </SectionCard>
            </div>

            <aside className="space-y-5">
              <SectionCard title="Referral" icon={<Gift className="h-5 w-5 text-green-600" />}>
                {user.referral_code ? (
                  <div className="flex items-center justify-between gap-3">
                    <code className="truncate font-mono text-sm font-bold text-green-700">{user.referral_code}</code>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(user.referral_code); setActionMessage({ type: 'success', text: 'Referral code copied.' }); setTimeout(() => setActionMessage(null), 2500); }} className="rounded-lg p-2 text-[#666873] hover:bg-[#F7F8FC]" aria-label="Copy referral code">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#666873]">No referral code</p>
                )}
                {user.referred_by && (
                  <div className="mt-4 border-t border-[#E7E8EE] pt-4">
                    <p className="text-xs font-medium text-[#666873]">Referred by</p>
                    {referrer ? (
                      <Link href={`/admin/users/${referrer.id}`} className="mt-1 block truncate text-sm font-semibold text-[#17171C] hover:text-[#8758F6]">
                        {getFullName(referrer)}
                      </Link>
                    ) : (
                      <p className="mt-1 font-mono text-sm text-[#666873]">{String(user.referred_by).slice(0, 8)}...</p>
                    )}
                  </div>
                )}
                <div className="mt-4 flex justify-between border-t border-[#E7E8EE] pt-4 text-sm">
                  <span className="text-[#666873]">Wallet balance</span>
                  <span className="font-semibold">{formatCurrency(user.wallet_balance)}</span>
                </div>
              </SectionCard>

              <SectionCard title="Account Information" icon={<ShieldCheck className="h-5 w-5 text-[#8758F6]" />}>
                <div className="space-y-3 text-sm">
                  <InfoRow label="Verification" value={user.email_verified ? 'Verified' : 'Unverified'} />
                  <InfoRow label="Member since" value={formatDate(user.created_at, { day: 'numeric', month: 'short', year: 'numeric' })} />
                  <InfoRow label="User ID" value={`#${userIdShort}`} />
                </div>
              </SectionCard>
            </aside>
          </div>
        )}

        {activeTab === 'bookings' && (
          <SectionCard title="Booking History" icon={<Package className="h-5 w-5 text-[#8758F6]" />} badge={<Badge className="border-[#D8CCFF] bg-[#F1EBFF] text-[#8758F6]">{bookings.length} total</Badge>}>
            {bookings.length ? (
              <div className="space-y-3">
                {bookings.map((booking) => {
                  const verifiedPaid = booking.payment_transactions
                    ?.filter((pt: any) => pt.payment_status === 'verified')
                    .reduce((sum: number, pt: any) => sum + parseFloat(String(pt.amount || 0)), 0) || 0;
                  const remaining = Math.max(0, parseFloat(String(booking.final_amount || booking.total_price || 0)) - verifiedPaid);
                  const hasPendingPayment = remaining > 0 && !['confirmed', 'cancelled', 'rejected'].includes(booking.booking_status);

                  return (
                    <article key={booking.id} className="rounded-xl border border-[#E7E8EE] bg-white p-4 transition hover:border-[#D8CCFF] hover:bg-[#FAF7FF]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-[#17171C]">{booking.trips?.title || 'Trip'}</h3>
                          <p className="mt-1 text-sm text-[#666873]">{booking.trips?.destination || 'Not provided'}</p>
                        </div>
                        <Badge className={statusClasses(booking.booking_status)}>{statusLabel(booking.booking_status)}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
                        <InfoBlock label="Trip date" value={booking.trips?.start_date ? formatDate(booking.trips.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled'} />
                        <InfoBlock label="Participants" value={String(booking.number_of_participants || 1)} />
                        <InfoBlock label="Total amount" value={formatCurrency(booking.final_amount || booking.total_price)} />
                        <InfoBlock label="Booking date" value={formatDate(booking.created_at, { day: 'numeric', month: 'short', year: 'numeric' })} />
                      </div>
                      <div className="mt-4 flex flex-col gap-3 border-t border-[#E7E8EE] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {booking.coupon_code && <Badge className="border-green-200 bg-green-50 text-green-700">Coupon: {booking.coupon_code}</Badge>}
                          {booking.payment_transactions?.map((pt: any) => (
                            <Badge key={pt.id} className={statusClasses(pt.payment_status)}>
                              {formatCurrency(pt.amount)} ({pt.payment_status})
                            </Badge>
                          ))}
                          {hasPendingPayment && <Badge className="border-orange-200 bg-orange-50 text-orange-700">Remaining {formatCurrency(remaining)}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {hasPendingPayment && (
                            <Button className="h-9" onClick={() => { setSelectedBooking(booking); setShowReminderModal(true); }}>
                              <Send className="h-4 w-4" />
                              Send reminder
                            </Button>
                          )}
                          <Link href={`/admin/bookings/${booking.id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#DADCE5] bg-white px-3 text-sm font-semibold text-[#17171C] hover:border-[#8758F6] hover:text-[#8758F6]">
                            <Eye className="h-4 w-4" />
                            View details
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<Package className="h-6 w-6" />} title="No bookings found" description="Bookings for this customer will appear here." />
            )}
          </SectionCard>
        )}

        {activeTab === 'activity' && (
          <SectionCard title="Activity Log" icon={<Activity className="h-5 w-5 text-[#8758F6]" />} badge={<Badge className="border-[#D8CCFF] bg-[#F1EBFF] text-[#8758F6]">{activities.length} actions</Badge>}>
            {activities.length ? (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const adminName = activity.admin?.full_name || [activity.admin?.first_name, activity.admin?.last_name].filter(Boolean).join(' ') || activity.admin?.email || 'Admin';
                  return (
                    <article key={activity.id} className="rounded-xl border border-[#E7E8EE] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-[#8758F6]">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#17171C]">{activity.action_description}</p>
                              <p className="mt-1 text-xs text-[#666873]">By {adminName} · {formatDateTime(activity.created_at)}</p>
                            </div>
                            <Badge className="border-[#E7E8EE] bg-[#FAFAFD] text-[#666873]">{statusLabel(activity.action_type)}</Badge>
                          </div>
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <details className="mt-3 rounded-lg border border-[#E7E8EE] bg-[#FAFAFD] p-3 text-xs text-[#666873]">
                              <summary className="cursor-pointer font-medium">View details</summary>
                              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">{JSON.stringify(activity.metadata, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<Activity className="h-6 w-6" />} title="No admin activity yet" description="Actions performed on this account will appear here." />
            )}
          </SectionCard>
        )}
      </div>

      {showEmailModal && user && (
        <ModalShell
          title="Email user"
          subtitle="Write and send an email directly from the Ghumakkars dashboard."
          icon={<Mail className="h-5 w-5" />}
          onClose={() => setShowEmailModal(false)}
          width="max-w-3xl"
          footer={(
            <>
              <Button className="sm:mr-auto" onClick={() => setShowEmailPreview((value) => !value)} disabled={!emailSubject.trim() && !emailMessage.trim()}>
                {showEmailPreview ? 'Hide preview' : 'Preview'}
              </Button>
              <Button onClick={() => setShowEmailModal(false)} disabled={emailSending}>Cancel</Button>
              <Button variant="primary" onClick={handleSendComposedEmail} disabled={emailSending || !user.email || !emailSender || !emailSenderName.trim() || !emailSubject.trim() || !emailMessage.trim()}>
                {emailSending ? 'Sending...' : 'Send email'}
              </Button>
            </>
          )}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#666873]">Customer</p>
              <p className="mt-1 text-sm font-semibold text-[#17171C]">{fullName}</p>
              <p className="mt-0.5 text-sm text-[#666873]">{user.email}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="To">
                <div className="flex h-11 items-center rounded-xl border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-800">
                  <span className="truncate">{fullName} &lt;{user.email}&gt;</span>
                </div>
              </Field>
              <Field label="Send from">
                <select value={emailSender} onChange={(event) => setEmailSender(event.target.value)} className={inputCls}>
                  {emailSenders.map((sender) => (
                    <option key={sender.email} value={sender.email}>{sender.email} - {sender.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sender name">
                <input list="email-sender-names" value={emailSenderName} onChange={(event) => setEmailSenderName(event.target.value.replace(/[\r\n]/g, ''))} className={inputCls} placeholder="Ghumakkars Support" />
                <datalist id="email-sender-names">
                  {emailSenderNames.map((name) => <option key={name} value={name} />)}
                </datalist>
              </Field>
              <Field label="Subject">
                <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value.replace(/[\r\n]/g, '').slice(0, 140))} className={`${inputCls} ${emailDraftUpdated ? 'ring-4 ring-[#8758F6]/10' : ''}`} placeholder="Write a clear subject" />
                <span className="mt-1 block text-right text-xs text-[#8A8D99]">{emailSubject.length}/120 recommended</span>
              </Field>
            </div>

            {emailSender === 'no-reply@ghumakkars.in' && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                This address is for automated notifications. Replies should be directed to support@ghumakkars.in.
              </div>
            )}

            <div className="rounded-2xl border border-[#E7E8EE] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#17171C]">AI email writer</h3>
                  <p className="mt-0.5 text-xs text-[#666873]">Generate a draft, then review and edit before sending.</p>
                </div>
                <Button onClick={() => setShowAiPanel((value) => !value)}>
                  {showAiPanel ? 'Hide AI' : 'Write with AI'}
                </Button>
              </div>

              {showAiPanel && (
                <div className="mt-4 space-y-4 border-t border-[#E7E8EE] pt-4">
                  <Field label="What should the email say?">
                    <textarea
                      value={emailInstruction}
                      onChange={(event) => setEmailInstruction(event.target.value)}
                      className={textareaCls}
                      placeholder="Write an email telling the customer that I have sent their ₹2,000 refund and it may take 5-7 working days to appear."
                    />
                  </Field>
                  <div>
                    <p className="mb-2 text-xs font-medium text-[#4F5260]">Email length</p>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F7F8FC] p-1">
                      {[
                        ['short', 'Short', '50-90 words'],
                        ['standard', 'Standard', '100-180 words'],
                        ['detailed', 'Detailed', '200-350 words'],
                      ].map(([value, label, words]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEmailLength(value as 'short' | 'standard' | 'detailed')}
                          className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition ${emailLength === value ? 'bg-white text-[#8758F6] shadow-sm' : 'text-[#666873] hover:text-[#17171C]'}`}
                        >
                          {label}
                          <span className="mt-0.5 block text-[10px] font-medium text-[#8A8D99]">{words}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => handleGenerateEmailDraft()} disabled={emailGenerating}>
                      {emailGenerating ? 'Generating draft...' : emailDraftGenerated ? 'Regenerate' : 'Generate draft'}
                    </Button>
                    {emailDraftGenerated && (
                      <>
                        <Button onClick={() => handleGenerateEmailDraft('Make it shorter')} disabled={emailGenerating}>Make shorter</Button>
                        <Button onClick={() => handleGenerateEmailDraft('Make it more detailed')} disabled={emailGenerating}>More detailed</Button>
                        <Button onClick={() => handleGenerateEmailDraft('Make it more formal')} disabled={emailGenerating}>More formal</Button>
                        <Button onClick={() => handleGenerateEmailDraft('Make it more friendly')} disabled={emailGenerating}>More friendly</Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Field label="Message">
              <textarea
                value={emailMessage}
                onChange={(event) => setEmailMessage(event.target.value)}
                className={`${textareaCls} min-h-[260px] ${emailDraftUpdated ? 'ring-4 ring-[#8758F6]/10' : ''}`}
                placeholder="Write your email here..."
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigator.clipboard?.writeText(emailMessage)} disabled={!emailMessage.trim()}><Copy className="h-4 w-4" />Copy</Button>
              <Button onClick={() => { setEmailSubject(''); setEmailMessage(''); setEmailDraftGenerated(false); }} disabled={!emailSubject && !emailMessage}>Clear</Button>
              {emailDraftGenerated && <span className="inline-flex items-center text-xs font-medium text-[#666873]">AI-generated draft. Review before sending.</span>}
            </div>

            {showEmailPreview && (
              <div className="rounded-2xl border border-[#E7E8EE] bg-[#FAFAFD] p-4">
                <h3 className="text-sm font-semibold text-[#17171C]">Preview</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <InfoRow label="From" value={`${emailSenderName || 'Ghumakkars'} <${emailSender}>`} />
                  <InfoRow label="To" value={`${fullName} <${user.email}>`} />
                  <InfoRow label="Subject" value={emailSubject || 'Not provided'} />
                  <InfoRow label="Reply-to" value={emailSender === 'no-reply@ghumakkars.in' ? 'support@ghumakkars.in' : emailSender} />
                </div>
                <div className="mt-4 whitespace-pre-wrap rounded-xl border border-[#E7E8EE] bg-white p-4 text-sm leading-6 text-[#17171C]">
                  {emailMessage || 'No message written yet.'}
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {showEditModal && user && (
        <ModalShell
          title="Edit user"
          subtitle="Update personal and contact information."
          icon={<Edit className="h-5 w-5" />}
          onClose={() => { setShowEditModal(false); setEditForm(user); }}
          footer={(
            <>
              <Button onClick={() => { setShowEditModal(false); setEditForm(user); }}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdateUser} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save changes'}</Button>
            </>
          )}
        >
          <div className="space-y-6">
            <FormSection title="Personal information">
              <Field label="First name"><input value={editForm?.first_name || ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} /></Field>
              <Field label="Last name"><input value={editForm?.last_name || ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} /></Field>
              <Field label="Full name" className="sm:col-span-2"><input value={editForm?.full_name || ''} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className={inputCls} /></Field>
              <Field label="Gender">
                <select value={editForm?.gender || ''} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className={inputCls}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Date of birth"><input type="date" value={editForm?.date_of_birth ? String(editForm.date_of_birth).split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} className={inputCls} /></Field>
            </FormSection>
            <FormSection title="Contact information">
              <Field label="Phone"><input value={editForm?.phone || editForm?.phone_number || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value, phone_number: e.target.value })} className={inputCls} /></Field>
              <Field label="Alternative phone"><input value={editForm?.alternative_number || ''} onChange={(e) => setEditForm({ ...editForm, alternative_number: e.target.value })} className={inputCls} /></Field>
            </FormSection>
            <FormSection title="Identity">
              <Field label="Aadhaar ID" className="sm:col-span-2"><input value={editForm?.aadhaar_id || ''} onChange={(e) => setEditForm({ ...editForm, aadhaar_id: e.target.value })} className={inputCls} placeholder="12 digit number" /></Field>
            </FormSection>
            <FormSection title="Emergency contact">
              <Field label="Name"><input value={editForm?.emergency_contact_name || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} className={inputCls} /></Field>
              <Field label="Phone"><input value={editForm?.emergency_contact || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} className={inputCls} /></Field>
              <Field label="Relation"><input value={editForm?.emergency_contact_relation || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact_relation: e.target.value })} className={inputCls} placeholder="Father, Mother" /></Field>
            </FormSection>
            <FormSection title="Additional information">
              <Field label="Bio" className="sm:col-span-2"><textarea value={editForm?.bio || ''} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} className={textareaCls} /></Field>
            </FormSection>
          </div>
        </ModalShell>
      )}

      {showWalletModal && (
        <ModalShell
          title="Update wallet balance"
          icon={<Wallet className="h-5 w-5" />}
          onClose={() => setShowWalletModal(false)}
          width="max-w-md"
          footer={(
            <>
              <Button onClick={() => setShowWalletModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdateWallet} disabled={actionLoading}>{actionLoading ? 'Updating...' : 'Update wallet'}</Button>
            </>
          )}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#666873]">Current balance</p>
              <p className="mt-2 text-3xl font-semibold text-[#17171C]">{formatCurrency(user.wallet_balance)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-[#4F5260]">Action type</p>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F7F8FC] p-1">
                <button type="button" onClick={() => setWalletAction('add')} className={`h-10 rounded-lg text-sm font-semibold transition ${walletAction === 'add' ? 'bg-white text-[#8758F6] shadow-sm' : 'text-[#666873] hover:text-[#17171C]'}`}>Add amount</button>
                <button type="button" onClick={() => setWalletAction('set')} className={`h-10 rounded-lg text-sm font-semibold transition ${walletAction === 'set' ? 'bg-white text-[#8758F6] shadow-sm' : 'text-[#666873] hover:text-[#17171C]'}`}>Set amount</button>
              </div>
            </div>
            <Field label={walletAction === 'add' ? 'Amount to add' : 'New wallet balance'}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#666873]">₹</span>
                <input type="number" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} placeholder="Enter amount" className={`${inputCls} pl-8`} />
              </div>
            </Field>
          </div>
        </ModalShell>
      )}

      {showCouponModal && (
        <ModalShell
          title="Generate discount coupon"
          subtitle="Create a coupon for this customer."
          icon={<Gift className="h-5 w-5" />}
          onClose={() => setShowCouponModal(false)}
          width="max-w-md"
          footer={(
            <>
              <Button onClick={() => setShowCouponModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleGenerateCoupon} disabled={actionLoading}>{actionLoading ? 'Generating...' : 'Generate and send'}</Button>
            </>
          )}
        >
          <div className="space-y-4">
            <Field label="Discount amount"><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#666873]">₹</span><input type="number" value={couponAmount} onChange={(e) => setCouponAmount(e.target.value)} placeholder="500" className={`${inputCls} pl-8`} /></div></Field>
            <Field label="Expiry date, optional"><input type="date" value={couponExpiry} onChange={(e) => setCouponExpiry(e.target.value)} className={inputCls} /></Field>
            <Field label="Description"><textarea value={couponDescription} onChange={(e) => setCouponDescription(e.target.value)} rows={3} className={textareaCls} /></Field>
            <div className="flex gap-2 rounded-xl border border-[#E7E8EE] bg-[#FAFAFD] p-3 text-sm text-[#4F5260]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8758F6]" />
              A unique coupon code will be generated and sent to the user&apos;s email address.
            </div>
          </div>
        </ModalShell>
      )}

      {showReminderModal && (
        <ModalShell
          title="Send payment reminder"
          subtitle="Email a pending payment reminder for one booking."
          icon={<Send className="h-5 w-5" />}
          onClose={() => setShowReminderModal(false)}
          width="max-w-md"
          footer={(
            <>
              <Button onClick={() => setShowReminderModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSendReminder} disabled={actionLoading || !selectedBooking}>{actionLoading ? 'Sending...' : 'Send reminder'}</Button>
            </>
          )}
        >
          <Field label="Select booking">
            <select value={selectedBooking?.id || ''} onChange={(e) => setSelectedBooking(bookings.find((booking) => booking.id === e.target.value))} className={inputCls}>
              <option value="">Select a booking...</option>
              {remainingPaymentBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>{booking.trips?.title || 'Trip'} - remaining payment due</option>
              ))}
            </select>
          </Field>
        </ModalShell>
      )}

      {impersonateLink && (
        <ModalShell
          title="Log in as this user"
          subtitle="Access the account exactly as the customer sees it."
          icon={<LogIn className="h-5 w-5" />}
          onClose={() => setImpersonateLink(null)}
          width="max-w-md"
          footer={(
            <>
              <Button onClick={() => setImpersonateLink(null)}>Done</Button>
              <Button variant="primary" onClick={() => window.open(impersonateLink, '_blank', 'noopener')}>Open user account</Button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              Opening this link in the current browser may replace the admin session. Use a separate browser or incognito window. The link is temporary and private.
            </div>
            <div className="flex gap-2">
              <input readOnly value={impersonateLink} onFocus={(e) => e.target.select()} className={`${inputCls} min-w-0 font-mono text-xs`} />
              <Button variant="primary" onClick={() => { navigator.clipboard?.writeText(impersonateLink); setActionMessage({ type: 'success', text: 'Login link copied.' }); setTimeout(() => setActionMessage(null), 2500); }}><Copy className="h-4 w-4" />Copy</Button>
            </div>
            <p className="text-xs text-[#666873]">One-time link · Expires shortly · Keep it private</p>
          </div>
        </ModalShell>
      )}

      {showDeleteModal && user && (
        <ModalShell
          title="Delete this user?"
          subtitle="This is permanent and cannot be undone."
          icon={<Trash2 className="h-5 w-5" />}
          onClose={() => setShowDeleteModal(false)}
          width="max-w-md"
          footer={(
            <>
              <Button onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteUser} disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}>{deleting ? 'Deleting...' : 'Delete permanently'}</Button>
            </>
          )}
        >
          <div className="space-y-4">
            <p className="text-sm text-[#4F5260]">Deleting <strong>{fullName}</strong> will remove the account and related data handled by the existing delete flow.</p>
            <div className="rounded-xl border border-[#E7E8EE] text-sm">
              <InfoRow label="Bookings" value={String(bookings.length)} />
              <InfoRow label="Revenue collected" value={formatCurrency(metrics.paid)} />
              <InfoRow label="Pending dues" value={formatCurrency(metrics.pendingDue)} />
              <InfoRow label="Wallet balance" value={formatCurrency(user.wallet_balance)} />
            </div>
            <Field label="Type DELETE to confirm"><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className={inputCls} /></Field>
          </div>
        </ModalShell>
      )}

      {actionMessage && (
        <div className={`fixed bottom-5 right-5 z-[70] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${actionMessage.type === 'success' ? 'border-green-200 bg-white text-green-700' : 'border-red-200 bg-white text-red-700'}`}>
          {actionMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {actionMessage.text}
        </div>
      )}
    </div>
  );
}

function MetricBlock({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="min-h-[92px] border-b border-r border-[#E7E8EE] p-4 last:border-r-0 sm:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666873]">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-[#17171C]">{value}</p>
      <p className="mt-1 text-xs text-[#8A8D99]">{sub}</p>
    </div>
  );
}

function TabButton({ active, icon, children, onClick }: { active: boolean; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-10 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-[#8758F6]/15 ${active ? 'bg-[#F1EBFF] text-[#8758F6]' : 'text-[#4F5260] hover:bg-[#FAFAFD] hover:text-[#17171C]'}`}>
      {icon}
      {children}
    </button>
  );
}

function TimelineItem({ title, date, icon }: { title: string; date: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EBFF] text-[#8758F6]">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-[#17171C]">{title}</p>
        <p className="mt-0.5 text-sm text-[#666873]">{date}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E7E8EE] px-0 py-2.5 last:border-0">
      <span className="text-[#666873]">{label}</span>
      <span className="truncate text-right font-semibold text-[#17171C]">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#666873]">{label}</p>
      <p className="mt-1 font-semibold text-[#17171C]">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DADCE5] bg-[#FAFAFD] px-4 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#8A8D99]">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-[#17171C]">{title}</p>
      <p className="mt-1 text-sm text-[#666873]">{description}</p>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[#17171C]">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
