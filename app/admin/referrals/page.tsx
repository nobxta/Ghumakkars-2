'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Users, Award, Gift, TrendingUp, CheckCircle, Clock, XCircle, Mail, Phone, Calendar, X, User } from 'lucide-react';

export default function AdminReferralsPage() {
  const router = useRouter();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalRewardsPaid: 0,
    pendingRewards: 0,
    totalReferrers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(100); // Default to 100, will be fetched
  const [processingReferral, setProcessingReferral] = useState<string | null>(null);
  const [reprocessingAll, setReprocessingAll] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Fetch referral reward amount
    const fetchRewardAmount = async () => {
      try {
        const response = await fetch('/api/referral/reward-amount');
        if (response.ok) {
          const data = await response.json();
          setRewardAmount(data.rewardAmount || 100);
        }
      } catch (error) {
        console.error('Error fetching reward amount:', error);
      }
    };
    
    fetchRewardAmount();
    fetchReferrals();
    const interval = setInterval(fetchReferrals, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchReferrals = async () => {
    try {
      // Fetch all referrals (with stored name/email data)
      const { data: referralsData, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!referralsData || referralsData.length === 0) {
        setReferrals([]);
        setStats({
          totalReferrals: 0,
          totalRewardsPaid: 0,
          pendingRewards: 0,
          totalReferrers: 0,
        });
        setLoading(false);
        return;
      }

      // Use stored name/email data, fallback to fetching from profiles if not available
      const referralsWithUsers = referralsData.map(r => {
        // Use stored data if available, otherwise create objects from stored fields
        const referrer = r.referrer_name || r.referrer_email ? {
          id: r.referrer_id,
          full_name: r.referrer_name,
          email: r.referrer_email,
          first_name: r.referrer_name?.split(' ')[0] || '',
          last_name: r.referrer_name?.split(' ').slice(1).join(' ') || '',
        } : null;

        const referredUser = r.referred_user_name || r.referred_user_email ? {
          id: r.referred_user_id,
          full_name: r.referred_user_name,
          email: r.referred_user_email,
          first_name: r.referred_user_name?.split(' ')[0] || '',
          last_name: r.referred_user_name?.split(' ').slice(1).join(' ') || '',
        } : null;

        return {
          ...r,
          referrer: referrer,
          referred_user: referredUser,
        };
      });

      setReferrals(referralsWithUsers);

      // Calculate stats
      const totalReferrals = referralsWithUsers?.length || 0;
      const creditedReferrals = referralsWithUsers?.filter((r: any) => r.reward_status === 'credited') || [];
      const pendingReferrals = referralsWithUsers?.filter((r: any) => r.reward_status === 'pending') || [];
      const uniqueReferrers = new Set(referralsWithUsers?.map((r: any) => r.referrer_id) || []);

      setStats({
        totalReferrals,
        totalRewardsPaid: creditedReferrals.length * rewardAmount,
        pendingRewards: pendingReferrals.length * rewardAmount,
        totalReferrers: uniqueReferrers.size,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      setLoading(false);
    }
  };

  const handleProcessReferral = async (referralId: string) => {
    setProcessingReferral(referralId);
    try {
      const response = await fetch('/api/admin/referrals/process-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Referral reward processed successfully!');
        await fetchReferrals();
      } else {
        alert('Failed to process referral: ' + (data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error processing referral:', error);
      alert('Failed to process referral: ' + error.message);
    } finally {
      setProcessingReferral(null);
    }
  };

  const handleReprocessAll = async () => {
    const pendingReferrals = referrals.filter((r: any) => r.reward_status === 'pending');
    if (pendingReferrals.length === 0) {
      alert('No pending referrals to process');
      return;
    }

    if (!confirm(`Are you sure you want to reprocess all ${pendingReferrals.length} pending referrals?`)) {
      return;
    }

    setReprocessingAll(true);
    try {
      const response = await fetch('/api/admin/referrals/reprocess-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully processed ${data.processed} referrals. ${data.failed} failed.`);
        await fetchReferrals();
      } else {
        alert('Failed to reprocess referrals: ' + (data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error reprocessing referrals:', error);
      alert('Failed to reprocess referrals: ' + error.message);
    } finally {
      setReprocessingAll(false);
    }
  };

  const filteredReferrals = referrals.filter(referral => {
    const matchesSearch = 
      referral.referrer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referrer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referred_user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referred_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.referral_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || referral.reward_status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-purple-600 tracking-wide font-medium">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2">Referral System</h1>
          <p className="text-sm text-gray-600">Manage and monitor referral program ({referrals.length} total)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReprocessAll}
            disabled={reprocessingAll || referrals.filter((r: any) => r.reward_status === 'pending').length === 0}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {reprocessingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Gift className="h-4 w-4" />
                <span>Reprocess All Pending ({referrals.filter((r: any) => r.reward_status === 'pending').length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-purple-600" />
            <TrendingUp className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-xs text-gray-600 mb-1">Total Referrals</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Award className="h-8 w-8 text-green-600" />
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
          <p className="text-xs text-gray-600 mb-1">Rewards Paid</p>
          <p className="text-2xl font-bold text-gray-900">₹{stats.totalRewardsPaid}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8 text-yellow-600" />
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <p className="text-xs text-gray-600 mb-1">Pending Rewards</p>
          <p className="text-2xl font-bold text-gray-900">₹{stats.pendingRewards}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-blue-600" />
            <TrendingUp className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-xs text-gray-600 mb-1">Active Referrers</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalReferrers}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-purple-200 p-4 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by referrer, referred user, or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="credited">Credited</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Referrer</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Referred User</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Reward</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {filteredReferrals.map((referral, index) => (
                <tr
                  key={referral.id}
                  className="hover:bg-purple-50 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <td className="px-6 py-4">
                    <div>
                      {referral.referrer ? (
                        <>
                          <div className="font-semibold text-gray-900">
                            {referral.referrer.full_name || 
                             (referral.referrer.first_name && referral.referrer.last_name
                               ? `${referral.referrer.first_name} ${referral.referrer.last_name}`
                               : referral.referrer.email || 'Unknown User')}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            {referral.referrer.email || 'No email'}
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-400 italic text-sm">
                          Loading user data...
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {referral.referred_user ? (
                        <>
                          <div className="font-semibold text-gray-900">
                            {referral.referred_user.full_name || 
                             (referral.referred_user.first_name && referral.referred_user.last_name
                               ? `${referral.referred_user.first_name} ${referral.referred_user.last_name}`
                               : referral.referred_user.email || 'Unknown User')}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center mt-1">
                            <Mail className="h-3 w-3 mr-1" />
                            {referral.referred_user.email || 'No email'}
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-400 italic text-sm">
                          Loading user data...
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-semibold text-purple-600">
                      {referral.referral_code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-green-600">
                      ₹{referral.reward_amount || rewardAmount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                      referral.reward_status === 'credited'
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : referral.reward_status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {referral.reward_status === 'credited' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Credited
                        </>
                      ) : referral.reward_status === 'pending' ? (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancelled
                        </>
                      )}
                    </span>
                      {referral.reward_status === 'pending' && (
                        <button
                          onClick={() => handleProcessReferral(referral.id)}
                          disabled={processingReferral === referral.id}
                          className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Manually process this referral reward"
                        >
                          {processingReferral === referral.id ? 'Processing...' : 'Process'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-purple-600" />
                      {new Date(referral.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                    {referral.credited_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Credited: {new Date(referral.credited_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredReferrals.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No referrals found</p>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUserModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedUser.type === 'referrer' ? 'Referrer' : 'Referred User'} Profile
                  </h2>
                  <p className="text-sm text-gray-500">User Details</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <div className="p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                  {selectedUser.full_name || 
                   (selectedUser.first_name && selectedUser.last_name
                     ? `${selectedUser.first_name} ${selectedUser.last_name}`
                     : selectedUser.first_name || selectedUser.last_name || 'N/A')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <div className="p-3 bg-gray-50 rounded-lg border-2 border-gray-200 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-purple-600" />
                  {selectedUser.email || 'N/A'}
                </div>
              </div>

              {selectedUser.userId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">User ID</label>
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-gray-200 font-mono text-xs">
                    {selectedUser.userId}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    router.push(`/admin/users/${selectedUser.userId}`);
                    setShowUserModal(false);
                  }}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <User className="h-5 w-5" />
                  <span>View Full Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

