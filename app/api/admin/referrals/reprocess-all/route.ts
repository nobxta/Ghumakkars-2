import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Get all pending referrals
    const { data: pendingReferrals, error: referralsError } = await adminClient
      .from('referrals')
      .select('*')
      .eq('reward_status', 'pending');

    if (referralsError) {
      console.error('Error fetching pending referrals:', referralsError);
      return NextResponse.json({ error: 'Failed to fetch pending referrals' }, { status: 500 });
    }

    if (!pendingReferrals || pendingReferrals.length === 0) {
      return NextResponse.json({ 
        processed: 0,
        failed: 0,
        message: 'No pending referrals found'
      });
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each pending referral
    for (const referral of pendingReferrals) {
      try {
        // Check if referred user has any confirmed bookings
        const { data: bookings } = await adminClient
          .from('bookings')
          .select('id, booking_status')
          .eq('user_id', referral.referred_user_id)
          .in('booking_status', ['confirmed', 'seat_locked'])
          .order('created_at', { ascending: true })
          .limit(1);

        if (!bookings || bookings.length === 0) {
          // User hasn't made a booking yet, skip
          continue;
        }

        // Get the first confirmed booking
        const firstBooking = bookings[0];

        // Process referral reward
        const { data: result, error: processError } = await adminClient.rpc('process_referral_reward', {
          p_booking_id: firstBooking.id
        });

        if (processError || !result) {
          failed++;
          errors.push(`Referral ${referral.id}: ${processError?.message || 'Processing returned false'}`);
        } else {
          processed++;
        }
      } catch (error: any) {
        failed++;
        errors.push(`Referral ${referral.id}: ${error.message}`);
        console.error(`Error processing referral ${referral.id}:`, error);
      }
    }

    return NextResponse.json({ 
      processed,
      failed,
      total: pendingReferrals.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return first 10 errors
    });
  } catch (error: any) {
    console.error('Error reprocessing referrals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

