'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, MapPin, Calendar, Users, IndianRupee, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import Link from 'next/link';

interface Trip {
  id: string;
  title: string;
  description: string;
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
}

export default function AdminDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    await Promise.all([fetchTrips(), fetchBookings(), fetchUsers()]);
    setLoading(false);
  };

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip?')) return;

    try {
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) throw error;
      fetchTrips();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // Calculate stats
  const totalRevenue = bookings.reduce((sum, booking) => sum + (parseFloat(booking.total_price) || 0), 0);
  const activeTrips = trips.filter(trip => trip.is_active).length;
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.booking_status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.booking_status === 'pending').length;
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.email_verified).length;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            Dashboard Overview
          </h1>
          <p className="text-sm text-gray-600 font-light">Real-time insights into your travel platform</p>
        </div>
        <Link
          href="/admin/trips/create"
          className="neon-button px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Create New Trip</span>
        </Link>
      </div>

      {/* Stats Cards with Neon Effects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div className={`text-sm font-semibold ${activeTrips > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {activeTrips > 0 ? <TrendingUp className="h-4 w-4 inline mr-1" /> : <Activity className="h-4 w-4 inline mr-1" />}
              {activeTrips} Active
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1 font-medium">Total Trips</p>
            <p className="text-3xl md:text-4xl font-bold text-gray-900">{trips.length}</p>
            <p className="text-xs text-gray-500 mt-2">{trips.length - activeTrips} Inactive</p>
          </div>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{confirmedBookings}</span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">{pendingBookings}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1 font-medium">Total Bookings</p>
            <p className="text-3xl md:text-4xl font-bold text-gray-900">{totalBookings}</p>
            <p className="text-xs text-gray-500 mt-2">₹{avgBookingValue.toFixed(0)} avg value</p>
          </div>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl animate-scale-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="text-sm font-semibold text-green-600">
              <TrendingUp className="h-4 w-4 inline mr-1" />
              {verifiedUsers} Verified
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1 font-medium">Total Users</p>
            <p className="text-3xl md:text-4xl font-bold text-gray-900">{totalUsers}</p>
            <p className="text-xs text-gray-500 mt-2">{totalUsers - verifiedUsers} Pending verification</p>
          </div>
        </div>

        <div className="stat-card neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl animate-scale-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className={`text-sm font-semibold ${totalRevenue > 0 ? 'text-green-600' : 'text-gray-500'}`}>
              {totalRevenue > 0 ? <TrendingUp className="h-4 w-4 inline mr-1" /> : <TrendingDown className="h-4 w-4 inline mr-1" />}
              Revenue
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1 font-medium">Total Revenue</p>
            <p className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center">
              <IndianRupee className="h-6 w-6 mr-1" />
              {totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-2">From {confirmedBookings} confirmed bookings</p>
          </div>
        </div>
      </div>


      {/* Recent Trips */}
      <div className="neon-card rounded-2xl border-2 border-purple-200 shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Trips</h2>
          <Link href="/admin/trips" className="neon-button px-4 py-2 rounded-lg text-sm font-semibold">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.slice(0, 6).map((trip, index) => (
            <div 
              key={trip.id} 
              className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 rounded-xl p-5 hover:border-purple-400 hover:shadow-lg transition-all animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900 pr-2 leading-tight">{trip.title}</h3>
                <div className="flex space-x-2 flex-shrink-0">
                  <Link
                    href={`/admin/trips/edit/${trip.id}`}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors inline-block"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-purple-500" />
                  <span className="font-medium">{trip.destination}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-purple-500" />
                  <span className="font-medium">{trip.duration_days} Days</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-purple-500" />
                  <span className="font-medium">{trip.current_participants}/{trip.max_participants} Participants</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                  <div className="flex items-center">
                    <IndianRupee className="h-4 w-4 mr-1 text-purple-500" />
                    <span className="font-bold text-lg text-gray-900">{trip.discounted_price.toLocaleString()}</span>
                  </div>
                  {trip.discount_percentage > 0 && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      {trip.discount_percentage}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {trips.length === 0 && (
          <div className="text-center py-12 bg-purple-50 border-2 border-purple-100 rounded-lg">
            <MapPin className="h-12 w-12 text-purple-300 mx-auto mb-4" />
            <p className="text-lg text-gray-700 font-medium mb-2">No trips created yet</p>
            <p className="text-sm text-gray-600">Click &quot;Create New Trip&quot; to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
