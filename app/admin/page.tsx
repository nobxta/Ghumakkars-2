'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, MapPin, Calendar, Users, IndianRupee, TrendingUp, Clock, Package, ArrowRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DAY_NAMES } from '@/lib/recurrence';

// ── discount-aware money (same rules as every other screen) ──
function paidOf(b: any): number {
  if (b.is_offline_booking || !b.user_id) return parseFloat(String(b.amount_paid || 0));
  return (b.payment_transactions || [])
    .filter((t: any) => t.payment_status === 'verified')
    .reduce((s: number, t: any) => s + parseFloat(String(t.amount || 0)), 0);
}
function fullOf(b: any): number {
  const pax = Number(b.number_of_participants) || 1;
  const coupon = parseFloat(String(b.coupon_discount || 0)) || 0;
  const wallet = parseFloat(String(b.wallet_amount_used || 0)) || 0;
  const disc = Number(b.trips?.discounted_price) || 0;
  if (b.payment_method === 'seat_lock' || b.booking_status === 'seat_locked' || b.booking_status === 'remaining_submitted') {
    return Math.max(0, disc * pax - coupon - wallet);
  }
  const fa = parseFloat(String(b.final_amount || 0));
  if (fa > 0) return fa;
  return Math.max(0, (parseFloat(String(b.total_price || 0)) || disc * pax) - coupon - wallet);
}
const isActiveBooking = (b: any) => !['cancelled', 'rejected'].includes(b.booking_status);
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0, verifiedUsers: 0,
    activeBookings: 0, confirmed: 0, seatLocked: 0, pending: 0,
    travellers: 0, collected: 0, outstanding: 0,
    activeTrips: 0,
  });
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const [usersCountRes, verifiedCountRes, tripsRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('email_verified', true),
        supabase.from('trips')
          .select('id, title, destination, discounted_price, max_participants, start_date, end_date, is_recurring, recurrence_day, duration_days, is_active, status, cover_image_url, image_url')
          .order('start_date', { ascending: true }),
        supabase.from('bookings')
          .select('id, trip_id, booking_status, number_of_participants, departure_date, payment_method, total_price, final_amount, coupon_discount, wallet_amount_used, amount_paid, is_offline_booking, user_id, trips(discounted_price), payment_transactions(amount, payment_status)')
          .limit(5000),
      ]);

      const tripsData = tripsRes.data || [];
      const bookings = bookingsRes.data || [];
      const active = bookings.filter(isActiveBooking);

      // Money — collected vs still-to-collect, discount-aware.
      const collected = active.reduce((s, b) => s + paidOf(b), 0);
      const outstanding = active.reduce((s, b) => s + Math.max(0, fullOf(b) - paidOf(b)), 0);

      const confirmed = bookings.filter((b: any) => b.booking_status === 'confirmed').length;
      const seatLocked = bookings.filter((b: any) => b.booking_status === 'seat_locked').length;
      const pending = bookings.filter((b: any) => b.booking_status === 'pending').length;
      const travellers = active
        .filter((b: any) => ['confirmed', 'seat_locked'].includes(b.booking_status))
        .reduce((s: number, b: any) => s + (Number(b.number_of_participants) || 1), 0);

      // Per-trip booked pax + collected (active bookings only).
      const perTrip = new Map<string, { pax: number; collected: number }>();
      active.forEach((b: any) => {
        if (!b.trip_id) return;
        const g = perTrip.get(b.trip_id) || { pax: 0, collected: 0 };
        if (['confirmed', 'seat_locked'].includes(b.booking_status)) g.pax += Number(b.number_of_participants) || 1;
        g.collected += paidOf(b);
        perTrip.set(b.trip_id, g);
      });

      // Upcoming = active, non-cancelled trips that haven't ended (recurring always count).
      const upcomingTrips = tripsData
        .filter((t: any) => t.is_active !== false && t.status !== 'cancelled' && t.status !== 'completed')
        .filter((t: any) => t.is_recurring || !t.end_date || new Date(t.end_date) >= today)
        .map((t: any) => ({ ...t, booked: perTrip.get(t.id) || { pax: 0, collected: 0 } }))
        .sort((a: any, b: any) => {
          if (a.is_recurring && !b.is_recurring) return 1;
          if (!a.is_recurring && b.is_recurring) return -1;
          return new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
        })
        .slice(0, 8);

      setStats({
        totalUsers: usersCountRes.count || 0,
        verifiedUsers: verifiedCountRes.count || 0,
        activeBookings: active.length,
        confirmed, seatLocked, pending,
        travellers, collected, outstanding,
        activeTrips: tripsData.filter((t: any) => t.is_active !== false && t.status !== 'cancelled').length,
      });
      setUpcoming(upcomingTrips);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div className="space-y-5 tabular-nums">
      {/* Header */}
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500">Live overview of bookings, money and trips</p>
        </div>
        <Link href="/admin/trips/create" className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm whitespace-nowrap">
          <Plus className="h-4 w-4" /> New Trip
        </Link>
      </div>

      {/* Revenue hero */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-green-600" />Collected</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{inr(stats.collected)}</p>
          <p className="text-xs text-gray-400 mt-0.5">verified payments</p>
        </div>
        <div className="sm:border-l sm:border-gray-100 sm:pl-6">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-orange-500" />To collect</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{inr(stats.outstanding)}</p>
          <p className="text-xs text-gray-400 mt-0.5">balance on seat-locks &amp; partials</p>
        </div>
        <div className="sm:border-l sm:border-gray-100 sm:pl-6">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-purple-600" />Expected total</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{inr(stats.collected + stats.outstanding)}</p>
          <p className="text-xs text-gray-400 mt-0.5">collected + outstanding</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl divide-x divide-y lg:divide-y-0 divide-gray-100">
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-gray-500"><Package className="h-3.5 w-3.5 text-purple-600" /><span className="text-[11px] font-semibold uppercase tracking-wide">Bookings</span></div>
          <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{stats.activeBookings}</p>
          <p className="text-[11px] text-gray-400">{stats.confirmed} confirmed · {stats.seatLocked} seat-lock · {stats.pending} pending</p>
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-gray-500"><Users className="h-3.5 w-3.5 text-blue-600" /><span className="text-[11px] font-semibold uppercase tracking-wide">Travellers</span></div>
          <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{stats.travellers}</p>
          <p className="text-[11px] text-gray-400">confirmed + seat-locked</p>
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-gray-500"><Users className="h-3.5 w-3.5 text-green-600" /><span className="text-[11px] font-semibold uppercase tracking-wide">Users</span></div>
          <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{stats.totalUsers.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-gray-400">{stats.verifiedUsers} verified</p>
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-gray-500"><MapPin className="h-3.5 w-3.5 text-orange-600" /><span className="text-[11px] font-semibold uppercase tracking-wide">Active trips</span></div>
          <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{stats.activeTrips}</p>
          <p className="text-[11px] text-gray-400">{upcoming.length} upcoming</p>
        </div>
      </div>

      {/* Upcoming trips */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-600" />Upcoming trips</h2>
          <Link href="/admin/trips" className="text-xs font-semibold text-purple-600 hover:text-purple-700 inline-flex items-center gap-1">All trips <ArrowRight className="h-3 w-3" /></Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No upcoming trips. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcoming.map((t: any) => {
              const cap = Number(t.max_participants) || 0;
              const pct = cap > 0 ? Math.min(100, Math.round((t.booked.pax / cap) * 100)) : 0;
              const cover = t.cover_image_url || t.image_url;
              return (
                <Link key={t.id} href={`/admin/trips/${t.id}`} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-gray-50/70 transition-colors">
                  {cover
                    ? <img src={cover} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                    : <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0"><MapPin className="h-5 w-5 text-purple-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate text-sm">{t.title}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />{t.destination}
                      <span className="text-gray-300">·</span>
                      {t.is_recurring ? `Every ${DAY_NAMES[t.recurrence_day] || ''}` : fmtDate(t.start_date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-gray-400">Collected</p>
                    <p className="text-sm font-semibold text-gray-900">{inr(t.booked.collected)}</p>
                  </div>
                  <div className="w-24 sm:w-32 flex-shrink-0">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-gray-700">{t.booked.pax}{cap > 0 ? `/${cap}` : ''} pax</span>
                      {cap > 0 && <span className="text-gray-400">{pct}%</span>}
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-purple-500' : 'bg-amber-400'}`} style={{ width: `${cap > 0 ? pct : (t.booked.pax > 0 ? 100 : 0)}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
