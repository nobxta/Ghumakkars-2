'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Tag, Plus, X, Save, Calendar, MapPin, Users, Clock, Filter, Percent, DollarSign, CreditCard } from 'lucide-react';

export default function AdminCouponsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Coupons
  const [coupons, setCoupons] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    min_amount: '',
    max_discount: '',
    usage_limit: '',
    expiry_date: '',
    start_date: '',
    description: '',
    is_active: true,
    trip_ids: [] as string[],
    apply_to_all_trips: true,
    user_ids: [] as string[],
    apply_to_all_users: true,
    is_early_bird: false,
    early_bird_days_before: '',
    per_user_limit: '',
    max_total_discount: '',
  });

  useEffect(() => {
    fetchCoupons();
    fetchTrips();
    fetchUsers();
    setLoading(false);
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupon_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, destination, start_date')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.discount_value) {
      alert('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const couponData: any = {
        code: couponForm.code.toUpperCase().trim(),
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        min_amount: couponForm.min_amount ? parseFloat(couponForm.min_amount) : 0,
        max_discount: couponForm.max_discount ? parseFloat(couponForm.max_discount) : null,
        usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null,
        expiry_date: couponForm.expiry_date || null,
        start_date: couponForm.start_date || null,
        description: couponForm.description || null,
        is_active: couponForm.is_active,
        trip_ids: couponForm.apply_to_all_trips ? null : (couponForm.trip_ids.length > 0 ? couponForm.trip_ids : null),
        user_ids: couponForm.apply_to_all_users ? null : (couponForm.user_ids.length > 0 ? couponForm.user_ids : null),
        is_early_bird: couponForm.is_early_bird,
        early_bird_days_before: couponForm.is_early_bird && couponForm.early_bird_days_before ? parseInt(couponForm.early_bird_days_before) : null,
        per_user_limit: couponForm.per_user_limit ? parseInt(couponForm.per_user_limit) : null,
        max_total_discount: couponForm.max_total_discount ? parseFloat(couponForm.max_total_discount) : null,
        created_by: user?.id,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupon_codes')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('coupon_codes')
          .insert([couponData]);

        if (error) throw error;
      }

      alert('Coupon saved successfully!');
      setShowCouponForm(false);
      setEditingCoupon(null);
      resetCouponForm();
      await fetchCoupons();
    } catch (error: any) {
      console.error('Error saving coupon:', error);
      alert('Failed to save coupon: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      min_amount: '',
      max_discount: '',
      usage_limit: '',
      expiry_date: '',
      start_date: '',
      description: '',
      is_active: true,
      trip_ids: [],
      apply_to_all_trips: true,
      user_ids: [],
      apply_to_all_users: true,
      is_early_bird: false,
      early_bird_days_before: '',
      per_user_limit: '',
      max_total_discount: '',
    });
  };

  const handleEditCoupon = (coupon: any) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      min_amount: coupon.min_amount?.toString() || '',
      max_discount: coupon.max_discount?.toString() || '',
      usage_limit: coupon.usage_limit?.toString() || '',
      expiry_date: coupon.expiry_date ? coupon.expiry_date.split('T')[0] : '',
      start_date: coupon.start_date ? coupon.start_date.split('T')[0] : '',
      description: coupon.description || '',
      is_active: coupon.is_active,
      trip_ids: coupon.trip_ids || [],
      apply_to_all_trips: !coupon.trip_ids || coupon.trip_ids.length === 0,
      user_ids: coupon.user_ids || [],
      apply_to_all_users: !coupon.user_ids || coupon.user_ids.length === 0,
      is_early_bird: coupon.is_early_bird || false,
      early_bird_days_before: coupon.early_bird_days_before?.toString() || '',
      per_user_limit: coupon.per_user_limit?.toString() || '',
      max_total_discount: coupon.max_total_discount?.toString() || '',
    });
    setShowCouponForm(true);
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;

    try {
      const { error } = await supabase
        .from('coupon_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Coupon deleted successfully!');
      await fetchCoupons();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      alert('Failed to delete coupon: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">Coupon Management</h1>
          <p className="text-sm text-gray-600">Create and manage discount coupons for trips</p>
        </div>
        <button
          onClick={() => {
            setShowCouponForm(true);
            setEditingCoupon(null);
            resetCouponForm();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Coupon</span>
        </button>
      </div>

      {/* Coupon Form Modal */}
      {showCouponForm && (
        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
            </h3>
            <button
              onClick={() => {
                setShowCouponForm(false);
                setEditingCoupon(null);
                resetCouponForm();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Basic Information Section */}
          <div className="mb-8">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-purple-600" />
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Coupon Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={couponForm.discount_type}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount Value <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {couponForm.discount_type === 'percentage' ? (
                    <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  ) : (
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  )}
                  <input
                    type="number"
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                    placeholder={couponForm.discount_type === 'percentage' ? '20' : '500'}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                  />
                </div>
              </div>
              {couponForm.discount_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Max Discount Per Transaction (₹)
                  </label>
                  <input
                    type="number"
                    value={couponForm.max_discount}
                    onChange={(e) => setCouponForm({ ...couponForm, max_discount: e.target.value })}
                    placeholder="1000"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minimum Booking Amount (₹)
                </label>
                <input
                  type="number"
                  value={couponForm.min_amount}
                  onChange={(e) => setCouponForm({ ...couponForm, min_amount: e.target.value })}
                  placeholder="1000"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                  placeholder="Describe this coupon..."
                />
              </div>
            </div>
          </div>

          {/* Date Range Section */}
          <div className="mb-8 p-4 bg-purple-50 rounded-xl border-2 border-purple-100">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-purple-600" />
              Validity Period
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valid From
                </label>
                <input
                  type="date"
                  value={couponForm.start_date}
                  onChange={(e) => setCouponForm({ ...couponForm, start_date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={couponForm.expiry_date}
                  onChange={(e) => setCouponForm({ ...couponForm, expiry_date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Trip Selection Section */}
          <div className="mb-8 p-4 bg-blue-50 rounded-xl border-2 border-blue-100">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-blue-600" />
              Trip Selection
            </h4>
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={couponForm.apply_to_all_trips}
                  onChange={(e) => setCouponForm({ ...couponForm, apply_to_all_trips: e.target.checked, trip_ids: [] })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <span className="text-sm font-semibold text-gray-700">Apply to All Trips</span>
              </label>
            </div>
            {!couponForm.apply_to_all_trips && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Specific Trips
                </label>
                <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                  {trips.map((trip) => (
                    <label key={trip.id} className="flex items-center space-x-2 cursor-pointer hover:bg-purple-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={couponForm.trip_ids.includes(trip.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCouponForm({ ...couponForm, trip_ids: [...couponForm.trip_ids, trip.id] });
                          } else {
                            setCouponForm({ ...couponForm, trip_ids: couponForm.trip_ids.filter(id => id !== trip.id) });
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{trip.title} - {trip.destination}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Selection Section */}
          <div className="mb-8 p-4 bg-green-50 rounded-xl border-2 border-green-100">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-green-600" />
              User Selection
            </h4>
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={couponForm.apply_to_all_users}
                  onChange={(e) => setCouponForm({ ...couponForm, apply_to_all_users: e.target.checked, user_ids: [] })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <span className="text-sm font-semibold text-gray-700">Apply to All Users</span>
              </label>
            </div>
            {!couponForm.apply_to_all_users && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Specific Users
                </label>
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900 mb-2"
                  id="user-search"
                />
                <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                  {allUsers.map((user) => (
                    <label key={user.id} className="flex items-center space-x-2 cursor-pointer hover:bg-purple-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={couponForm.user_ids.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCouponForm({ ...couponForm, user_ids: [...couponForm.user_ids, user.id] });
                          } else {
                            setCouponForm({ ...couponForm, user_ids: couponForm.user_ids.filter(id => id !== user.id) });
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {user.first_name} {user.last_name} ({user.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Early Bird Section */}
          <div className="mb-8 p-4 bg-orange-50 rounded-xl border-2 border-orange-100">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-orange-600" />
              Early Bird Discount
            </h4>
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={couponForm.is_early_bird}
                  onChange={(e) => setCouponForm({ ...couponForm, is_early_bird: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <span className="text-sm font-semibold text-gray-700">Enable Early Bird Discount</span>
              </label>
            </div>
            {couponForm.is_early_bird && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Days Before Trip Start Date
                </label>
                <input
                  type="number"
                  value={couponForm.early_bird_days_before}
                  onChange={(e) => setCouponForm({ ...couponForm, early_bird_days_before: e.target.value })}
                  placeholder="e.g., 30 (for 30 days before trip)"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Coupon will only be valid if booking is made X days before trip start date</p>
              </div>
            )}
          </div>

          {/* Usage Limits Section */}
          <div className="mb-8 p-4 bg-indigo-50 rounded-xl border-2 border-indigo-100">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Filter className="h-5 w-5 mr-2 text-indigo-600" />
              Usage Limits & Restrictions
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Usage Limit
                </label>
                <input
                  type="number"
                  value={couponForm.usage_limit}
                  onChange={(e) => setCouponForm({ ...couponForm, usage_limit: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Total times this coupon can be used</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Per User Limit
                </label>
                <input
                  type="number"
                  value={couponForm.per_user_limit}
                  onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">How many times one user can use this</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Maximum Total Discount (₹)
                </label>
                <input
                  type="number"
                  value={couponForm.max_total_discount}
                  onChange={(e) => setCouponForm({ ...couponForm, max_total_discount: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum total discount amount across all uses (e.g., ₹50,000 total)</p>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="mb-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={couponForm.is_active}
                onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded"
              />
              <span className="text-sm font-semibold text-gray-700">Active (Coupon is enabled and can be used)</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t-2 border-gray-200">
            <button
              onClick={handleSaveCoupon}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Save className="h-5 w-5" />
              <span>{saving ? 'Saving...' : 'Save Coupon'}</span>
            </button>
            <button
              onClick={() => {
                setShowCouponForm(false);
                setEditingCoupon(null);
                resetCouponForm();
              }}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Coupons List */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Discount</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Usage</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expiry</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-gray-900">{coupon.code}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {coupon.discount_type === 'percentage' ? (
                      <span>{coupon.discount_value}%</span>
                    ) : (
                      <span>₹{coupon.discount_value}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {coupon.used_count}/{coupon.usage_limit || '∞'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700 text-sm">
                    {coupon.expiry_date ? new Date(coupon.expiry_date).toLocaleDateString() : 'No expiry'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditCoupon(coupon)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coupons.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No coupons created yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

