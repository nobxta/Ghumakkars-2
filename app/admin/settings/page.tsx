'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings, Save, Bell, Mail, Lock, Shield, CreditCard, QrCode, Phone, Upload } from 'lucide-react';

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'general' | 'payment'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // General Settings
  const [settings, setSettings] = useState({
    emailNotifications: true,
    bookingAlerts: true,
    weeklyReports: false,
    maintenanceMode: false,
  });

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    qrUrl: '',
    upiId: '',
    qrFile: null as File | null,
    qrPreview: '',
    paymentMode: 'manual', // 'manual' or 'razorpay'
    razorpayKeyId: '',
    razorpayKeySecret: '',
    razorpayWebhookSecret: '',
    referralRewardAmount: '100', // Configurable referral reward amount
  });

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
    // New fields
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
    fetchPaymentSettings();
    setLoading(false);
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching payment settings:', error);
      } else if (data) {
        setPaymentSettings({
          qrUrl: data.payment_qr_url || '',
          upiId: data.payment_upi_id || '',
          qrFile: null,
          qrPreview: data.payment_qr_url || '',
          paymentMode: data.payment_mode || 'manual',
          razorpayKeyId: data.razorpay_key_id || '',
          razorpayKeySecret: data.razorpay_key_secret || '',
          razorpayWebhookSecret: data.razorpay_webhook_secret || '',
          referralRewardAmount: data.referral_reward_amount?.toString() || '100',
        });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };


  const handleSavePaymentSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let qrUrl = paymentSettings.qrUrl;

      // Upload QR code to Cloudinary if file is selected
      if (paymentSettings.qrFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', paymentSettings.qrFile);

        const uploadResponse = await fetch('/api/upload/cloudinary', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || 'Failed to upload QR code');
        }

        const uploadData = await uploadResponse.json();
        qrUrl = uploadData.url;
      }

      // Check if payment settings exist
      const { data: existing } = await supabase
        .from('payment_settings')
        .select('id')
        .limit(1)
        .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('payment_settings')
            .update({
              payment_qr_url: qrUrl,
              payment_upi_id: paymentSettings.upiId,
              payment_mode: paymentSettings.paymentMode,
              razorpay_key_id: paymentSettings.razorpayKeyId || null,
              razorpay_key_secret: paymentSettings.razorpayKeySecret || null,
              razorpay_webhook_secret: paymentSettings.razorpayWebhookSecret || null,
              referral_reward_amount: parseFloat(paymentSettings.referralRewardAmount) || 100,
              updated_by: user?.id,
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          // Create new
          const { error } = await supabase
            .from('payment_settings')
            .insert([
              {
                payment_qr_url: qrUrl,
                payment_upi_id: paymentSettings.upiId,
                payment_mode: paymentSettings.paymentMode,
                razorpay_key_id: paymentSettings.razorpayKeyId || null,
                razorpay_key_secret: paymentSettings.razorpayKeySecret || null,
                razorpay_webhook_secret: paymentSettings.razorpayWebhookSecret || null,
                referral_reward_amount: parseFloat(paymentSettings.referralRewardAmount) || 100,
                updated_by: user?.id,
              },
            ]);

          if (error) throw error;
        }

      alert('Payment settings saved successfully!');
      await fetchPaymentSettings();
    } catch (error: any) {
      console.error('Error saving payment settings:', error);
      alert('Failed to save payment settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentSettings({
        ...paymentSettings,
        qrFile: file,
        qrPreview: URL.createObjectURL(file),
      });
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
        // New fields
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

  const handleSave = () => {
    alert('Settings saved successfully!');
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
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">Settings</h1>
        <p className="text-sm text-gray-600">Manage admin settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b-2 border-purple-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'general'
              ? 'text-purple-600 border-b-2 border-purple-600 -mb-0.5'
              : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'payment'
              ? 'text-purple-600 border-b-2 border-purple-600 -mb-0.5'
              : 'text-gray-600 hover:text-purple-600'
          }`}
        >
          Payment Settings
        </button>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-purple-600" />
            Notifications
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Email Notifications</span>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Booking Alerts</span>
              <input
                type="checkbox"
                checked={settings.bookingAlerts}
                onChange={(e) => setSettings({ ...settings, bookingAlerts: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Weekly Reports</span>
              <input
                type="checkbox"
                checked={settings.weeklyReports}
                onChange={(e) => setSettings({ ...settings, weeklyReports: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
          </div>
        </div>

        <div className="neon-card rounded-2xl border-2 border-purple-200 p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-purple-600" />
            System Settings
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-gray-700">Maintenance Mode</span>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
            </label>
            <div className="pt-4">
              <button onClick={handleSave} className="neon-button w-full px-4 py-3 rounded-xl font-semibold flex items-center justify-center space-x-2">
                <Save className="h-5 w-5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Payment Settings Tab */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <CreditCard className="h-6 w-6 mr-3 text-purple-600" />
            Payment Configuration
          </h2>

          <div className="space-y-6">
            {/* QR Code Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Payment QR Code
              </label>
              {paymentSettings.qrPreview && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <img
                    src={paymentSettings.qrPreview}
                    alt="QR Code Preview"
                    className="w-48 h-48 object-contain mx-auto rounded-lg"
                  />
                </div>
              )}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
                <input
                  type="file"
                  id="qr-upload"
                  accept="image/*"
                  onChange={handleQRUpload}
                  className="hidden"
                />
                <label
                  htmlFor="qr-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    {paymentSettings.qrPreview ? 'Change QR Code' : 'Upload QR Code Image'}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                </label>
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div className="mb-6 pb-6 border-b-2 border-purple-200">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  paymentSettings.paymentMode === 'manual'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200'
                }`}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="manual"
                    checked={paymentSettings.paymentMode === 'manual'}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, paymentMode: e.target.value })}
                    className="w-5 h-5 text-purple-600"
                  />
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Manual Payment</div>
                    <div className="text-xs text-gray-600 mt-1">QR Code + UTR/Reference ID</div>
                  </div>
                </label>
                <label className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  paymentSettings.paymentMode === 'razorpay'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200'
                }`}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="razorpay"
                    checked={paymentSettings.paymentMode === 'razorpay'}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, paymentMode: e.target.value })}
                    className="w-5 h-5 text-purple-600"
                  />
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">Razorpay Gateway</div>
                    <div className="text-xs text-gray-600 mt-1">Online payment processing</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Manual Payment Settings */}
            {paymentSettings.paymentMode === 'manual' && (
              <>
                {/* UPI ID */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    UPI ID
                  </label>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-5 w-5 text-purple-600" />
                    <input
                      type="text"
                      value={paymentSettings.upiId}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                      placeholder="your-upi-id@paytm"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Enter the UPI ID for receiving payments</p>
                </div>
              </>
            )}

            {/* Razorpay Settings */}
            {paymentSettings.paymentMode === 'razorpay' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Razorpay Key ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.razorpayKeyId}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpayKeyId: e.target.value })}
                    placeholder="rzp_test_..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-2">Enter your Razorpay Key ID from dashboard</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Razorpay Key Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.razorpayKeySecret}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpayKeySecret: e.target.value })}
                    placeholder="Enter secret key"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-2">Enter your Razorpay Key Secret (keep it secure)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Razorpay Webhook Secret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.razorpayWebhookSecret}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpayWebhookSecret: e.target.value })}
                    placeholder="whsec_..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Enter your Razorpay Webhook Secret (from Razorpay Dashboard → Settings → Webhooks)
                  </p>
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    Webhook URL: <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/razorpay</span>
                  </p>
                </div>
              </div>
            )}

            {/* Referral Reward Amount */}
            <div className="mb-6 pb-6 border-b-2 border-purple-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Referral Reward Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-purple-600">₹</span>
                <input
                  type="number"
                  value={paymentSettings.referralRewardAmount}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, referralRewardAmount: e.target.value })}
                  placeholder="100"
                  min="0"
                  step="1"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all text-gray-900 font-semibold text-lg"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Amount credited to referrer's wallet when a referred user makes their first booking
              </p>
            </div>

            <button
              onClick={handleSavePaymentSettings}
              disabled={saving}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Save Payment Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Coupons Tab - Moved to /admin/coupons */}
      {false && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <CreditCard className="h-6 w-6 mr-3 text-purple-600" />
              Coupon Management
            </h2>
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
      )}
    </div>
  );
}
