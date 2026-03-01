'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowLeft, MapPin, Calendar, Users, IndianRupee, Edit, 
  CheckCircle, XCircle, Clock, Package, CreditCard, TrendingUp,
  DollarSign, User, Mail, Phone, Eye, AlertCircle, Download, Printer, FileText, Plus, UserPlus
} from 'lucide-react';

export default function AdminTripDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [trip, setTrip] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineForm, setOfflineForm] = useState({
    name: '',
    mobile: '',
    participants: 1,
    amount_paid: '',
    passengers: [{ name: '', age: '' }] as { name: string; age: string }[],
  });
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

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
      setBookings(data.bookings || []);
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

  const confirmedBookings = bookings.filter((b: any) => b.booking_status === 'confirmed');
  const seatLockedBookings = bookings.filter((b: any) => b.booking_status === 'seat_locked');
  const pendingBookings = bookings.filter((b: any) => b.booking_status === 'pending');
  const cancelledRejectedBookings = bookings.filter((b: any) => ['rejected', 'cancelled'].includes(b.booking_status || ''));

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
        <td>${formatPassengersLine(b, 300)}</td>
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
    arr.forEach((p: { name?: string; age?: string; gender?: string }) => {
      const n = (p?.name || '').trim();
      if (!n) return;
      const a = p?.age != null ? String(p.age).trim() : '';
      const pg = g(p?.gender || '');
      parts.push(n + (a ? ` (${a})` : '') + (pg ? ` ${pg}` : ''));
    });
    const line = parts.join(', ');
    return line.length > maxLen ? line.substring(0, maxLen - 2) + '…' : line;
  };

  const downloadFullPDF = () => {
    const list = confirmedBookings;
    if (list.length === 0) {
      alert('No confirmed users to export.');
      return;
    }
    const pageW = 297;
    const pageH = 210;
    const margin = 16;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const paid = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
      return (b.payment_transactions || [])
        .filter((pt: any) => pt.payment_status === 'verified')
        .reduce((s: number, pt: any) => s + parseFloat(String(pt.amount || 0)), 0);
    };
    const displayName = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return (b.primary_passenger_name || '—').substring(0, 22);
      const u = b.profiles;
      return (u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '—').substring(0, 22);
    };
    const displayEmail = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return '—';
      return (b.profiles?.email || '—').substring(0, 28);
    };
    const displayPhone = (b: any) => (b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—').substring(0, 14);
    const displayGender = (b: any) => {
      const g = b.primary_passenger_gender || '';
      return g && String(g).toUpperCase().startsWith('F') ? 'F' : (g && String(g).toUpperCase().startsWith('M') ? 'M' : '—');
    };

    doc.setFillColor(94, 53, 177);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${trip?.title || 'Trip'} — Full details (A–Z)`, margin, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${trip?.destination || '—'}  •  ${trip?.start_date || '—'} to ${trip?.end_date || '—'}`, margin, 19);
    doc.text(`Total: ${list.length} confirmed  •  Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, 25);
    doc.setTextColor(0, 0, 0);

    const headers = [['#', 'Name', 'Email', 'Number', 'M/F', 'Passengers (name, age, M/F)', 'Pax', 'Total (₹)', 'Paid (₹)', 'Payment', 'Booked on']];
    const rows = list.map((b: any, i: number) => {
      const p = paid(b);
      return [
        String(i + 1),
        displayName(b),
        displayEmail(b),
        displayPhone(b),
        displayGender(b),
        formatPassengersLine(b, 80),
        String(b.number_of_participants || 1),
        parseFloat(String(b.final_amount || 0)).toFixed(0),
        p.toFixed(0),
        `${getPaymentModeLabel(b.payment_mode)} / ${(b.is_offline_booking ? 'Offline' : getPaymentMethodLabel(b.payment_method))}`,
        new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      ];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 34,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [67, 56, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 24 },
        2: { cellWidth: 30 },
        3: { cellWidth: 22 },
        4: { cellWidth: 10 },
        5: { cellWidth: 58 },
        6: { cellWidth: 10 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
        9: { cellWidth: 22 },
        10: { cellWidth: 22 },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    if (finalY && finalY < pageH - 18) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Ghumakkars — Full list. Confidential.`, margin, pageH - 8);
      doc.text(`Page 1`, pageW - margin - 15, pageH - 8);
      doc.setTextColor(0, 0, 0);
    }
    doc.save(`${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-Full-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const downloadCarryPDF = () => {
    const list = confirmedBookings;
    if (list.length === 0) {
      alert('No confirmed users to export.');
      return;
    }
    const pageW = 297;
    const pageH = 210;
    const margin = 16;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const displayName = (b: any) => {
      if (b.is_offline_booking || !b.user_id) return (b.primary_passenger_name || '—').substring(0, 26);
      const u = b.profiles;
      return (u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.email || '—').substring(0, 26);
    };
    const displayPhone = (b: any) => (b.primary_passenger_phone || b.contact_phone || b.profiles?.phone || '—').substring(0, 16);
    const displayGender = (b: any) => {
      const g = b.primary_passenger_gender || '';
      return g && String(g).toUpperCase().startsWith('F') ? 'F' : (g && String(g).toUpperCase().startsWith('M') ? 'M' : '—');
    };

    doc.setFillColor(94, 53, 177);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${trip?.title || 'Trip'} — Carry list (who booked)`, margin, 11);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${trip?.destination || '—'}  •  ${trip?.start_date || '—'} to ${trip?.end_date || '—'}  •  ${list.length} confirmed`, margin, 20);
    doc.setTextColor(0, 0, 0);

    const headers = [['#', 'Name', 'Number', 'M/F', 'Passengers (name, age, M/F)']];
    const rows = list.map((b: any, i: number) => [
      String(i + 1),
      displayName(b),
      displayPhone(b),
      displayGender(b),
      formatPassengersLine(b, 140),
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 32,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [67, 56, 102], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 42 },
        2: { cellWidth: 38 },
        3: { cellWidth: 16 },
        4: { cellWidth: 165 },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY;
    if (finalY && finalY < pageH - 16) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Ghumakkars — Carry list. No payment info.`, margin, pageH - 6);
      doc.setTextColor(0, 0, 0);
    }
    doc.save(`${(trip?.title || 'trip').replace(/[^a-z0-9]/gi, '-')}-Carry-${new Date().toISOString().slice(0, 10)}.pdf`);
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
          passengers: offlineForm.passengers
            .filter(p => p.name.trim())
            .map(p => ({ name: p.name.trim(), age: p.age.trim() || undefined })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add offline booking');
      }
      setOfflineForm({ name: '', mobile: '', participants: 1, amount_paid: '', passengers: [{ name: '', age: '' }] });
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {trip.title}
              </h1>
              <p className="text-sm text-gray-600 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-purple-600" />
                {trip.destination}
              </p>
            </div>
            <Link
              href={`/admin/trips/edit/${trip.id}`}
              className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              <Edit className="h-5 w-5" />
              <span>Edit Trip</span>
            </Link>
          </div>
        </div>

        {/* Revenue & Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Revenue</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600 flex items-center">
              <IndianRupee className="h-6 w-6" />
              {metrics?.totalRevenue?.toLocaleString() || '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">From verified payments</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Bookings</p>
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{metrics?.totalBookings || 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics?.confirmedBookings || 0} confirmed, {metrics?.pendingBookings || 0} pending
            </p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Total Participants</p>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{metrics?.totalParticipants || 0}</p>
            <p className="text-xs text-gray-500 mt-1">
              {trip.current_participants || 0}/{trip.max_participants || 0} capacity
            </p>
          </div>
          <div className="bg-white rounded-xl border-2 border-purple-100 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-600">Avg Booking Value</p>
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600 flex items-center">
              <IndianRupee className="h-6 w-6" />
              {metrics?.averageBookingValue?.toFixed(0) || '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per confirmed booking</p>
          </div>
        </div>

        {/* Trip Information */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 text-purple-600 mr-2" />
            Trip Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Destination</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{trip.destination}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Start Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">End Date</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-purple-600" />
                {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Duration</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">{trip.duration_days || 0} days</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Price</p>
              <p className="font-semibold text-purple-600 text-sm sm:text-base flex items-center">
                <IndianRupee className="h-4 w-4" />
                {trip.discounted_price?.toLocaleString() || '0'}
                {trip.original_price && trip.original_price > trip.discounted_price && (
                  <span className="text-xs text-gray-500 line-through ml-2">
                    ₹{trip.original_price.toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                trip.status === 'completed'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : trip.status === 'cancelled'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : trip.status === 'postponed'
                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                  : trip.is_active
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}>
                {trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : (trip.is_active ? 'Active' : 'Inactive')}
              </span>
              {trip.status === 'completed' && trip.completed_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Completed {new Date(trip.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {trip.status === 'postponed' && trip.postponed_to_date && (
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  New date: {new Date(trip.postponed_to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {trip.status === 'cancelled' && trip.cancellation_reason && (
                <p className="text-xs text-red-600 mt-1">Reason: {trip.cancellation_reason}</p>
              )}
            </div>
          </div>
        </div>

        {/* Add offline booking (face-to-face) */}
        <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <UserPlus className="h-5 w-5 text-amber-600 mr-2" />
            Add offline booking
          </h2>
          <p className="text-sm text-gray-600 mb-4">Add someone who booked face-to-face (no website account). Only name and mobile required.</p>
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
        </div>

        {/* Booking stats summary */}
        {bookings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-700 font-medium">Confirmed</p>
              <p className="text-lg font-bold text-green-800">{confirmedBookings.length}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs text-orange-700 font-medium">Seat locked</p>
              <p className="text-lg font-bold text-orange-800">{seatLockedBookings.length}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700 font-medium">Pending</p>
              <p className="text-lg font-bold text-yellow-800">{pendingBookings.length}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-medium">Cancelled / Rejected</p>
              <p className="text-lg font-bold text-red-800">{cancelledRejectedBookings.length}</p>
            </div>
          </div>
        )}

        {/* Bookings Section */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
              <Package className="h-5 w-5 text-purple-600 mr-2" />
              All Bookings ({bookings.length})
            </h2>
            {bookings.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={downloadFullPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  title="Full list with email, payment, passengers (A–Z)"
                >
                  <FileText className="h-4 w-4" />
                  PDF (Full)
                </button>
                <button
                  onClick={downloadCarryPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  title="Name, number, gender, passengers only — no payment, to carry"
                >
                  <FileText className="h-4 w-4" />
                  PDF (Carry)
                </button>
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Print / PDF
                </button>
              </div>
            )}
          </div>
          {bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map((booking) => {
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
                          <p className="text-xs text-gray-600 mb-0.5">Date</p>
                          <p className="font-semibold text-gray-900 text-sm">
                            {new Date(booking.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-md p-2">
                          <p className="text-xs text-gray-600 mb-0.5">Payment</p>
                          <p className="font-semibold text-gray-900 text-xs">
                            {getPaymentModeLabel(booking.payment_mode)} / {isOffline ? 'Offline' : getPaymentMethodLabel(booking.payment_method)}
                          </p>
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
              <p className="text-gray-600">No bookings found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

