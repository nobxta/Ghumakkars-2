import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const userId = params.id;
    const { amount, action } = await request.json(); // action: 'add' or 'set'

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Get current wallet balance
    const { data: userProfile, error: fetchError } = await adminClient
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentBalance = parseFloat(String(userProfile.wallet_balance || 0));
    const newBalance = action === 'set' 
      ? parseFloat(amount) 
      : currentBalance + parseFloat(amount);

    // Update wallet balance
    const { data: updatedProfile, error: updateError } = await adminClient
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating wallet balance:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update wallet balance' },
        { status: 500 }
      );
    }

    // Log the activity
    const changeAmount = newBalance - currentBalance;
    const actionDescription = action === 'set' 
      ? `Wallet balance set to ₹${newBalance.toLocaleString()} (was ₹${currentBalance.toLocaleString()})`
      : `Added ₹${changeAmount.toLocaleString()} to wallet (${currentBalance.toLocaleString()} → ${newBalance.toLocaleString()})`;

    await adminClient
      .from('admin_activity_log')
      .insert({
        user_id: userId,
        admin_id: user.id,
        action_type: action === 'set' ? 'wallet_set' : 'wallet_add',
        action_description: actionDescription,
        metadata: {
          previous_balance: currentBalance,
          new_balance: newBalance,
          change_amount: changeAmount,
          action: action
        }
      });

    return NextResponse.json({ 
      success: true,
      wallet_balance: updatedProfile.wallet_balance,
      previous_balance: currentBalance,
      change: changeAmount
    });
  } catch (error: any) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

