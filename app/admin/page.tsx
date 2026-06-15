'use client';

import { useState, useEffect } from 'react';
import { Plus, MapPin, Calendar, Users, IndianRupee, TrendingUp, Clock, Package, ArrowRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DAY_NAMES } from '@/lib/recurrence';

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

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Aggregates run server-side (service role) so RLS doesn't limit them to
      // the admin's own rows.
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      const d = await res.json();
      setStats({
        totalUsers: d.totalUsers || 0,
        verifiedUsers: d.verifiedUsers || 0,
        activeBookings: d.activeBookings || 0,
        confirmed: d.confirmed || 0,
        seatLocked: d.seatLocked || 0,
        pending: d.pending || 0,
        travellers: d.travellers || 0,
        collected: d.collected || 0,
        outstanding: d.outstanding || 0,
        activeTrips: d.activeTrips || 0,
      });
      setUpcoming(d.upcoming || []);
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
