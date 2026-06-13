'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowLeft, MapPin, Calendar, Users, IndianRupee, Edit, 
  CheckCircle, XCircle, Clock, Package, CreditCard, TrendingUp,
  DollarSign, User, Mail, Phone, Eye, AlertCircle, Download, Printer, FileText, Plus, UserPlus, ChevronDown, X, Users as UsersIcon, IndianRupee as IndianRupeeIcon, Clock as ClockIcon, Lock as LockIcon
} from 'lucide-react';
import { nextOccurrences, formatDeparture, toDateString } from '@/lib/recurrence';

export default function AdminTripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, boolean>>({
    name: true, phone: true, email: false, age: false, gender: true,
    passengers: true, pax: true, status: true, total: false, paid: true, bookedOn: false, pickup: false,
  });
  const [customStatus, setCustomStatus] = useState<'all' | 'confirmed' | 'seat_locked' | 'pending'>('all');
  const [trip, setTrip] = useState<any>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const batchDefaulted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineForm, setOfflineForm] = useState({
    name: '',
    mobile: '',
    participants: 1,
    amount_paid: '',
    departure_date: '',
    passengers: [{ name: '', age: '' }] as { name: string; age: string }[],
  });
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'confirmed' | 'seat_locked' | 'pending' | 'cancelled'>('all');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
    fetchTripDetails();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push('/auth/signin?redirect=/admin/trips');
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

  const fetchTripDetails = async () => {
    try {
      const response = await fetch(`/api/admin/trips/${params.id}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch trip details (${response.status})`;
        
        // Try to parse error message from JSON, but handle non-JSON responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status-based message
            if (response.status === 405) {
              errorMessage = 'Method not allowed. The API endpoint may not support this request.';
            } else if (response.status === 404) {
              errorMessage = 'Trip not found.';
            } else if (response.status === 403) {
              errorMessage = 'Access forbidden. Admin privileges required.';
            } else if (response.status === 401) {
              errorMessage = 'Unauthorized. Please sign in.';
            }
          }
        }
        
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
      }

      const data = await response.json();
      
      setTrip(data.trip);
      setAllBookings(data.bookings || []);
      setMetrics(data.metrics);

      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching trip details:', error);
      setError(error.message || 'Failed to load trip details');
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
      case 'rejected':
      case 'cancelled':
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
      case 'rejected':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPaymentModeLabel = (mode: string) => {
    if (!mode) return '—';
    const m = String(mode).toLowerCase();
    if (m === 'cash') return 'Cash';
    if (m === 'razorpay') return 'Razorpay';
    if (m === 'manual') return 'Manual/UPI';
    return mode;
  };

  const getPaymentMethodLabel = (method: string) => {
    if (!method) return '—';
    const m = String(method).toLowerCase();
    if (m === 'seat_lock') return 'Seat lock';
    return 'Full';
  };

  // Build the list of batches (distinct departure dates) for recurring trips.
  // Build batches: scheduled upcoming departures (from recurrence) merged with
  // every departure that actually has bookings (past or future).
  const todayStr = toDateString(new Date());
  const batchList: { date: string; count: number; past: boolean }[] = (() => {
    if (!trip?.is_recurring) return [];
    const map: Record<string, number> = {};
    // pax already booked per departure
    allBookings.forEach((b: any) => {
      if (!b.departure_date) return;
      if (['cancelled', 'rejected'].includes(b.booking_status)) return;
      map[b.departure_date] = (map[b.departure_date] || 0) + (Number(b.number_of_participants) || 1);
    });
    // scheduled upcoming departures (even with 0 bookings) so admins can see "next batch"
    if (typeof trip.recurrence_day === 'number') {
      nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4).forEach((d) => {
        if (!(d in map)) map[d] = 0;
      });
    }
    return Object.entries(map)
      .map(([date, count]) => ({ date, count, past: date < todayStr }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();

  const upcomingBatches = batchList.filter((b) => !b.past);
  const pastBatches = batchList.filter((b) => b.past).sort((a, b) => b.date.localeCompare(a.date));
  const nextBatchDate = upcomingBatches[0]?.date || '';

  // Per-booking money: what they paid, the full trip cost (after discount), and remaining.
  const bookingPaid = (b: any): number => {
    if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
    return (b.payment_transactions || [])
      .filter((pt: any) => pt.payment_status === 'verified')
      .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0);
  };
  const bookingFull = (b: any): number => {
    const pax = Number(b.number_of_participants) || 1;
    const coupon = parseFloat(String(b.coupon_discount || 0)) || 0;
    const wallet = parseFloat(String(b.wallet_amount_used || 0)) || 0;
    // Seat-lock: total_price / final_amount only hold the DEPOSIT, so the real
    // full trip cost must come from list price × participants.
    if (b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked') {
      const gross = (Number(trip?.discounted_price) || 0) * pax;
      return Math.max(0, gross - coupon - wallet);
    }
    // Full-payment: final_amount already equals gross − coupon − wallet.
    const fa = parseFloat(String(b.final_amount || 0));
    if (fa > 0) return fa;
    const gross = parseFloat(String(b.total_price || 0)) || (Number(trip?.discounted_price) || 0) * pax;
    return Math.max(0, gross - coupon - wallet);
  };
  const bookingRemaining = (b: any): number => {
    if (['cancelled', 'rejected'].includes(b.booking_status)) return 0;
    return Math.max(0, bookingFull(b) - bookingPaid(b));
  };

  // Bookings made before the trip became recurring have no departure_date.
  // Surface them under an "Unscheduled" group so they don't disappear.
  const unscheduledCount = trip?.is_recurring
    ? allBookings.filter((b: any) => !b.departure_date && !['cancelled', 'rejected'].includes(b.booking_status))
        .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0)
    : 0;

  // Default to the next upcoming departure when the page first loads a recurring trip.
  useEffect(() => {
    if (trip?.is_recurring && selectedBatch === 'all' && nextBatchDate && !batchDefaulted.current) {
      batchDefaulted.current = true;
      setSelectedBatch(nextBatchDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.is_recurring, nextBatchDate]);

  // Everything below reads from the batch-filtered view.
  const bookings = (() => {
    if (!trip?.is_recurring || selectedBatch === 'all') return allBookings;
    if (selectedBatch === 'unscheduled') return allBookings.filter((b: any) => !b.departure_date);
    return allBookings.filter((b: any) => b.departure_date === selectedBatch);
  })();

  // Search + status filter applied to the (batch-filtered) bookings for the table.
  const visibleBookings = bookings.filter((b: any) => {
    if (bookingFilter === 'all') {
      // Active view hides cancelled / rejected — they live under the Cancelled tab.
      if (['cancelled', 'rejected'].includes(b.booking_status)) return false;
    } else if (bookingFilter === 'cancelled') {
      if (!['cancelled', 'rejected'].includes(b.booking_status)) return false;
    } else if (b.booking_status !== bookingFilter) {
      return false;
    }
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (b.primary_passenger_name || `${b.profiles?.first_name || ''} ${b.profiles?.last_name || ''}` || b.profiles?.email || '').toLowerCase();
    const phone = (b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '').toLowerCase();
    const id = String(b.id || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || id.includes(q);
  });

  const confirmedBookings = bookings.filter((b: any) => b.booking_status === 'confirmed');
  const seatLockedBookings = bookings.filter((b: any) => b.booking_status === 'seat_locked');
  const pendingBookings = bookings.filter((b: any) => b.booking_status === 'pending');
  const cancelledRejectedBookings = bookings.filter((b: any) => ['rejected', 'cancelled'].includes(b.booking_status || ''));

  // Recompute headline metrics from the filtered view so the stat cards
  // and revenue reflect the selected batch.
  const batchMetrics = {
    totalBookings: bookings.filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status)).length,
    confirmedBookings: confirmedBookings.length,
    seatLockedBookings: seatLockedBookings.length,
    pendingBookings: pendingBookings.length,
    totalParticipants: bookings
      .filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status))
      .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0),
    // Revenue counts only money we are actually keeping: cancelled/rejected
    // bookings are treated as refunded and drop out of earnings.
    revenue: bookings.reduce((s: number, b: any) => {
      if (['cancelled', 'rejected'].includes(b.booking_status)) return s;
      return s + bookingPaid(b);
    }, 0),
    // Balance still to collect across active bookings (e.g. seat-lock balance).
    outstanding: bookings.reduce((s: number, b: any) => s + bookingRemaining(b), 0),
  };

  // ─────────────────────────── Operational exports ───────────────────────────
  const genericCSV = (rows: any[][], headers: string[], filename: string) => {
    if (rows.length === 0) { alert('No data to export.'); return; }
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const _displayName = (b: any) => {
    if (b.is_offline_booking || !b.user_id) return b.primary_passenger_name || '—';
    const u = b.profiles;
    return u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '—';
  };
  const _displayPhone = (b: any) => b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—';
  const _paid = (b: any) => (b.payment_transactions || []).filter((pt: any) => pt.payment_status === 'verified').reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0);

  /** Operational export: Passenger Manifest — what trip captains need on board */
  const exportPassengerManifest = () => {
    const headers = ['#', 'Name', 'Age', 'Gender', 'Phone', 'Emergency Name', 'Emergency Phone', 'Booking ID', 'Pickup'];
    const list = confirmedBookings.concat(bookings.filter((b: any) => b.booking_status === 'seat_locked'));
    const rows: any[][] = [];
    let i = 1;
    list.forEach((b: any) => {
      const primaryDigits = String(b.primary_passenger_phone || '').replace(/\D/g, '');
      const primaryName = String(b.primary_passenger_name || '').trim().toLowerCase();
      rows.push([i++, _displayName(b), b.primary_passenger_age || '', b.primary_passenger_gender || '', _displayPhone(b), b.emergency_contact_name || '', b.emergency_contact_phone || '', b.id.slice(0, 8).toUpperCase(), b.pickup_point || trip?.pickup_location || '']);
      const subs = Array.isArray(b.passengers) ? b.passengers : [];
      subs.forEach((p: any) => {
        if (!p?.name) return;
        if (p.is_primary === true) return;
        const pName = String(p.name || '').trim().toLowerCase();
        // Dedup by NAME only — families share phone numbers
        if (pName && primaryName && pName === primaryName) return;
        rows.push([i++, p.name, p.age || '', p.gender || '', p.phone || '', '', '', b.id.slice(0, 8).toUpperCase(), b.pickup_point || trip?.pickup_location || '']);
      });
    });
    genericCSV(rows, headers, 'Passenger-Manifest');
  };

  /** Operational export: Paid Customers — for finance */
  const exportPaidCustomers = () => {
    const headers = ['Name', 'Phone', 'Email', 'Paid (₹)', 'Full cost (₹)', 'Payment Method', 'Payment Date', 'Booking ID'];
    const rows = confirmedBookings.map((b: any) => [
      _displayName(b), _displayPhone(b), b.profiles?.email || '',
      bookingPaid(b).toFixed(0), bookingFull(b).toFixed(0),
      getPaymentMethodLabel(b.payment_method),
      new Date(b.created_at).toLocaleString('en-IN'),
      b.id.slice(0, 8).toUpperCase(),
    ]);
    genericCSV(rows, headers, 'Paid-Customers');
  };

  /** Operational export: Seat-Locked Customers — for follow-up */
  const exportSeatLocked = () => {
    const headers = ['Name', 'Phone', 'Email', 'Full cost (₹)', 'Paid (₹)', 'Remaining (₹)', 'Booked At', 'Booking ID'];
    const list = bookings.filter((b: any) => b.booking_status === 'seat_locked');
    const rows = list.map((b: any) => {
      return [_displayName(b), _displayPhone(b), b.profiles?.email || '', bookingFull(b).toFixed(0), bookingPaid(b).toFixed(0), bookingRemaining(b).toFixed(0), new Date(b.created_at).toLocaleString('en-IN'), b.id.slice(0, 8).toUpperCase()];
    });
    genericCSV(rows, headers, 'Seat-Locked');
  };

  /** Operational export: Pending Payments — for sales follow-up */
  const exportPendingPayments = () => {
    const headers = ['Name', 'Phone', 'Email', 'Outstanding (₹)', 'Days Since Booking', 'Booking ID'];
    const list = bookings.filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status));
    const rows = list.map((b: any) => {
      const due = bookingRemaining(b);
      const days = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return [_displayName(b), _displayPhone(b), b.profiles?.email || '', due.toFixed(0), days, b.id.slice(0, 8).toUpperCase()];
    }).filter((r) => Number(r[3]) > 0);
    genericCSV(rows, headers, 'Pending-Payments');
  };

  /** Operational export: Revenue Report */
  const exportRevenueReport = () => {
    const headers = ['Metric', 'Amount (₹)'];
    const collected = confirmedBookings.reduce((s: number, b: any) => s + _paid(b), 0);
    const expected = bookings.filter((b: any) => b.booking_status !== 'cancelled' && b.booking_status !== 'rejected').reduce((s: number, b: any) => s + parseFloat(String(b.final_amount || 0)), 0);
    const seatLockCollected = bookings.filter((b: any) => b.booking_status === 'seat_locked').reduce((s: number, b: any) => s + _paid(b), 0);
    const pending = Math.max(0, expected - collected - seatLockCollected);
    const rows = [
      ['Total expected revenue', expected.toFixed(0)],
      ['Collected (confirmed)', collected.toFixed(0)],
      ['Collected (seat lock)', seatLockCollected.toFixed(0)],
      ['Pending', pending.toFixed(0)],
      ['Total bookings', String(bookings.length)],
      ['Confirmed bookings', String(confirmedBookings.length)],
      ['Seat-locked bookings', String(bookings.filter((b: any) => b.booking_status === 'seat_locked').length)],
      ['Cancelled / rejected', String(cancelledRejectedBookings.length)],
    ];
    genericCSV(rows, headers, 'Revenue-Report');
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Participants', 'Total (₹)', 'Paid (₹)', 'Payment mode', 'Payment type', 'Booked at', 'Coupon'];
    const rows = bookings.map((b: any) => {
      const user = b.profiles;
      const paid = (b.payment_transactions || [])
        .filter((pt: any) => pt.payment_status === 'verified')
        .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0);
      return [
        user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.email || '—',
        user?.email || '—',
        user?.phone || '—',
        (b.booking_status || 'pending').replace('_', ' '),
        b.number_of_participants || 1,
        parseFloat(String(b.final_amount || 0)).toFixed(0),
        paid.toFixed(0),
        getPaymentModeLabel(b.payment_mode),
        getPaymentMethodLabel(b.payment_method),
        new Date(b.created_at).toLocaleString('en-IN'),
        b.coupon_code || '—',
      ];
    });
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${trip?.title || 'trip'}-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const displayName = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return b.primary_passenger_name || '—';
      const u = b.profiles;
      return (u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '—');
    };
    const displayPhone = (b: any) => b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—';
    const paymentLabel = (b: any) => b.is_offline_booking ? 'Offline' : getPaymentMethodLabel(b.payment_method);

    const rows = bookings.map((b: any, i: number) => `<tr class="row">
        <td>${i + 1}</td>
        <td>${displayName(b)}</td>
        <td>${displayPhone(b)}</td>
        <td>${(b.booking_status || 'pending').replace('_', ' ')}</td>
        <td>${b.number_of_participants || 1}</td>
        <td>${getPaymentModeLabel(b.payment_mode)} / ${paymentLabel(b)}</td>
        <td>${formatPassengersMultiline(b).join('<br>')}</td>
        <td>${new Date(b.created_at).toLocaleString('en-IN')}</td>
      </tr>`).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>${trip?.title || 'Trip'} — Bookings</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; color: #1a1a1a; background: #fff; font-size: 13px; line-height: 1.4; }
        .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #5e35b1; }
        .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #2d1b4e; }
        .header .meta { color: #555; font-size: 13px; }
        table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #d4d4d8; padding: 10px 12px; text-align: left; }
        th { background: #433866; color: #fff; font-weight: 600; }
        tr.row:nth-child(even) { background: #f8f8fc; }
        tr.row:hover { background: #f0eff8; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e4e4e7; font-size: 11px; color: #71717a; }
        @media print { body { padding: 12px; } .header { break-after: avoid; } table { break-inside: auto; } tr { break-inside: avoid; } }
      </style>
      </head><body>
      <div class="header">
        <h1>${trip?.title || 'Trip'}</h1>
        <p class="meta">${trip?.destination || '—'} &nbsp;•&nbsp; ${trip?.start_date || '—'} to ${trip?.end_date || '—'} &nbsp;|&nbsp; Total bookings: ${bookings.length}</p>
      </div>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Number</th><th>Status</th><th>Pax</th><th>Payment</th><th>Passengers (name, age, M/F)</th><th>Booked at</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Printed on ${new Date().toLocaleString('en-IN')} &nbsp;•&nbsp; Ghumakkars</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  // Format primary + all sub-passengers as "Name (Age) M/F, Name (Age) M/F"
  const formatPassengersLine = (b: any, maxLen = 120) => {
    const g = (v: string) => (v && String(v).toUpperCase().startsWith('F') ? 'F' : (v && String(v).toUpperCase().startsWith('M') ? 'M' : ''));
    const parts: string[] = [];
    const prof = b.profiles;
    const fullName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email : null;
    const pName = b.primary_passenger_name || fullName || '-';
    const pAge = b.primary_passenger_age != null ? String(b.primary_passenger_age) : '';
    const pGender = g(b.primary_passenger_gender || '');
    parts.push(pName + (pAge ? ` (${pAge})` : '') + (pGender ? ` ${pGender}` : ''));
    const arr = Array.isArray(b.passengers) ? b.passengers : [];
    const primaryDigits = String(b.primary_passenger_phone || '').replace(/\D/g, '');
    const primaryLower = String(pName).trim().toLowerCase();
    arr.forEach((p: { name?: string; age?: string; gender?: string; phone?: string; is_primary?: boolean }) => {
      const n = (p?.name || '').trim();
      if (!n) return;
      if (p.is_primary === true) return;
      // Dedup by NAME only — family members often share one phone number,
      // so phone-based dedup wrongly removes kids on the parent's number.
      if (n.toLowerCase() === primaryLower) return;
      const a = p?.age != null ? String(p.age).trim() : '';
      const pg = g(p?.gender || '');
      parts.push(n + (a ? ` (${a})` : '') + (pg ? ` ${pg}` : ''));
    });
    const line = parts.join(', ');
    return line.length > maxLen ? line.substring(0, maxLen - 2) + '…' : line;
  };

  // One passenger per line — full list, no truncation. Primary first, deduped.
  const formatPassengersMultiline = (b: any): string[] => {
    const g = (v: string) => (v && String(v).toUpperCase().startsWith('F') ? 'F' : (v && String(v).toUpperCase().startsWith('M') ? 'M' : ''));
    const lines: string[] = [];
    const prof = b.profiles;
    const fullName = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || prof.email : null;
    const pName = b.primary_passenger_name || fullName || '-';
    const pAge = b.primary_passenger_age != null ? String(b.primary_passenger_age) : '';
    const pGender = g(b.primary_passenger_gender || '');
    lines.push(pName + (pAge ? ` (${pAge})` : '') + (pGender ? ` ${pGender}` : ''));
    const primaryDigits = String(b.primary_passenger_phone || '').replace(/\D/g, '');
    const primaryLower = String(pName).trim().toLowerCase();
    const arr = Array.isArray(b.passengers) ? b.passengers : [];
    arr.forEach((p: any) => {
      const n = (p?.name || '').trim();
      if (!n) return;
      if (p.is_primary === true) return;
      const pDigits = String(p.phone || '').replace(/\D/g, '');
      // Dedup: only skip when BOTH name and phone match the primary (siblings often share a parent's phone)
      if (n.toLowerCase() === primaryLower && (!pDigits || !primaryDigits || pDigits === primaryDigits)) return;
      const a = p?.age != null ? String(p.age).trim() : '';
      const pg = g(p?.gender || '');
      lines.push(n + (a ? ` (${a})` : '') + (pg ? ` ${pg}` : ''));
    });
    return lines;
  };

  /** Custom export — admin picks columns + status filter, output as CSV or printable page. */
  const runCustomExport = (format: 'csv' | 'print') => {
    const list = bookings.filter((b: any) => {
      if (customStatus === 'all') return !['cancelled', 'rejected'].includes(b.booking_status);
      return b.booking_status === customStatus;
    });
    if (list.length === 0) { alert('No bookings match the selected status.'); return; }

    const _name = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return b.primary_passenger_name || '—';
      const u = b.profiles;
      return u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '—';
    };
    const _phone = (b: any) => b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—';
    const _paid = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
      return (b.payment_transactions || [])
        .filter((pt: any) => pt.payment_status === 'verified')
        .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0);
    };

    const cols: { key: string; label: string; get: (b: any) => string }[] = [
      { key: 'name', label: 'Name', get: _name },
      { key: 'phone', label: 'Phone', get: _phone },
      { key: 'email', label: 'Email', get: (b) => b.profiles?.email || b.primary_passenger_email || '—' },
      { key: 'age', label: 'Age', get: (b) => (b.primary_passenger_age != null ? String(b.primary_passenger_age) : '—') },
      { key: 'gender', label: 'Gender', get: (b) => b.primary_passenger_gender || '—' },
      { key: 'passengers', label: 'Passengers', get: (b) => formatPassengersMultiline(b).join(format === 'csv' ? ' | ' : '<br>') },
      { key: 'pax', label: 'Pax', get: (b) => String(b.number_of_participants || 1) },
      { key: 'status', label: 'Status', get: (b) => (b.booking_status || 'pending').replace('_', ' ') },
      { key: 'total', label: 'Total (₹)', get: (b) => parseFloat(String(b.final_amount || 0)).toFixed(0) },
      { key: 'paid', label: 'Paid (₹)', get: (b) => _paid(b).toFixed(0) },
      { key: 'bookedOn', label: 'Booked on', get: (b) => new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
      { key: 'pickup', label: 'Pickup point', get: (b) => b.pickup_point || '—' },
    ];
    const active = cols.filter((c) => customFields[c.key]);
    if (active.length === 0) { alert('Select at least one column.'); return; }

    if (format === 'csv') {
      const rows = list.map((b: any, i: number) => [String(i + 1), ...active.map((c) => c.get(b).replace(/<br>/g, ' | '))]);
      genericCSV(rows, ['#', ...active.map((c) => c.label)], `Custom-${customStatus}`);
      return;
    }

    // Print version — one passenger per line via <br>
    const w = window.open('', '_blank');
    if (!w) return;
    const head = ['#', ...active.map((c) => c.label)].map((h) => `<th>${h}</th>`).join('');
    const body = list.map((b: any, i: number) =>
      `<tr><td>${i + 1}</td>${active.map((c) => `<td>${c.get(b)}</td>`).join('')}</tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${trip?.title || 'Trip'} — Custom export</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
  .header { margin-bottom: 18px; padding: 16px 20px; background: #5e35b1; color: #fff; border-radius: 8px; }
  .header h1 { margin: 0 0 4px 0; font-size: 20px; }
  .header p { margin: 0; font-size: 12px; opacity: .9; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #d4d4d8; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #433866; color: #fff; font-weight: 600; }
  tr:nth-child(even) { background: #f8f8fc; }
  @page { margin: 12mm; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>${trip?.title || 'Trip'} — ${customStatus === 'all' ? 'All bookings' : customStatus.replace('_', ' ')}</h1>
  <p>${trip?.destination || ''} • ${list.length} booking(s) • Generated ${new Date().toLocaleString('en-IN')}</p>
</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>setTimeout(() => window.print(), 300);</script>
</body></html>`);
    w.document.close();
  };

  // Shared PDF helpers (discount-aware money + display).
  const _pdfName = (b: any, n = 24) => {
    if (b.is_offline_booking || !b.user_id) return (b.primary_passenger_name || '—').substring(0, n);
    const u = b.profiles;
    return (u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : (b.primary_passenger_name || u?.email || '—')).substring(0, n);
  };
  const _pdfPhone = (b: any) => (b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—').substring(0, 14);
  const _pdfGender = (b: any) => {
    const g = b.primary_passenger_gender || '';
    return g && String(g).toUpperCase().startsWith('F') ? 'F' : (g && String(g).toUpperCase().startsWith('M') ? 'M' : '—');
  };
  const _pdfStatus = (b: any) => b.booking_status === 'seat_locked' ? 'Seat lock' : (b.booking_status || 'pending').charAt(0).toUpperCase() + (b.booking_status || 'pending').slice(1);
  const _pdfDeparture = () => {
    if (!trip?.is_recurring) return `${trip?.start_date || '—'} to ${trip?.end_date || '—'}`;
    if (selectedBatch !== 'all' && selectedBatch !== 'unscheduled') return formatDeparture(selectedBatch, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `Every ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][trip.recurrence_day]} (all departures)`;
  };
  const _pdfHeader = (doc: any, pageW: number, margin: number, title: string, subtitle: string) => {
    doc.setFillColor(94, 53, 177);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text(`${trip?.title || 'Trip'} — ${title}`, margin, 11);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${trip?.destination || '—'}  •  ${_pdfDeparture()}`, margin, 18);
    doc.text(subtitle, margin, 24);
    doc.setTextColor(0, 0, 0);
  };
  const _pdfFooter = (doc: any, pageW: number, pageH: number, margin: number, note: string) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(note, margin, pageH - 6);
    doc.text(`Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageW - margin - 70, pageH - 6);
    doc.setTextColor(0, 0, 0);
  };

  // FULL booking report — every active booking with the real money (full cost
  // after discount, paid, and balance still due) plus status and passengers.
  const downloadFullPDF = () => {
    const list = bookings.filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status));
    if (list.length === 0) { alert('No active bookings to export.'); return; }
    const pageW = 297, pageH = 210, margin = 14;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const totFull = list.reduce((s: number, b: any) => s + bookingFull(b), 0);
    const totPaid = list.reduce((s: number, b: any) => s + bookingPaid(b), 0);
    const totDue = list.reduce((s: number, b: any) => s + bookingRemaining(b), 0);

    _pdfHeader(doc, pageW, margin, 'Full booking report', `${list.length} bookings  •  Collected ₹${totPaid.toLocaleString('en-IN')}  •  To collect ₹${totDue.toLocaleString('en-IN')}`);

    const headers = [['#', 'Name', 'Phone', 'Pax', 'Passengers (name, age, M/F)', 'Full (₹)', 'Paid (₹)', 'Due (₹)', 'Status', 'Pickup', 'Booked']];
    const rows = list.map((b: any, i: number) => [
      String(i + 1),
      _pdfName(b),
      _pdfPhone(b),
      String(b.number_of_participants || 1),
      formatPassengersMultiline(b).join('\n'),
      bookingFull(b).toFixed(0),
      bookingPaid(b).toFixed(0),
      bookingRemaining(b).toFixed(0),
      _pdfStatus(b),
      (b.pickup_point || '—').substring(0, 16),
      new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    ]);
    rows.push(['', 'TOTAL', '', String(list.reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0)), '', totFull.toFixed(0), totPaid.toFixed(0), totDue.toFixed(0), '', '', '']);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 33,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [67, 56, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 8 }, 1: { cellWidth: 30 }, 2: { cellWidth: 24 }, 3: { cellWidth: 9, halign: 'center' },
        4: { cellWidth: 62 }, 5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' }, 8: { cellWidth: 20 }, 9: { cellWidth: 22 }, 10: { cellWidth: 16 },
      },
      didParseCell: (data: any) => {
        if (data.row.index === rows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [237, 233, 254]; }
      },
    });

    _pdfFooter(doc, pageW, pageH, margin, 'Ghumakkars — Full report. Confidential (contains payment info).');
    doc.save(`${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-Full-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // TRAVEL list — everyone actually going (confirmed + seat-locked). No money
  // at all, so it is safe to print and hand to a trip captain. Names, age,
  // gender, phone, pickup and every co-passenger.
  const downloadCarryPDF = () => {
    const list = bookings.filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status));
    if (list.length === 0) { alert('No travelling guests yet (need confirmed or seat-locked bookings).'); return; }
    const pageW = 297, pageH = 210, margin = 16;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const headPax = list.reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);
    _pdfHeader(doc, pageW, margin, 'Travel list (no payment info)', `${list.length} bookings  •  ${headPax} travellers  •  safe to print`);

    const headers = [['#', 'Lead name', 'Age', 'M/F', 'Phone', 'Pickup', 'All passengers (name, age, M/F)']];
    const rows = list.map((b: any, i: number) => [
      String(i + 1),
      _pdfName(b, 26),
      b.primary_passenger_age || '—',
      _pdfGender(b),
      _pdfPhone(b),
      (b.pickup_point || '—').substring(0, 18),
      formatPassengersMultiline(b).join('\n'),
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 33,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9.5, cellPadding: 3 },
      headStyles: { fillColor: [67, 56, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 10 }, 1: { cellWidth: 40 }, 2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 32 }, 5: { cellWidth: 30 }, 6: { cellWidth: 129 },
      },
    });

    _pdfFooter(doc, pageW, pageH, margin, 'Ghumakkars — Travel list. No payment info, safe to print.');
    doc.save(`${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-Travel-list-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // COLLECTION list — only bookings with money still to collect (seat-locked
  // and any partly-paid). Sorted by largest balance first, for follow-up calls.
  const downloadCollectionPDF = () => {
    const list = bookings
      .filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status) && bookingRemaining(b) > 0)
      .sort((a: any, b: any) => bookingRemaining(b) - bookingRemaining(a));
    if (list.length === 0) { alert('Nothing to collect — every active booking is fully paid.'); return; }
    const pageW = 297, pageH = 210, margin = 16;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const totDue = list.reduce((s: number, b: any) => s + bookingRemaining(b), 0);
    _pdfHeader(doc, pageW, margin, 'Payments to collect', `${list.length} bookings owe money  •  ₹${totDue.toLocaleString('en-IN')} still to collect`);

    const headers = [['#', 'Name', 'Phone', 'Pax', 'Full (₹)', 'Paid (₹)', 'Due (₹)', 'Status', 'Days waiting']];
    const rows = list.map((b: any, i: number) => {
      const days = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return [
        String(i + 1),
        _pdfName(b, 28),
        _pdfPhone(b),
        String(b.number_of_participants || 1),
        bookingFull(b).toFixed(0),
        bookingPaid(b).toFixed(0),
        bookingRemaining(b).toFixed(0),
        _pdfStatus(b),
        String(days),
      ];
    });
    rows.push(['', 'TOTAL', '', '', '', '', totDue.toFixed(0), '', '']);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 33,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9.5, cellPadding: 2.5 },
      headStyles: { fillColor: [67, 56, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 10 }, 1: { cellWidth: 50 }, 2: { cellWidth: 34 }, 3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 26, halign: 'right' }, 6: { cellWidth: 26, halign: 'right' },
        7: { cellWidth: 26 }, 8: { cellWidth: 24, halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === rows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [254, 243, 199]; }
        if (data.section === 'body' && data.column.index === 6 && data.row.index < rows.length - 1) { data.cell.styles.textColor = [194, 65, 12]; data.cell.styles.fontStyle = 'bold'; }
      },
    });

    _pdfFooter(doc, pageW, pageH, margin, 'Ghumakkars — Collection follow-up list. Confidential.');
    doc.save(`${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-Collection-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleAddOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineForm.name.trim() || !offlineForm.mobile.trim()) {
      alert('Name and mobile are required.');
      return;
    }
    const amount = parseFloat(offlineForm.amount_paid) || 0;
    if (amount <= 0) {
      alert('Please enter amount paid.');
      return;
    }
    if (trip?.is_recurring && !offlineForm.departure_date) {
      alert('Please choose a departure date for this booking.');
      return;
    }
    setOfflineSubmitting(true);
    try {
      const res = await fetch(`/api/admin/trips/${params.id}/offline-bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: offlineForm.name.trim(),
          mobile: offlineForm.mobile.trim(),
          participants: Math.max(1, parseInt(String(offlineForm.participants), 10) || 1),
          amount_paid: amount,
          departure_date: trip?.is_recurring ? offlineForm.departure_date : null,
          passengers: offlineForm.passengers
            .filter(p => p.name.trim())
            .map(p => ({ name: p.name.trim(), age: p.age.trim() || undefined })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add offline booking');
      }
      setOfflineForm({ name: '', mobile: '', participants: 1, amount_paid: '', departure_date: '', passengers: [{ name: '', age: '' }] });
      await fetchTripDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to add offline booking');
    } finally {
      setOfflineSubmitting(false);
    }
  };

  const handleSaveOfflineAmount = async (bookingId: string) => {
    const val = parseFloat(editingAmountValue);
    if (Number.isNaN(val) || val < 0) return;
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_paid: val }),
      });
      if (!res.ok) throw new Error('Update failed');
      setEditingAmountId(null);
      setEditingAmountValue('');
      await fetchTripDetails();
    } catch {
      alert('Failed to update amount');
    }
  };

  // Move a booking to a different departure batch (or assign one if unscheduled).
  const handleChangeDeparture = async (bookingId: string, newDate: string) => {
    setSavingDate(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departure_date: newDate || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Update failed');
      }
      setEditingDateId(null);
      await fetchTripDetails();
    } catch (e: any) {
      alert(e.message || 'Failed to change departure date');
    } finally {
      setSavingDate(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen pt-16 pb-20 flex items-center justify-center bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/admin/trips"
            className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Trips</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <div className="min-h-screen pt-16 pb-24 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/admin/trips" 
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to All Trips</span>
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {trip.title}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  trip.status === 'completed' ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : trip.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200'
                    : trip.status === 'postponed' ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : trip.is_active ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : (trip.is_active ? 'Active' : 'Inactive')}
                </span>
              </div>
              <p className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center text-gray-600"><MapPin className="h-4 w-4 mr-1 text-purple-600" />{trip.destination}</span>
                <span className="text-gray-300">•</span>
                <span>{trip.is_recurring ? `Every ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][trip.recurrence_day]}` : `${trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'} – ${trip.end_date ? new Date(trip.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}`}</span>
                <span className="text-gray-300">•</span>
                <span>{trip.duration_text || `${trip.duration_days || 0} days`}</span>
                <span className="text-gray-300">•</span>
                <span className="font-semibold text-purple-700">₹{trip.discounted_price?.toLocaleString() || '0'}</span>
              </p>
              {trip.status === 'postponed' && trip.postponed_to_date && (
                <p className="text-xs text-orange-600 font-medium mt-1">New date: {new Date(trip.postponed_to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              )}
              {trip.status === 'cancelled' && trip.cancellation_reason && (
                <p className="text-xs text-red-600 mt-1">Reason: {trip.cancellation_reason}</p>
              )}
            </div>
            <Link
              href={`/admin/trips/edit/${trip.id}`}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors flex-shrink-0"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Trip</span>
            </Link>
          </div>
        </div>

        {/* Departure selector — recurring trips only */}
        {trip.is_recurring && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <Calendar className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Viewing departure</p>
                {selectedBatch === 'all' ? (
                  <p className="text-base font-bold text-gray-900">Lifetime <span className="text-sm font-medium text-gray-500">· all departures · {batchList.reduce((s, b) => s + b.count, 0)} pax</span></p>
                ) : selectedBatch === 'unscheduled' ? (
                  <p className="text-base font-bold text-amber-700">No date set <span className="text-sm font-medium text-amber-600">· {unscheduledCount} pax with no chosen departure</span></p>
                ) : (
                  <p className="text-base font-bold text-gray-900">
                    {formatDeparture(selectedBatch, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    <span className="text-sm font-medium text-gray-500"> · {batchMetrics.totalParticipants} pax · ₹{batchMetrics.revenue.toLocaleString()}{selectedBatch < todayStr ? ' · past' : ''}</span>
                  </p>
                )}
              </div>
            </div>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-900 outline-none focus:border-purple-400 cursor-pointer w-full sm:w-auto flex-shrink-0"
            >
              <option value="all">Lifetime — all departures ({batchList.reduce((s, b) => s + b.count, 0)} pax)</option>
              {upcomingBatches.length > 0 && (
                <optgroup label="Upcoming">
                  {upcomingBatches.map((b, i) => (
                    <option key={b.date} value={b.date}>
                      {i === 0 ? 'Next · ' : ''}{formatDeparture(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ({b.count} pax)
                    </option>
                  ))}
                </optgroup>
              )}
              {pastBatches.length > 0 && (
                <optgroup label="Past">
                  {pastBatches.map((b) => (
                    <option key={b.date} value={b.date}>
                      {formatDeparture(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ({b.count} pax)
                    </option>
                  ))}
                </optgroup>
              )}
              {unscheduledCount > 0 && (
                <optgroup label="Other">
                  <option value="unscheduled">No date set ({unscheduledCount} pax)</option>
                </optgroup>
              )}
            </select>
          </div>
        )}

        {/* Compact stat strip (batch-aware) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100">
          {(() => {
            // Always compute from the (batch-filtered) booking view so batch and
            // lifetime stay consistent.
            const collected = batchMetrics.revenue;
            const outstanding = batchMetrics.outstanding;
            const bk = batchMetrics.totalBookings;
            const conf = batchMetrics.confirmedBookings;
            const seat = batchMetrics.seatLockedBookings;
            const pend = batchMetrics.pendingBookings;
            const pax = batchMetrics.totalParticipants;
            const maxCap = Number(trip.max_participants) || 0;
            const occPct = maxCap > 0 ? Math.min(100, Math.round((pax / maxCap) * 100)) : 0;
            // Booking-status breakdown, only the non-zero buckets.
            const parts: string[] = [];
            if (conf) parts.push(`${conf} confirmed`);
            if (seat) parts.push(`${seat} seat-locked`);
            if (pend) parts.push(`${pend} pending`);
            const bookingSub = parts.length ? parts.join(' · ') : 'none yet';
            return (
              <>
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500"><span className="text-[10px] font-semibold uppercase tracking-wide">{selectedBatch !== 'all' ? 'Batch revenue' : 'Revenue'}</span></div>
                  <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-green-600" />₹{collected.toLocaleString()}</p>
                  <p className="text-[11px] font-medium">{outstanding > 0 ? <span className="text-orange-600">₹{outstanding.toLocaleString()} to collect</span> : <span className="text-gray-400">fully collected</span>}</p>
                </div>
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500"><span className="text-[10px] font-semibold uppercase tracking-wide">Bookings</span></div>
                  <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-purple-600" />{bk}</p>
                  <p className="text-[11px] text-gray-400">{bookingSub}</p>
                </div>
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500"><span className="text-[10px] font-semibold uppercase tracking-wide">Participants</span></div>
                  <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-600" />{pax}</p>
                  <p className="text-[11px] text-gray-400">travelling this {selectedBatch !== 'all' ? 'departure' : 'trip'}</p>
                </div>
                <div className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-500"><span className="text-[10px] font-semibold uppercase tracking-wide">Occupancy</span></div>
                  {maxCap > 0 ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-orange-600" />{pax} / {maxCap}<span className="text-xs font-semibold text-gray-400">· {occPct}%</span></p>
                      <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${occPct >= 100 ? 'bg-green-500' : occPct >= 60 ? 'bg-purple-500' : 'bg-amber-400'}`} style={{ width: `${occPct}%` }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-orange-600" />Unlimited</p>
                      <p className="text-[11px] text-gray-400">no seat cap</p>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Add offline booking (face-to-face) — collapsible compact bar */}
        <div className={`bg-amber-50/80 border border-amber-200 rounded-xl mb-6 ${offlineOpen ? 'p-3 sm:p-4' : 'px-3 py-2'}`}>
          <button
            type="button"
            onClick={() => setOfflineOpen(o => !o)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-gray-800 flex items-center">
              <UserPlus className="h-4 w-4 text-amber-600 mr-2" />
              Add offline booking
              <span className="hidden sm:inline text-xs font-normal text-gray-500 ml-2">· booked face-to-face</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-amber-700 transition-transform ${offlineOpen ? 'rotate-180' : ''}`} />
          </button>
          {offlineOpen && (
          <>
          <p className="text-xs text-gray-600 mb-4 mt-3">Only name and mobile are required. Everything else is optional.</p>

          {/* Departure batch selector for recurring trips */}
          {trip.is_recurring && typeof trip.recurrence_day === 'number' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Departure date <span className="text-red-500">*</span></label>
              <select
                value={offlineForm.departure_date}
                onChange={e => setOfflineForm(f => ({ ...f, departure_date: e.target.value }))}
                className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
              >
                <option value="">Choose a departure…</option>
                {nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4).map((d) => (
                  <option key={d} value={d}>{formatDeparture(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleAddOffline} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={offlineForm.name}
                  onChange={e => setOfflineForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mobile</label>
                <input
                  type="text"
                  value={offlineForm.mobile}
                  onChange={e => setOfflineForm(f => ({ ...f, mobile: e.target.value }))}
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Passengers</label>
                <input
                  type="number"
                  min={1}
                  value={offlineForm.participants}
                  onChange={e => {
                    const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setOfflineForm(f => ({
                      ...f,
                      participants: n,
                      passengers: Array.from({ length: n }, (_, i) => f.passengers[i] || { name: '', age: '' }),
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount paid (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={offlineForm.amount_paid}
                  onChange={e => setOfflineForm(f => ({ ...f, amount_paid: e.target.value }))}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={offlineSubmitting || !offlineForm.name.trim() || !offlineForm.mobile.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  {offlineSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
            <div className="border-t border-amber-200 pt-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Passenger details (name & age)</label>
              <div className="space-y-2">
                {offlineForm.passengers.map((p, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500 w-20">Passenger {i + 1}</span>
                    <input
                      type="text"
                      value={p.name}
                      onChange={e => setOfflineForm(f => ({
                        ...f,
                        passengers: f.passengers.map((pp, j) => j === i ? { ...pp, name: e.target.value } : pp),
                      }))}
                      placeholder="Name"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-500 w-40"
                    />
                    <input
                      type="text"
                      value={p.age}
                      onChange={e => setOfflineForm(f => ({
                        ...f,
                        passengers: f.passengers.map((pp, j) => j === i ? { ...pp, age: e.target.value } : pp),
                      }))}
                      placeholder="Age"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-500 w-20"
                    />
                  </div>
                ))}
              </div>
            </div>
          </form>
          </>
          )}
        </div>

        {/* Bookings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Package className="h-4 w-4 text-purple-600 mr-2" />
              Bookings <span className="text-gray-400 font-semibold ml-1">({visibleBookings.length})</span>
            </h2>
            {bookings.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <Download className="h-4 w-4 text-gray-500" />
                  Export
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-80 max-h-[80vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-20">
                      <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-50 border-b border-gray-100">PDF — print ready</div>
                      <button onClick={() => { setExportMenuOpen(false); downloadCarryPDF(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <UsersIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Travel list <span className="text-[10px] font-bold uppercase text-green-700 bg-green-100 px-1 py-0.5 rounded ml-1">no money</span></p>
                          <p className="text-[11px] text-gray-500">Who's going: name, age, phone, all passengers. Safe to hand to the trip captain.</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); downloadCollectionPDF(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <ClockIcon className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Payments to collect</p>
                          <p className="text-[11px] text-gray-500">Only seat-locked / part-paid, biggest balance first. For follow-up calls.</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); downloadFullPDF(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <FileText className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Full booking report</p>
                          <p className="text-[11px] text-gray-500">Everyone: full cost, paid, due, status & passengers. Confidential.</p>
                        </div>
                      </button>

                      <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-50 border-y border-gray-100">Spreadsheets (CSV)</div>
                      <button onClick={() => { setExportMenuOpen(false); exportPassengerManifest(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <UsersIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Passenger manifest</p>
                          <p className="text-[11px] text-gray-500">One row per person, with emergency contacts</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); exportSeatLocked(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <LockIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Seat-locked customers</p>
                          <p className="text-[11px] text-gray-500">Full cost, paid &amp; remaining</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); exportPaidCustomers(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <IndianRupeeIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Paid customers</p>
                          <p className="text-[11px] text-gray-500">Confirmed bookings with payment details</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); exportRevenueReport(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <DollarSign className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Revenue report</p>
                          <p className="text-[11px] text-gray-500">Expected · collected · pending summary</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); downloadCSV(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3">
                        <FileText className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Full data (CSV)</p>
                          <p className="text-[11px] text-gray-500">Everything — all columns, all bookings</p>
                        </div>
                      </button>

                      <button onClick={() => { setExportMenuOpen(false); handlePrint(); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3 border-t border-gray-100">
                        <Printer className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Print preview</p>
                          <p className="text-[11px] text-gray-500">Open browser print dialog</p>
                        </div>
                      </button>
                      <button onClick={() => { setExportMenuOpen(false); setCustomExportOpen(true); }} className="w-full px-3 py-2.5 text-left hover:bg-purple-50 flex items-start gap-3 border-t border-gray-100">
                        <Plus className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Custom export…</p>
                          <p className="text-[11px] text-gray-500">Pick exactly which columns to include</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search + status filter (sticky while scrolling) */}
          {bookings.length > 0 && (() => {
            const statusCount = (s: string) => bookings.filter((b: any) =>
              s === 'cancelled'
                ? ['cancelled', 'rejected'].includes(b.booking_status)
                : b.booking_status === s
            ).length;
            const counts: Record<string, number> = {
              all: bookings.filter((b: any) => !['cancelled', 'rejected'].includes(b.booking_status)).length,
              confirmed: statusCount('confirmed'),
              seat_locked: statusCount('seat_locked'),
              pending: statusCount('pending'),
              cancelled: statusCount('cancelled'),
            };
            return (
              <div className="sticky top-16 z-10 flex flex-col sm:flex-row sm:items-center gap-2 mb-3 bg-white/95 backdrop-blur-sm py-2 -mx-4 sm:-mx-5 px-4 sm:px-5 border-b border-gray-100">
                <div className="relative w-full sm:w-72">
                  <input
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search name, phone or ID…"
                    className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none"
                  />
                </div>
                <select
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value as typeof bookingFilter)}
                  className="px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white text-gray-900 outline-none focus:border-purple-400 cursor-pointer w-full sm:w-auto"
                >
                  <option value="all">Active ({counts.all})</option>
                  <option value="confirmed">Confirmed ({counts.confirmed})</option>
                  <option value="seat_locked">Seat locked ({counts.seat_locked})</option>
                  <option value="pending">Pending ({counts.pending})</option>
                  <option value="cancelled">Cancelled / Rejected ({counts.cancelled})</option>
                </select>
              </div>
            );
          })()}

          {/* Desktop table (lg+) */}
          {visibleBookings.length > 0 && (
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-semibold">Customer</th>
                    <th className="py-2 px-3 font-semibold">Phone</th>
                    <th className="py-2 px-3 font-semibold text-center">Pax</th>
                    <th className="py-2 px-3 font-semibold">{trip.is_recurring ? 'Departs' : 'Booked'}</th>
                    <th className="py-2 px-3 font-semibold">Payment</th>
                    <th className="py-2 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                    <th className="py-2 pl-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleBookings.map((booking: any) => {
                    const isOffline = booking.is_offline_booking || !booking.user_id;
                    const user = booking.profiles;
                    const displayName = isOffline
                      ? (booking.primary_passenger_name || 'Offline')
                      : (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || user?.email || 'User');
                    const displayPhone = isOffline ? (booking.primary_passenger_phone || booking.contact_phone || '—') : (user?.phone || '—');
                    return (
                      <Fragment key={booking.id}>
                      <tr className="hover:bg-gray-50/70">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isOffline ? 'bg-amber-500' : 'bg-purple-600'}`}>
                              {(displayName[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                                {displayName}
                                {isOffline && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-amber-100 text-amber-700">Offline</span>}
                                {booking.coupon_code && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-green-100 text-green-700">{booking.coupon_code}</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{displayPhone}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-gray-900">{booking.number_of_participants || 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {trip.is_recurring && typeof trip.recurrence_day === 'number' ? (
                            editingDateId === booking.id ? (
                              <select autoFocus disabled={savingDate} defaultValue={booking.departure_date || ''}
                                onChange={(e) => handleChangeDeparture(booking.id, e.target.value)} onBlur={() => setEditingDateId(null)}
                                className="text-xs px-1.5 py-1 border border-purple-300 rounded bg-white text-gray-900">
                                <option value="">— No date —</option>
                                {(() => { const opts = nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4); if (booking.departure_date && !opts.includes(booking.departure_date)) opts.unshift(booking.departure_date); return opts.map((d) => <option key={d} value={d}>{formatDeparture(d, { weekday: 'short', day: '2-digit', month: 'short' })}</option>); })()}
                              </select>
                            ) : (
                              <button onClick={() => setEditingDateId(booking.id)} className="font-semibold text-gray-900 hover:text-purple-700 hover:underline flex items-center gap-1" title="Change departure">
                                {booking.departure_date ? formatDeparture(booking.departure_date, { weekday: 'short', day: '2-digit', month: 'short' }) : <span className="text-amber-600">Set date</span>}
                                <Edit className="h-3 w-3 text-gray-400" />
                              </button>
                            )
                          ) : (
                            <span className="text-gray-700">{new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">{getPaymentModeLabel(booking.payment_mode)} / {isOffline ? 'Offline' : getPaymentMethodLabel(booking.payment_method)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <p className="font-semibold text-gray-900">₹{bookingPaid(booking).toLocaleString('en-IN')}</p>
                          {bookingRemaining(booking) > 0 && (
                            <p className="text-[11px] text-orange-600 font-medium">₹{bookingRemaining(booking).toLocaleString('en-IN')} due</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusColor(booking.booking_status || 'pending')}`}>
                            {(booking.booking_status || 'pending') === 'seat_locked' ? 'Seat Locked' : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')}
                          </span>
                          {bookingRemaining(booking) > 0 && booking.booking_status === 'confirmed' && (
                            <p className="text-[10px] text-orange-600 font-semibold mt-0.5">balance pending</p>
                          )}
                          {['cancelled', 'rejected'].includes(booking.booking_status) && booking.rejection_reason && (
                            <p className="text-[10px] text-red-600 mt-0.5 max-w-[160px]">Reason: {booking.rejection_reason}</p>
                          )}
                        </td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)}
                              className="p-1.5 rounded hover:bg-purple-50 text-gray-500"
                              title="Show passengers"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedBookingId === booking.id ? 'rotate-180' : ''}`} />
                            </button>
                            {!isOffline && (
                              <Link href={`/admin/users/${user?.id || booking.user_id}`} className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="Customer profile"><User className="h-3.5 w-3.5" /></Link>
                            )}
                            <Link href={`/admin/bookings/${booking.id}`} className="p-1.5 rounded hover:bg-purple-50 text-purple-600" title="Booking details"><Eye className="h-3.5 w-3.5" /></Link>
                          </div>
                        </td>
                      </tr>
                      {expandedBookingId === booking.id && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={8} className="px-3 py-3">
                            <p className="text-[11px] uppercase tracking-wide font-bold text-gray-500 mb-2">Passengers ({booking.number_of_participants || 1})</p>
                            <div className="flex flex-wrap gap-2">
                              {formatPassengersMultiline(booking).map((line: string, i: number) => (
                                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs text-gray-800">
                                  {i === 0 && <span className="text-[9px] font-bold uppercase text-purple-600 mr-1.5">Lead</span>}
                                  {line}
                                </span>
                              ))}
                            </div>
                            {(booking.emergency_contact_name || booking.emergency_contact_phone) && (
                              <p className="text-xs text-gray-500 mt-2">Emergency: <span className="text-gray-800 font-medium">{booking.emergency_contact_name || '—'} · {booking.emergency_contact_phone || '—'}</span></p>
                            )}
                            {booking.pickup_point && (
                              <p className="text-xs text-gray-500 mt-1">Pickup: <span className="text-gray-800 font-medium">{booking.pickup_point}</span></p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards (below lg) */}
          {visibleBookings.length > 0 ? (
            <div className="space-y-3 lg:hidden">
              {visibleBookings.map((booking: any) => {
                const isOffline = booking.is_offline_booking || !booking.user_id;
                const user = booking.profiles;
                const displayName = isOffline
                  ? (booking.primary_passenger_name || 'Offline')
                  : (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || user?.email || 'User');
                const displayPhone = isOffline
                  ? (booking.primary_passenger_phone || booking.contact_phone || '—')
                  : (user?.phone || '—');

                return (
                  <div
                    key={booking.id}
                    className={`border-2 rounded-lg p-3 sm:p-4 hover:shadow-sm transition-all ${isOffline ? 'border-amber-200 bg-amber-50/30' : 'border-purple-100 hover:border-purple-300'}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isOffline ? 'bg-amber-500' : 'bg-gradient-to-br from-purple-500 to-purple-600'}`}>
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                              {displayName}
                            </p>
                            {isOffline && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-amber-300 bg-amber-100 text-amber-800">
                                Offline
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusColor(booking.booking_status || 'pending')}`}>
                              {getStatusIcon(booking.booking_status || 'pending')}
                              <span className="ml-1 hidden sm:inline">
                                {(booking.booking_status || 'pending') === 'seat_locked' ? 'Seat Locked' : (booking.booking_status || 'pending').charAt(0).toUpperCase() + (booking.booking_status || 'pending').slice(1).replace(/_/g, ' ')}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-x-3 text-xs text-gray-600 mb-1">
                            <span className="flex items-center">
                              <Phone className="h-3 w-3 mr-1 text-purple-600" />
                              {displayPhone}
                            </span>
                          </div>
                          {['cancelled', 'rejected'].includes(booking.booking_status) && booking.rejection_reason && (
                            <p className="text-xs text-red-600 mb-1">Reason: {booking.rejection_reason}</p>
                          )}
                          {formatPassengersLine(booking, 200) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              <span className="font-medium text-gray-600">Passengers:</span> {formatPassengersLine(booking, 200)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3 flex-shrink-0">
                        <div className="bg-purple-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Participants</p>
                          <p className="font-semibold text-gray-900 text-sm flex items-center">
                            <Users className="h-3 w-3 mr-1 text-purple-600" />
                            {booking.number_of_participants || 1}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">{trip.is_recurring ? 'Departs' : (booking.departure_date ? 'Departs' : 'Booked')}</p>
                          {trip.is_recurring && typeof trip.recurrence_day === 'number' ? (
                            editingDateId === booking.id ? (
                              <select
                                autoFocus
                                disabled={savingDate}
                                defaultValue={booking.departure_date || ''}
                                onChange={(e) => handleChangeDeparture(booking.id, e.target.value)}
                                onBlur={() => setEditingDateId(null)}
                                className="w-full text-xs px-1.5 py-1 border border-purple-300 rounded bg-white text-gray-900"
                              >
                                <option value="">— No date —</option>
                                {(() => {
                                  const opts = nextOccurrences(trip.recurrence_day, trip.recurrence_weeks_ahead || 4);
                                  // keep the current value selectable even if it's a past date
                                  if (booking.departure_date && !opts.includes(booking.departure_date)) opts.unshift(booking.departure_date);
                                  return opts.map((d) => (
                                    <option key={d} value={d}>{formatDeparture(d, { weekday: 'short', day: '2-digit', month: 'short' })}</option>
                                  ));
                                })()}
                              </select>
                            ) : (
                              <button
                                onClick={() => setEditingDateId(booking.id)}
                                className="font-semibold text-sm text-gray-900 text-left hover:text-purple-700 hover:underline flex items-center gap-1"
                                title="Click to change departure / move to another batch"
                              >
                                {booking.departure_date
                                  ? formatDeparture(booking.departure_date, { weekday: 'short', day: '2-digit', month: 'short' })
                                  : <span className="text-amber-600">Set date</span>}
                                <Edit className="h-3 w-3 text-gray-400" />
                              </button>
                            )
                          ) : (
                            <p className="font-semibold text-gray-900 text-sm">
                              {new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Amount</p>
                          <p className="font-semibold text-gray-900 text-xs">₹{bookingPaid(booking).toLocaleString('en-IN')}</p>
                          {bookingRemaining(booking) > 0 && (
                            <p className="text-[10px] text-orange-600 font-medium">₹{bookingRemaining(booking).toLocaleString('en-IN')} due</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 lg:flex-col lg:items-end lg:gap-1 flex-shrink-0">
                        {!isOffline && (
                          <Link href={`/admin/users/${user?.id || booking.user_id}`} onClick={e => e.stopPropagation()} className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors">
                            <User className="h-3 w-3" />
                            <span className="hidden sm:inline">Profile</span>
                          </Link>
                        )}
                        <Link href={`/admin/bookings/${booking.id}`} className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded hover:bg-purple-50 transition-colors">
                          <Eye className="h-3 w-3" />
                          <span className="hidden sm:inline">Details</span>
                        </Link>
                        {booking.coupon_code && (
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded text-center">{booking.coupon_code}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">{bookingSearch || bookingFilter !== 'all' ? 'No bookings match your search or filter' : 'No bookings yet'}</p>
              {(bookingSearch || bookingFilter !== 'all') && (
                <button onClick={() => { setBookingSearch(''); setBookingFilter('all'); }} className="mt-2 text-sm text-purple-600 font-semibold hover:underline">Clear filters</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Export modal */}
      {customExportOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCustomExportOpen(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900">Custom export</h2>
              <button onClick={() => setCustomExportOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Booking status</p>
                <div className="flex flex-wrap gap-2">
                  {([['all', 'All active'], ['confirmed', 'Confirmed'], ['seat_locked', 'Seat locked'], ['pending', 'Pending']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setCustomStatus(val)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        customStatus === val ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Columns to include</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['age', 'Age'],
                    ['gender', 'Gender'], ['passengers', 'Passengers (one per line)'], ['pax', 'Pax count'],
                    ['status', 'Booking status'], ['total', 'Total price'], ['paid', 'Paid amount'], ['bookedOn', 'Booking date'], ['pickup', 'Pickup point'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!customFields[key]}
                        onChange={(e) => setCustomFields({ ...customFields, [key]: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-gray-800">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-2">
              <button
                onClick={() => { setCustomExportOpen(false); runCustomExport('csv'); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4" /> Download CSV
              </button>
              <button
                onClick={() => { setCustomExportOpen(false); runCustomExport('print'); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

