import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

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

    const { referralId } = await request.json();

    if (!referralId) {
      return NextResponse.json({ error: 'referralId is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Get referral record
    const { data: referral, error: referralError } = await adminClient
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (referralError || !referral) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    if (referral.reward_status !== 'pending') {
      return NextResponse.json({ error: 'Referral is not pending' }, { status: 400 });
    }

    // Check if referred user has any confirmed bookings
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select('id, booking_status')
      .eq('user_id', referral.referred_user_id)
      .in('booking_status', ['confirmed', 'seat_locked'])
      .order('created_at', { ascending: true })
      .limit(1);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json({ error: 'Failed to check bookings' }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ 
        error: 'Referred user has no confirmed bookings yet',
        success: false 
      }, { status: 400 });
    }

    // Get the first confirmed booking
    const firstBooking = bookings[0];

    // Process referral reward using the SQL function
    const { data: result, error: processError } = await adminClient.rpc('process_referral_reward', {
      p_booking_id: firstBooking.id
    });

    if (processError) {
      console.error('Error processing referral reward:', processError);
      return NextResponse.json({ 
        error: 'Failed to process referral reward: ' + processError.message,
        success: false 
      }, { status: 500 });
    }

    if (!result) {
      return NextResponse.json({ 
        error: 'Referral reward processing returned false. Check if this is truly the first booking.',
        success: false 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Referral reward processed successfully',
      bookingId: firstBooking.id
    });
  } catch (error: any) {
    console.error('Error processing pending referral:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

