'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Gift, Copy, Check, Users, Award, Share2, CheckCircle, Mail, X, User, IndianRupee, TrendingUp, Clock, Sparkles, ArrowRight, ExternalLink, Calendar } from 'lucide-react';

export default function ReferralPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(100); // Default to 100, will be fetched
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch referral reward amount
      try {
        const rewardResponse = await fetch('/api/referral/reward-amount');
        if (rewardResponse.ok) {
          const rewardData = await rewardResponse.json();
          setRewardAmount(rewardData.rewardAmount || 100);
        }
      } catch (error) {
        console.error('Error fetching reward amount:', error);
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth/signin');
        return;
      }
      setUser(currentUser);

      // Fetch profile with referral code
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code, wallet_balance')
        .eq('id', currentUser.id)
        .single();
      
      setProfile(profileData);

      // Fetch referrals (with stored name/email data)
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (referralsError) {
        console.error('Error fetching referrals:', referralsError);
        setReferrals([]);
      } else if (referralsData && referralsData.length > 0) {
        // Use stored name/email data directly
        const referralsWithUsers = referralsData.map(r => ({
          ...r,
          referred_user: r.referred_user_name || r.referred_user_email ? {
            id: r.referred_user_id,
            full_name: r.referred_user_name,
            email: r.referred_user_email,
            first_name: r.referred_user_name?.split(' ')[0] || '',
            last_name: r.referred_user_name?.split(' ').slice(1).join(' ') || '',
            created_at: r.created_at,
          } : null
        }));
        
        setReferrals(referralsWithUsers);
      } else {
        setReferrals([]);
      }
      setLoading(false);
    };

    fetchData();
  }, [router, supabase]);

  const referralCode = profile?.referral_code || user?.id?.substring(0, 8).toUpperCase() || 'GHUMAKKAR';
  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/signup?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalReferrals = referrals.length;
  const creditedRewards = referrals.filter(r => r.reward_status === 'credited').length * rewardAmount;
  const pendingRewards = referrals.filter(r => r.reward_status === 'pending').length * rewardAmount;

  if (loading) {
    return (
      <div className="min-h-screen pt-16 md:pt-20 pb-16 md:pb-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-16 bg-gradient-to-br from-purple-50 via-indigo-50/30 to-purple-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 md:py-8">
        <Link href="/profile" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4 sm:mb-6 text-sm font-semibold transition-colors group">
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Profile</span>
        </Link>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-purple-300 p-4 sm:p-6 md:p-8 lg:p-12 mb-4 sm:mb-6 md:mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-48 sm:h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center border-2 border-white/30 flex-shrink-0">
                <Gift className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">Referral Program</h1>
                <p className="text-purple-100 text-sm sm:text-base md:text-lg">Earn rewards by sharing!</p>
              </div>
            </div>
            <p className="text-white/90 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed">
              Invite your friends to join Ghumakkars and earn <span className="font-bold text-yellow-300">₹{rewardAmount}</span> for every successful referral when they make their first booking!
            </p>
          </div>
        </div>

        {/* Referral Code & Link Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 md:mb-8">
          {/* Referral Code Card */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-purple-200 p-4 sm:p-6 md:p-8 hover:shadow-2xl transition-all">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">
                Your Referral Code
              </label>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-3 sm:mb-4">
              <div className="flex-1 bg-gradient-to-r from-purple-100 to-purple-50 rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-2 border-purple-200 min-w-0">
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-700 tracking-wider font-mono break-all">{referralCode}</span>
              </div>
              <button
                onClick={handleCopy}
                className={`px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 flex-shrink-0 ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                }`}
              >
                {copied ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Copy className="h-4 w-4 sm:h-5 sm:w-5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-xs text-gray-600 flex items-center space-x-1">
              <Gift className="h-3 w-3 flex-shrink-0" />
              <span className="break-words">Share this code with your friends</span>
            </p>
          </div>

          {/* Referral Link Card */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-blue-200 p-4 sm:p-6 md:p-8 hover:shadow-2xl transition-all">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <label className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">
                Your Referral Link
              </label>
            </div>
            <div className="flex flex-col space-y-2 sm:space-y-3 mb-3 sm:mb-4">
              <div className="flex-1 bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 border-2 border-blue-200 overflow-hidden min-w-0">
                <span className="text-xs sm:text-sm text-gray-900 break-all font-mono">{referralLink}</span>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  copied 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Copy & Share Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-600 flex items-center space-x-1">
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="break-words">Send this link via WhatsApp, Email, or SMS</span>
            </p>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl border-2 border-purple-200 p-4 sm:p-6 md:p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{totalReferrals}</div>
            <div className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Referrals</div>
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-purple-200">
              <p className="text-xs text-gray-600">People you&apos;ve invited</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl sm:rounded-2xl border-2 border-green-200 p-4 sm:p-6 md:p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                <Award className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
            </div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2 flex items-center">
              <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 mr-1" />
              {creditedRewards.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Rewards Earned</div>
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-green-200">
              <p className="text-xs text-gray-600 flex items-center space-x-1">
                <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                <span>Credited to your wallet</span>
              </p>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl sm:rounded-2xl border-2 border-orange-200 p-4 sm:p-6 md:p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
            </div>
            <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2 flex items-center">
              <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 mr-1" />
              {pendingRewards.toLocaleString()}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">Pending Rewards</div>
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-orange-200">
              <p className="text-xs text-gray-600 flex items-center space-x-1">
                <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
                <span>Waiting for first booking</span>
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Referrals List */}
        {referrals.length > 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border-2 border-purple-100 p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Your Referrals</h2>
                  <p className="text-xs sm:text-sm text-gray-600">{totalReferrals} {totalReferrals === 1 ? 'person' : 'people'} referred</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {referrals.map((referral, index) => {
                const referredUser = referral.referred_user;
                
                // Get user name - prioritize full_name, then first+last, then first only, then email username
                const userName = referredUser?.full_name || 
                  (referredUser?.first_name && referredUser?.last_name 
                    ? `${referredUser.first_name} ${referredUser.last_name}`
                    : referredUser?.first_name || 
                      referredUser?.last_name || 
                      (referredUser?.email ? referredUser.email.split('@')[0] : ''));
                
                // Get user email
                const userEmail = referredUser?.email || '';
                const isCredited = referral.reward_status === 'credited';
                const isPending = referral.reward_status === 'pending';
                
                return (
                  <div
                    key={referral.id}
                    className={`p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 transition-all hover:shadow-lg ${
                      isCredited
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                        : isPending
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${
                          isCredited
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                            : isPending
                            ? 'bg-gradient-to-br from-yellow-500 to-amber-600'
                            : 'bg-gradient-to-br from-gray-400 to-gray-500'
                        }`}>
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {userName && (
                            <button
                              onClick={() => {
                                setSelectedUser({ ...referredUser, userId: referral.referred_user_id });
                                setShowUserModal(true);
                              }}
                              className="text-left hover:text-purple-600 transition-colors cursor-pointer group w-full"
                            >
                              <div className="font-bold text-gray-900 group-hover:underline text-sm sm:text-base md:text-lg truncate">
                                {userName}
                              </div>
                            </button>
                          )}
                          {userEmail && (
                            <div className="text-xs sm:text-sm text-gray-600 mt-1 flex items-center space-x-1 min-w-0">
                              <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                              <span className="truncate">{userEmail}</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1 sm:mt-2 flex items-center space-x-1">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>Joined: {new Date(referral.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2 sm:ml-4 flex-shrink-0">
                        <div className={`inline-flex items-center px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border-2 shadow-md ${
                          isCredited
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : isPending
                            ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}>
                          {isCredited ? (
                            <>
                              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                              <span className="flex items-center whitespace-nowrap">
                                <IndianRupee className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                                {rewardAmount}
                              </span>
                            </>
                          ) : isPending ? (
                            <>
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                              <span>Pending</span>
                            </>
                          ) : (
                            <span>No Reward</span>
                          )}
                        </div>
                        {isPending && (
                          <p className="text-xs text-gray-600 mt-1 sm:mt-2 text-center whitespace-nowrap">
                            Waiting
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border-2 border-purple-100 p-6 sm:p-8 md:p-12 text-center mb-4 sm:mb-6 md:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Users className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Referrals Yet</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">Start sharing your referral code to earn rewards!</p>
            <p className="text-xs sm:text-sm text-gray-500">You&apos;ll earn ₹{rewardAmount} for each friend who makes their first booking.</p>
          </div>
        )}

        {/* Enhanced How It Works */}
        <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-purple-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md flex-shrink-0">
                  1
                </div>
                <Share2 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-base sm:text-lg">Share Your Code</h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">Copy your unique referral code or link and share it with friends via WhatsApp, Email, or social media</p>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md flex-shrink-0">
                  2
                </div>
                <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-base sm:text-lg">They Sign Up</h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">Your friends sign up using your referral code and create their account on Ghumakkars</p>
            </div>
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md flex-shrink-0">
                  3
                </div>
                <Award className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-base sm:text-lg">You Earn Rewards</h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">When they make their first booking, you automatically receive <span className="font-bold text-green-600">₹{rewardAmount}</span> credited to your wallet!</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg sm:rounded-xl border-2 border-purple-200">
            <p className="text-xs sm:text-sm text-gray-700 flex items-start sm:items-center space-x-2">
              <Gift className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span><span className="font-bold">Reward Amount:</span> ₹{rewardAmount} per successful referral (credited when referred user makes their first booking)</span>
            </p>
          </div>
        </div>

        {/* Enhanced User Profile Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto" onClick={() => setShowUserModal(false)}>
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 relative animate-slide-up my-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowUserModal(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>

              <div className="mb-4 sm:mb-6">
                <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <User className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Referred User</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Profile Details</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-purple-200">
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Full Name</label>
                  <div className="p-2 sm:p-3 bg-white rounded-lg border-2 border-purple-200 font-semibold text-sm sm:text-base text-gray-900 break-words">
                    {selectedUser.full_name || 
                     (selectedUser.first_name && selectedUser.last_name
                       ? `${selectedUser.first_name} ${selectedUser.last_name}`
                       : selectedUser.first_name || selectedUser.last_name || 'N/A')}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-blue-200">
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Email Address</label>
                  <div className="p-2 sm:p-3 bg-white rounded-lg border-2 border-blue-200 flex items-center space-x-2 min-w-0">
                    <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-gray-900 font-medium text-sm sm:text-base break-all">{selectedUser.email || 'N/A'}</span>
                  </div>
                </div>

                {selectedUser.userId && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">User ID</label>
                    <div className="p-2 sm:p-3 bg-white rounded-lg border-2 border-gray-200 font-mono text-xs break-all text-gray-900">
                      {selectedUser.userId}
                    </div>
                  </div>
                )}

                {selectedUser.created_at && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border-2 border-green-200">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Joined Date</label>
                    <div className="p-2 sm:p-3 bg-white rounded-lg border-2 border-green-200 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-900 font-medium text-sm sm:text-base">
                        {new Date(selectedUser.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

