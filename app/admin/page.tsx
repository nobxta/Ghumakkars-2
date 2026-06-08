'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, MapPin, Calendar, Users, IndianRupee, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import Link from 'next/link';

interface Trip {
  id: string;
  title: string;
  description?: string;
  destination: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  duration_days: number;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date: string;
  image_url?: string;
  is_active: boolean;
  booking_disabled?: boolean;
}

export default function AdminDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState({
    totalTrips: 0, activeTrips: 0,
    totalBookings: 0, confirmedBookings: 0, pendingBookings: 0,
    totalUsers: 0, verifiedUsers: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tripsRes, statsRes] = await Promise.all([
        supabase.from('trips')
          .select('id, title, destination, original_price, discounted_price, discount_percentage, duration_days, max_participants, current_participants, start_date, end_date, is_active, booking_disabled')
          .order('created_at', { ascending: false })
          .limit(6),
        Promise.all([
          supabase.from('trips').select('id, is_active', { count: 'exact', head: false }),
          supabase.from('bookings').select('booking_status, total_price', { count: 'exact', head: false }),
          supabase.from('profiles').select('email_verified', { count: 'exact', head: false }),
        ]),
      ]);

      setTrips(tripsRes.data || []);

      const [allTrips, allBookings, allUsers] = statsRes;
      const bookingsData = allBookings.data || [];
      const usersData = allUsers.data || [];
      const tripsData = allTrips.data || [];

      const confirmedBookings = bookingsData.filter((b: any) => b.booking_status === 'confirmed');
      setStats({
        totalTrips: tripsData.length,
        activeTrips: tripsData.filter((t: any) => t.is_active).length,
        totalBookings: bookingsData.length,
        confirmedBookings: confirmedBookings.length,
        pendingBookings: bookingsData.filter((b: any) => b.booking_status === 'pending').length,
        totalUsers: usersData.length,
        verifiedUsers: usersData.filter((u: any) => u.email_verified).length,
        totalRevenue: confirmedBookings.reduce((sum: number, b: any) => sum + (parseFloat(b.total_price) || 0), 0),
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip?')) return;
    try {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) throw error;
      fetchDashboardData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const { totalRevenue, activeTrips, totalBookings, confirmedBookings, pendingBookings, totalUsers, verifiedUsers } = stats;
  const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center gap-3 animate-slide-in">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-gray-500">Real-time insights</p>
        </div>
        <Link
          href="/admin/trips/create"
          className="neon-button px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-1.5 shadow-md whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>New Trip</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-5">
        <div className="stat-card neon-card rounded-xl sm:rounded-2xl border border-purple-200 p-2.5 sm:p-4 md:p-5 shadow-md animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl">
              <MapPin className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className={`text-[10px] sm:text-xs font-semibold ${activeTrips > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {activeTrips} Active
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 font-medium">Total Trips</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900">{stats.totalTrips}</p>
        </div>

        <div className="stat-card neon-card rounded-xl sm:rounded-2xl border border-purple-200 p-2.5 sm:p-4 md:p-5 shadow-md animate-scale-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl">
              <Calendar className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-700 px-1 sm:px-1.5 py-0.5 rounded-full font-bold">{confirmedBookings}</span>
              <span className="text-[9px] sm:text-[10px] bg-yellow-100 text-yellow-700 px-1 sm:px-1.5 py-0.5 rounded-full font-bold">{pendingBookings}</span>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 font-medium">Bookings</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900">{totalBookings}</p>
        </div>

        <div className="stat-card neon-card rounded-xl sm:rounded-2xl border border-purple-200 p-2.5 sm:p-4 md:p-5 shadow-md animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl">
              <Users className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-green-600">{verifiedUsers} ✓</span>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 font-medium">Users</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900">{totalUsers}</p>
        </div>

        <div className="stat-card neon-card rounded-xl sm:rounded-2xl border border-purple-200 p-2.5 sm:p-4 md:p-5 shadow-md animate-scale-in" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg sm:rounded-xl">
              <DollarSign className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-400">Revenue</span>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 font-medium">Total</p>
          <p className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
            <IndianRupee className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-0.5" />
            {totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Recent Trips */}
      <div className="neon-card rounded-xl sm:rounded-2xl border border-purple-200 shadow-md p-2.5 sm:p-4 md:p-6">
        <div className="flex justify-between items-center mb-3 sm:mb-5">
          <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900">Recent Trips</h2>
          <Link href="/admin/trips" className="neon-button px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-semibold">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
          {trips.slice(0, 6).map((trip, index) => (
            <div
              key={trip.id}
              className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-lg sm:rounded-xl p-2.5 sm:p-4 hover:border-purple-400 hover:shadow-md transition-all animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 pr-2 leading-tight truncate">{trip.title}</h3>
                <div className="flex space-x-1 flex-shrink-0">
                  <Link
                    href={`/admin/trips/edit/${trip.id}`}
                    className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-md transition-colors inline-block"
                  >
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700">
                <div className="flex items-center">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 text-purple-500" />
                  <span className="font-medium truncate">{trip.destination}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 text-purple-500" />
                  <span className="font-medium">{trip.duration_days} Days</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 text-purple-500" />
                  <span className="font-medium">{trip.current_participants}/{trip.max_participants}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-purple-100">
                  <div className="flex items-center">
                    <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 text-purple-500" />
                    <span className="font-bold text-sm sm:text-base text-gray-900">{trip.discounted_price.toLocaleString()}</span>
                  </div>
                  {trip.discount_percentage > 0 && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] sm:text-xs font-semibold">
                      {trip.discount_percentage}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {trips.length === 0 && (
          <div className="text-center py-8 sm:py-12 bg-purple-50 border border-purple-100 rounded-lg">
            <MapPin className="h-8 w-8 sm:h-12 sm:w-12 text-purple-300 mx-auto mb-3" />
            <p className="text-sm sm:text-lg text-gray-700 font-medium mb-1">No trips created yet</p>
            <p className="text-xs sm:text-sm text-gray-600">Tap &quot;New Trip&quot; to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
