import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch referral reward amount
    const { data: paymentSettings } = await supabase
      .from('payment_settings')
      .select('referral_reward_amount')
      .limit(1)
      .single();
    
    const rewardAmount = paymentSettings?.referral_reward_amount || 100;

    // Fetch user's referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, wallet_balance')
      .eq('id', user.id)
      .single();

    // Fetch referrals
    const { data: referrals } = await supabase
      .from('referrals')
      .select(`
        *,
        referred_user:profiles!referrals_referred_user_id_fkey(
          id,
          email,
          first_name,
          last_name,
          full_name,
          created_at
        )
      `)
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      referralCode: profile?.referral_code,
      walletBalance: profile?.wallet_balance || 0,
      referrals: referrals || [],
      totalReferrals: referrals?.length || 0,
      creditedRewards: referrals?.filter((r: any) => r.reward_status === 'credited').length * rewardAmount || 0,
      pendingRewards: referrals?.filter((r: any) => r.reward_status === 'pending').length * rewardAmount || 0,
      rewardAmount, // Include reward amount in response
    });
  } catch (error: any) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch referral data' },
      { status: 500 }
    );
  }
}

