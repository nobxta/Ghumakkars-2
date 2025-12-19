'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, MapPin, Calendar, Users, IndianRupee, Link as LinkIcon, CheckCircle, XCircle, Clock, Send, Ban, DollarSign, MoreVertical, X } from 'lucide-react';
import Link from 'next/link';

interface Trip {
  id: string;
  title: string;
  destination: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  duration_days: number;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  status?: string;
  scheduled_publish_at?: string;
  booking_disabled?: boolean;
  cancellation_reason?: string;
  postponed_to_date?: string;
  completed_at?: string;
  actual_participants?: number;
}

export default function AdminTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [postponeDate, setPostponeDate] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/trips/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete trip');
      fetchTrips();
      alert('Trip deleted successfully');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleStatusChange = async (tripId: string, action: string, data?: any) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/trips/${tripId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });
      if (!response.ok) throw new Error('Failed to update trip status');
      await fetchTrips();
      setShowCompleteModal(false);
      setShowCancelModal(false);
      setShowPostponeModal(false);
      setShowPriceModal(false);
      setShowActionMenu(null);
      alert('Trip updated successfully');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async (tripId: string) => {
    if (!confirm('Send reminder email to all booked users?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/trips/${tripId}/send-reminder`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send reminders');
      alert('Reminders sent successfully');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBooking = async (tripId: string, disabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/trips/${tripId}/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_disabled: disabled }),
      });
      if (!response.ok) throw new Error('Failed to update booking status');
      await fetchTrips();
      alert(`Bookings ${disabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // Categorize trips by status
  const getTripStatus = (trip: Trip) => {
    if (trip.status) return trip.status;
    return trip.is_active ? 'active' : 'draft';
  };

  const activeTrips = trips.filter(trip => getTripStatus(trip) === 'active');
  const scheduledTrips = trips.filter(trip => getTripStatus(trip) === 'scheduled');
  const draftTrips = trips.filter(trip => getTripStatus(trip) === 'draft');
  const completedTrips = trips.filter(trip => getTripStatus(trip) === 'completed');
  const cancelledTrips = trips.filter(trip => getTripStatus(trip) === 'cancelled');
  const postponedTrips = trips.filter(trip => getTripStatus(trip) === 'postponed');

  const stats = {
    total: trips.length,
    active: activeTrips.length,
    scheduled: scheduledTrips.length,
    draft: draftTrips.length,
    completed: completedTrips.length,
    cancelled: cancelledTrips.length,
    postponed: postponedTrips.length,
  };

  // Trip Card Component
  const TripCard = ({ trip }: { trip: Trip }) => {
    const status = getTripStatus(trip);
    const statusColors = {
      active: 'border-green-200 bg-green-50/30',
      scheduled: 'border-yellow-200 bg-yellow-50/30',
      draft: 'border-gray-200 bg-gray-50/30',
      completed: 'border-blue-200 bg-blue-50/30',
      cancelled: 'border-red-200 bg-red-50/30',
      postponed: 'border-orange-200 bg-orange-50/30',
    };
    
    return (
      <div className={`bg-white rounded-xl border-2 ${statusColors[status as keyof typeof statusColors] || 'border-gray-200'} p-4 shadow-md hover:shadow-lg transition-all`}>
        <div className="flex items-start justify-between mb-3">
          <Link href={`/admin/trips/${trip.id}`} className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg mb-1 truncate group-hover:text-purple-600 transition-colors">
              {trip.title}
            </h3>
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <MapPin className="h-4 w-4 mr-1 text-purple-600 flex-shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
          </Link>
          <div className="flex items-center space-x-1 ml-2" onClick={(e) => e.stopPropagation()}>
            <Link
              href={`/admin/trips/edit/${trip.id}`}
              className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowActionMenu(showActionMenu === trip.id ? null : trip.id)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showActionMenu === trip.id && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-2">
                  <button
                    onClick={() => {
                      setSelectedTrip(trip);
                      if (trip.status === 'active') {
                        setShowCompleteModal(true);
                      }
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    disabled={trip.status !== 'active'}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Mark Complete</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTrip(trip);
                      setShowCancelModal(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    disabled={trip.status === 'completed' || trip.status === 'cancelled'}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel Trip</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTrip(trip);
                      setShowPostponeModal(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    disabled={trip.status === 'completed' || trip.status === 'cancelled'}
                  >
                    <Clock className="h-4 w-4" />
                    <span>Postpone</span>
                  </button>
                  <button
                    onClick={() => handleSendReminder(trip.id)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    disabled={trip.status !== 'active' || actionLoading}
                  >
                    <Send className="h-4 w-4" />
                    <span>Send Reminder</span>
                  </button>
                  <button
                    onClick={() => handleToggleBooking(trip.id, !trip.booking_disabled)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Ban className="h-4 w-4" />
                    <span>{trip.booking_disabled ? 'Enable' : 'Disable'} Bookings</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTrip(trip);
                      setNewPrice(trip.discounted_price.toString());
                      setShowPriceModal(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>Change Price</span>
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Trip</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center space-x-2">
            <IndianRupee className="h-4 w-4 text-purple-600" />
            <div>
              <p className="font-bold text-gray-900">{trip.discounted_price.toLocaleString()}</p>
              {trip.discount_percentage > 0 && (
                <p className="text-xs text-gray-500 line-through">₹{trip.original_price.toLocaleString()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-purple-600" />
            <div>
              <p className="font-semibold text-gray-900">{trip.current_participants}/{trip.max_participants}</p>
              <p className="text-xs text-gray-500">participants</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div>
              <p className="font-semibold text-gray-900">{trip.duration_days} days</p>
              <p className="text-xs text-gray-500">duration</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <div>
              <p className="font-semibold text-gray-900 text-xs">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBD'}
              </p>
              <p className="text-xs text-gray-500">start date</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${
            status === 'active' ? 'bg-green-100 text-green-700 border-green-200'
            : status === 'completed' ? 'bg-blue-100 text-blue-700 border-blue-200'
            : status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200'
            : status === 'postponed' ? 'bg-orange-100 text-orange-700 border-orange-200'
            : status === 'scheduled' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
            : 'bg-gray-100 text-gray-700 border-gray-200'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          {trip.booking_disabled && (
            <span className="text-xs text-red-600 font-medium">Bookings Disabled</span>
          )}
          <Link
            href={`/admin/trips/${trip.id}`}
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
          >
            View Details →
          </Link>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">Manage Trips</h1>
          <p className="text-sm text-gray-600">Create, edit, and manage all trips ({trips.length} total)</p>
        </div>
        <Link
          href="/admin/trips/create"
          className="neon-button px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span>Create Trip</span>
        </Link>
      </div>

      {/* Stats - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-xl border-2 border-purple-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Total</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-green-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Active</p>
          <p className="text-xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-yellow-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Scheduled</p>
          <p className="text-xl font-bold text-yellow-600">{stats.scheduled}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Drafts</p>
          <p className="text-xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-blue-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Completed</p>
          <p className="text-xl font-bold text-blue-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-red-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Cancelled</p>
          <p className="text-xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-orange-200 p-3 shadow-md">
          <p className="text-xs text-gray-600 mb-1">Postponed</p>
          <p className="text-xl font-bold text-orange-600">{stats.postponed}</p>
        </div>
      </div>

      {/* Trips Sections */}
      <div className="space-y-6">
            {/* Active Trips */}
            {activeTrips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    Active Trips ({activeTrips.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Trips */}
            {scheduledTrips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                    Scheduled Trips ({scheduledTrips.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scheduledTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}

            {/* Draft Trips */}
            {draftTrips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Edit className="h-5 w-5 text-gray-600 mr-2" />
                    Draft Trips ({draftTrips.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {draftTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Trips - Separate Section */}
            {completedTrips.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                    Completed Trips ({completedTrips.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedTrips.map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}

            {/* Cancelled & Postponed Trips */}
            {(cancelledTrips.length > 0 || postponedTrips.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Other Status</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...cancelledTrips, ...postponedTrips].map((trip) => (
                    <TripCard key={trip.id} trip={trip} />
                  ))}
                </div>
              </div>
            )}

        {/* Empty State */}
        {trips.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-purple-200">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2 font-medium">No trips found</p>
            <Link href="/admin/trips/create" className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors">
              <Plus className="h-4 w-4" />
              <span>Create Your First Trip</span>
            </Link>
          </div>
        )}
      </div>

      {/* Complete Trip Modal */}
      {showCompleteModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Mark Trip as Complete</h2>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Mark &quot;{selectedTrip.title}&quot; as completed?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(selectedTrip.id, 'complete')}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Trip Modal */}
      {showCancelModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Cancel Trip</h2>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Cancel &quot;{selectedTrip.title}&quot;?</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="Enter cancellation reason..."
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(selectedTrip.id, 'cancel', { reason: cancelReason })}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Cancel Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Trip Modal */}
      {showPostponeModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Postpone Trip</h2>
              <button onClick={() => setShowPostponeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Postpone &quot;{selectedTrip.title}&quot; to a new date?</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Date</label>
              <input
                type="date"
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPostponeModal(false);
                  setPostponeDate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(selectedTrip.id, 'postpone', { date: postponeDate })}
                disabled={actionLoading || !postponeDate}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Postpone Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Price Modal */}
      {showPriceModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Change Price</h2>
              <button onClick={() => setShowPriceModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">Update price for &quot;{selectedTrip.title}&quot;</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Price (₹)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="Enter new price"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPriceModal(false);
                  setNewPrice('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(selectedTrip.id, 'change_price', { price: parseFloat(newPrice) })}
                disabled={actionLoading || !newPrice || parseFloat(newPrice) <= 0}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Update Price'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
