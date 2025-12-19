import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Fetch referral reward amount from payment_settings
    const { data, error } = await supabase
      .from('payment_settings')
      .select('referral_reward_amount')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching referral reward amount:', error);
      // Return default if error
      return NextResponse.json({ rewardAmount: 100 });
    }

    // Return configurable amount or default to 100
    const rewardAmount = data?.referral_reward_amount || 100;
    
    return NextResponse.json({ rewardAmount });
  } catch (error: any) {
    console.error('Error fetching referral reward amount:', error);
    return NextResponse.json({ rewardAmount: 100 }); // Default fallback
  }
}

