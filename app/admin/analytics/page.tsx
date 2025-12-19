'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, TrendingDown, BarChart3, PieChart, DollarSign, Users, Calendar, MapPin } from 'lucide-react';

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [tripsRes, bookingsRes, usersRes] = await Promise.all([
        supabase.from('trips').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const trips = tripsRes.data || [];
      const bookings = bookingsRes.data || [];
      const users = usersRes.data || [];

      const confirmedBookings = bookings.filter(b => b.booking_status === 'confirmed');
      const revenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0);

      setStats({
        totalTrips: trips.length,
        activeTrips: trips.filter(t => t.is_active).length,
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        totalRevenue: revenue,
        totalUsers: users.length,
        verifiedUsers: users.filter(u => u.email_verified).length,
        avgBookingValue: confirmedBookings.length > 0 ? revenue / confirmedBookings.length : 0,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">Analytics Dashboard</h1>
        <p className="text-sm text-gray-600">Comprehensive insights and metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Total Revenue</p>
          <p className="text-3xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">From {stats.confirmedBookings} confirmed bookings</p>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Total Bookings</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.confirmedBookings} confirmed</p>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Total Users</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.verifiedUsers} verified</p>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">Active Trips</p>
          <p className="text-3xl font-bold text-gray-900">{stats.activeTrips}</p>
          <p className="text-xs text-gray-500 mt-2">Out of {stats.totalTrips} total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Key Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Average Booking Value</span>
              <span className="font-bold text-gray-900">₹{stats.avgBookingValue.toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confirmation Rate</span>
              <span className="font-bold text-gray-900">
                {stats.totalBookings > 0 ? ((stats.confirmedBookings / stats.totalBookings) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">User Verification Rate</span>
              <span className="font-bold text-gray-900">
                {stats.totalUsers > 0 ? ((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-purple-600" />
            Quick Stats
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Trips Created</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTrips}</p>
            </div>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Pending Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBookings - stats.confirmedBookings}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
