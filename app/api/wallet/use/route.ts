import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { amount, bookingId, description } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get current wallet balance
    const { data: profile } = await adminClient
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.wallet_balance || 0) < amount) {
      return NextResponse.json(
        { error: 'Insufficient wallet balance' },
        { status: 400 }
      );
    }

    // Debit wallet
    const success = await adminClient.rpc('debit_wallet', {
      p_user_id: user.id,
      p_amount: amount,
      p_description: description || 'Booking payment',
      p_reference_type: 'booking_payment',
      p_reference_id: bookingId || null,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to process wallet payment' },
        { status: 500 }
      );
    }

    // Get updated balance
    const { data: updatedProfile } = await adminClient
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      amountUsed: amount,
      remainingBalance: updatedProfile?.wallet_balance || 0,
    });
  } catch (error: any) {
    console.error('Error using wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to use wallet' },
      { status: 500 }
    );
  }
}

