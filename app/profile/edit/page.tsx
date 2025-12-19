'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ArrowLeft, User, Mail, Phone, Save, Check, Camera, Lock, 
  Building2, Users, Calendar, CreditCard, Loader2, ChevronDown
} from 'lucide-react';

// Colleges/Universities list
const MATHURA_COLLEGES = [
  'GLA University',
  'Sanskriti University',
  'GL Bajaj Group of Institutions',
  'Babu Shivnath Agrawal (PG) College',
  'Aligarh Muslim University',
  'Dayalbagh Educational Institute',
  'IIT Kanpur',
  'IIM Lucknow',
  'Banaras Hindu University',
  'MNNIT Allahabad',
  'IIT (BHU) Varanasi',
  'Other (Custom)',
  'Not in College/University'
];

const EMERGENCY_RELATIONS = [
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Relative',
  'Friend',
  'Other'
];

export default function EditProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // OTP states for email change
  const [showEmailOTP, setShowEmailOTP] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOTP, setEmailOTP] = useState('');
  const [sendingEmailOTP, setSendingEmailOTP] = useState(false);
  const [verifyingEmailOTP, setVerifyingEmailOTP] = useState(false);

  // OTP states for password change
  const [showPasswordOTP, setShowPasswordOTP] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordOTP, setPasswordOTP] = useState('');
  const [sendingPasswordOTP, setSendingPasswordOTP] = useState(false);
  const [verifyingPasswordOTP, setVerifyingPasswordOTP] = useState(false);

  // College selection state
  const [collegeSelection, setCollegeSelection] = useState<'dropdown' | 'custom' | 'none'>('dropdown');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [customCollege, setCustomCollege] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    collegeName: '',
    emergencyContact: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    gender: '',
    dateOfBirth: '',
    studentId: '',
    alternativeNumber: '',
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }
      setUser(user);

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        const collegeName = profileData.college_name || profileData.university || '';
        const isInList = MATHURA_COLLEGES.slice(0, -2).includes(collegeName);
        
        if (collegeName === 'Not in College/University') {
          setCollegeSelection('none');
        } else if (isInList) {
          setCollegeSelection('dropdown');
          setSelectedCollege(collegeName);
        } else if (collegeName) {
          setCollegeSelection('custom');
          setCustomCollege(collegeName);
        }

        setFormData({
          firstName: profileData.first_name || '',
          lastName: profileData.last_name || '',
          email: profileData.email || user.email || '',
          phone: profileData.phone || profileData.phone_number || '',
          collegeName: collegeName,
          emergencyContact: profileData.emergency_contact || '',
          emergencyContactName: profileData.emergency_contact_name || '',
          emergencyContactRelation: profileData.emergency_contact_relation || '',
          gender: profileData.gender || '',
          dateOfBirth: profileData.date_of_birth || '',
          studentId: profileData.student_id || '',
          alternativeNumber: profileData.alternative_number || '',
        });
        setAvatarUrl(profileData.avatar_url || null);
      } else {
        setFormData({
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || '',
          collegeName: '',
          emergencyContact: '',
          emergencyContactName: '',
          emergencyContactRelation: '',
          gender: '',
          dateOfBirth: '',
          studentId: '',
          alternativeNumber: '',
        });
      }
      setLoading(false);
    };

    getUser();
  }, [router, supabase]);

  const handleCollegeChange = (value: string) => {
    if (value === 'Other (Custom)') {
      setCollegeSelection('custom');
      setSelectedCollege('');
      setCustomCollege('');
      setFormData({ ...formData, collegeName: '' });
    } else if (value === 'Not in College/University') {
      setCollegeSelection('none');
      setSelectedCollege('Not in College/University');
      setCustomCollege('');
      setFormData({ ...formData, collegeName: 'Not in College/University' });
    } else {
      setCollegeSelection('dropdown');
      setSelectedCollege(value);
      setCustomCollege('');
      setFormData({ ...formData, collegeName: value });
    }
  };

  const handleCustomCollegeChange = (value: string) => {
    setCustomCollege(value);
    setFormData({ ...formData, collegeName: value });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload avatar');
      }

      setAvatarUrl(data.url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSendEmailOTP = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingEmailOTP(true);
    setError('');

    try {
      const response = await fetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', email: newEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setShowEmailOTP(true);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSendingEmailOTP(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (!emailOTP || emailOTP.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingEmailOTP(true);
    setError('');

    try {
      const response = await fetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-and-update', email: newEmail, otp: emailOTP }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      setFormData({ ...formData, email: newEmail });
      setShowEmailOTP(false);
      setNewEmail('');
      setEmailOTP('');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingEmailOTP(false);
    }
  };

  const handleSendPasswordOTP = async () => {
    setSendingPasswordOTP(true);
    setError('');

    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-otp', email: formData.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setShowPasswordOTP(true);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSendingPasswordOTP(false);
    }
  };

  const handleVerifyPasswordOTP = async () => {
    if (!passwordOTP || passwordOTP.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setVerifyingPasswordOTP(true);
    setError('');

    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-and-update', otp: passwordOTP, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      setShowPasswordOTP(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOTP('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingPasswordOTP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const finalCollegeName = collegeSelection === 'custom' ? customCollege : 
                               collegeSelection === 'none' ? 'Not in College/University' : 
                               selectedCollege;

      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: fullName,
          phone: formData.phone,
          phone_number: formData.phone,
          college_name: finalCollegeName,
          university: finalCollegeName,
          emergency_contact: formData.emergencyContact,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_relation: formData.emergencyContactRelation,
          gender: formData.gender,
          date_of_birth: formData.dateOfBirth || null,
          student_id: formData.studentId,
          alternative_number: formData.alternativeNumber,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: fullName,
          phone: formData.phone,
        },
      });

      if (authError) throw authError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link href="/profile" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6 text-sm font-medium transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Back to Profile</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 md:px-8 py-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Edit Profile</h1>
            <p className="text-purple-100 text-sm mt-1">Update your personal information</p>
          </div>

          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded-r-lg flex items-center space-x-2">
                <Check className="h-5 w-5 flex-shrink-0" />
                <span>Profile updated successfully!</span>
              </div>
            )}

            {/* Profile Picture */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Profile Picture
              </label>
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-purple-200 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center border-4 border-purple-200 shadow-md">
                      <User className="h-12 w-12 md:h-14 md:w-14 text-white" />
                    </div>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                    <Camera className="h-4 w-4" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                  </button>
                  <p className="mt-2 text-xs text-gray-500">JPG, PNG or GIF. Max size 5MB</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-3 border-b-2 border-purple-200">
                  <User className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="Enter your first name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="Enter your last name"
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 bg-gray-50 text-gray-600 rounded-lg cursor-not-allowed"
                      placeholder="your.email@example.com"
                    />
                  </div>
                  {!showEmailOTP ? (
                    <button
                      type="button"
                      onClick={handleSendEmailOTP}
                      disabled={sendingEmailOTP}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 transition-colors"
                    >
                      {sendingEmailOTP ? 'Sending OTP...' : 'Change Email'}
                    </button>
                  ) : (
                    <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Email</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none"
                          placeholder="new.email@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                        <input
                          type="text"
                          value={emailOTP}
                          onChange={(e) => setEmailOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          className="w-full px-4 py-2.5 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none text-center text-2xl tracking-widest font-mono"
                          placeholder="000000"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleVerifyEmailOTP}
                          disabled={verifyingEmailOTP || !emailOTP || emailOTP.length !== 6}
                          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {verifyingEmailOTP ? 'Verifying...' : 'Verify & Update'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowEmailOTP(false);
                            setNewEmail('');
                            setEmailOTP('');
                          }}
                          className="px-4 py-2 border-2 border-purple-200 text-gray-700 rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  {!showPasswordOTP ? (
                    <button
                      type="button"
                      onClick={handleSendPasswordOTP}
                      disabled={sendingPasswordOTP}
                      className="inline-flex items-center space-x-2 text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 transition-colors"
                    >
                      <Lock className="h-4 w-4" />
                      <span>{sendingPasswordOTP ? 'Sending OTP...' : 'Change Password'}</span>
                    </button>
                  ) : (
                    <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                        <input
                          type="text"
                          value={passwordOTP}
                          onChange={(e) => setPasswordOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          maxLength={6}
                          className="w-full px-4 py-2.5 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none text-center text-2xl tracking-widest font-mono"
                          placeholder="000000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:outline-none"
                          placeholder="Confirm new password"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleVerifyPasswordOTP}
                          disabled={verifyingPasswordOTP || !passwordOTP || passwordOTP.length !== 6 || !newPassword || newPassword !== confirmPassword}
                          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {verifyingPasswordOTP ? 'Verifying...' : 'Verify & Update'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordOTP(false);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordOTP('');
                          }}
                          className="px-4 py-2 border-2 border-purple-200 text-gray-700 rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        required
                        maxLength={10}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Alternative Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.alternativeNumber}
                        onChange={(e) => setFormData({ ...formData, alternativeNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        maxLength={10}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="9876543210 (Optional)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* College/University Section */}
              <div className="space-y-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-2 pb-3 border-b-2 border-purple-200">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">College/University Information</h2>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    College/University Name
                  </label>
                  {collegeSelection === 'dropdown' || (!collegeSelection && !customCollege) ? (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                      <select
                        value={selectedCollege}
                        onChange={(e) => handleCollegeChange(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 appearance-none bg-white transition-all"
                      >
                        <option value="">Select College/University</option>
                        {MATHURA_COLLEGES.map((college) => (
                          <option key={college} value={college}>
                            {college}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                  ) : collegeSelection === 'custom' ? (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={customCollege}
                        onChange={(e) => handleCustomCollegeChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="Enter your college/university name"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCollegeSelection('dropdown');
                          setCustomCollege('');
                          setSelectedCollege('');
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Back to List
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Student ID
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                      placeholder="Enter your student ID"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Details Section */}
              <div className="space-y-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-2 pb-3 border-b-2 border-purple-200">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">Personal Details</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="space-y-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-2 pb-3 border-b-2 border-purple-200">
                  <Users className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-gray-900">Emergency Contact</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                        placeholder="Enter contact name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Relation
                    </label>
                    <div className="relative">
                      <select
                        value={formData.emergencyContactRelation}
                        onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 appearance-none bg-white transition-all"
                      >
                        <option value="">Select Relation</option>
                        {EMERGENCY_RELATIONS.map((relation) => (
                          <option key={relation} value={relation.toLowerCase()}>
                            {relation}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.emergencyContact}
                      onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none rounded-lg text-gray-900 transition-all"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 text-base font-semibold tracking-wide uppercase hover:from-purple-700 hover:to-purple-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-100"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
