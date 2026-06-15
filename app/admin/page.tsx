'use client';

import { useState, useEffect } from 'react';
import { Plus, MapPin, Calendar, Users, TrendingUp, Clock, Package, ArrowRight, AlertTriangle, Activity } from 'lucide-react';
import Link from 'next/link';
import { DAY_NAMES } from '@/lib/recurrence';

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Aggregates run server-side (service role) so RLS doesn't scope them to
      // the admin's own rows.
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      setD(await res.json());
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  if (loading || !d) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const fmtDate = (x?: string) => x ? new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const upcoming: any[] = d.upcoming || [];
  const pendingActions = (d.pendingApproval || 0) + (d.seatLockWithBalance || 0);

  const attention: { text: string }[] = [];
  if (d.pendingApproval > 0) attention.push({ text: `${d.pendingApproval} payment${d.pendingApproval > 1 ? 's' : ''} waiting for approval` });
  if (d.seatLockWithBalance > 0) attention.push({ text: `${d.seatLockWithBalance} seat-lock${d.seatLockWithBalance > 1 ? 's' : ''} with a balance still due` });
  if (d.nextTripDays != null && d.nextTripDays <= 3) attention.push({ text: `A trip starts in ${d.nextTripDays === 0 ? 'less than a day' : `${d.nextTripDays} day${d.nextTripDays > 1 ? 's' : ''}`}` });

  return (
    <div className="space-y-5 tabular-nums">
      {/* Header — greeting + pending-actions badge */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{greeting}{d.adminName ? `, ${d.adminName}` : ''} 👋</h1>
            {pendingActions > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{pendingActions} pending action{pendingActions > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Here&apos;s what&apos;s happening today.</p>
        </div>
        <Link href="/admin/trips/create" className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow-sm whitespace-nowrap">
          <Plus className="h-4 w-4" /> New Trip
        </Link>
      </div>

      {/* Attention required — only when there's something to do */}
      {attention.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1.5"><AlertTriangle className="h-4 w-4" />Attention required</p>
            <ul className="space-y-0.5">
              {attention.map((a, i) => <li key={i} className="text-sm text-amber-800 flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-500" />{a.text}</li>)}
            </ul>
          </div>
          <Link href="/admin/bookings" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold flex-shrink-0">Review</Link>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* MAIN */}
        <div className="space-y-4 min-w-0">
          {/* Money — Pending Collection emphasised */}
          {(() => {
            const expected = (d.collected || 0) + (d.outstanding || 0);
            const pct = expected > 0 ? Math.round((d.collected / expected) * 100) : 0;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-white/80 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Pending collection</p>
                  <p className="text-3xl sm:text-4xl font-extrabold mt-1.5 leading-none">{inr(d.outstanding)}</p>
                  <p className="text-xs text-white/85 mt-2">{d.pendingApproval > 0 ? `${d.pendingApproval} to approve · ` : ''}balance in seat-locks</p>
                </div>
                <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Collected</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1.5">{inr(d.collected)}</p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />{inr(d.collectedThisWeek)} this week</p>
                </div>
                <div className="rounded-2xl p-5 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Expected total</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1.5">{inr(expected)}</p>
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1"><span>{pct}% collected</span><span>{inr(d.collected)}/{inr(expected)}</span></div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${pct}%` }} /></div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* KPI tiles — gradient chips + a story each */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-sm"><Package className="h-4 w-4 text-white" /></div>
                {d.newBookingsToday > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">+{d.newBookingsToday}</span>}
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2.5 leading-none">{d.activeBookings}</p>
              <p className="text-[11px] text-gray-500 mt-1">Bookings</p>
              {(() => {
                const tot = (d.confirmed || 0) + (d.seatLocked || 0) + (d.pending || 0) || 1;
                return (
                  <div className="mt-2 flex h-1.5 w-full rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-green-500" style={{ width: `${(d.confirmed / tot) * 100}%` }} title={`${d.confirmed} confirmed`} />
                    <div className="bg-amber-400" style={{ width: `${(d.seatLocked / tot) * 100}%` }} title={`${d.seatLocked} seat-lock`} />
                    <div className="bg-gray-300" style={{ width: `${(d.pending / tot) * 100}%` }} title={`${d.pending} pending`} />
                  </div>
                );
              })()}
            </div>
            <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm"><Users className="h-4 w-4 text-white" /></div>
              <p className="text-2xl font-bold text-gray-900 mt-2.5 leading-none">{d.travellers}</p>
              <p className="text-[11px] text-gray-500 mt-1">Travellers</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{d.confirmed} confirmed · {d.seatLocked} seat-lock</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm"><Users className="h-4 w-4 text-white" /></div>
                {d.newUsersToday > 0 && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">+{d.newUsersToday}</span>}
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2.5 leading-none">{(d.totalUsers || 0).toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-gray-500 mt-1">Users</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{d.verifiedUsers} verified</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm ring-1 ring-black/[0.02]">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-sm"><MapPin className="h-4 w-4 text-white" /></div>
              <p className="text-2xl font-bold text-gray-900 mt-2.5 leading-none">{d.activeTrips}</p>
              <p className="text-[11px] text-gray-500 mt-1">Active trips</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{d.nextTripDays != null ? (d.nextTripDays === 0 ? 'one starts today' : `next in ${d.nextTripDays}d`) : `${upcoming.length} upcoming`}</p>
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
                        <p className="text-xs font-semibold text-green-700">{inr(t.booked.collected)} <span className="text-gray-400 font-normal">in</span></p>
                        {t.booked.pending > 0 && <p className="text-xs text-orange-600 font-medium">{inr(t.booked.pending)} due</p>}
                      </div>
                      <div className="w-24 sm:w-32 flex-shrink-0">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-gray-700">{t.booked.pax}{cap > 0 ? `/${cap}` : ''} seats</span>
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

        {/* RIGHT RAIL — Today's activity + quick links */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-purple-600" />Today</h2>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between"><span className="text-gray-600 flex items-center gap-2"><Users className="h-3.5 w-3.5 text-gray-400" />New users</span><span className="font-bold text-gray-900">{d.newUsersToday || 0}</span></li>
              <li className="flex items-center justify-between"><span className="text-gray-600 flex items-center gap-2"><Package className="h-3.5 w-3.5 text-gray-400" />New bookings</span><span className="font-bold text-gray-900">{d.newBookingsToday || 0}</span></li>
              <li className="flex items-center justify-between"><span className="text-gray-600 flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-gray-400" />Collected</span><span className="font-bold text-green-700">{inr(d.collectedToday)}</span></li>
              <li className="flex items-center justify-between"><span className="text-gray-600 flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-gray-400" />Awaiting approval</span><span className={`font-bold ${d.pendingApproval > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{d.pendingApproval || 0}</span></li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick links</h2>
            <div className="space-y-1.5">
              <Link href="/admin/bookings" className="flex items-center justify-between text-sm text-gray-700 hover:text-purple-700 py-1.5"><span>All bookings</span><ArrowRight className="h-3.5 w-3.5 text-gray-300" /></Link>
              <Link href="/admin/payments" className="flex items-center justify-between text-sm text-gray-700 hover:text-purple-700 py-1.5"><span>Payments</span><ArrowRight className="h-3.5 w-3.5 text-gray-300" /></Link>
              <Link href="/admin/users" className="flex items-center justify-between text-sm text-gray-700 hover:text-purple-700 py-1.5"><span>Users</span><ArrowRight className="h-3.5 w-3.5 text-gray-300" /></Link>
              <Link href="/admin/trips/create" className="flex items-center justify-between text-sm text-purple-700 font-semibold hover:text-purple-800 py-1.5"><span>+ Create trip</span><ArrowRight className="h-3.5 w-3.5 text-purple-300" /></Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
