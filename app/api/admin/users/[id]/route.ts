import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const userId = params.id;

    // Use admin client to fetch user data
    const adminClient = createAdminClient();

    // Fetch profile
    const { data: userProfile, error: userProfileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userProfileError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch auth user data
    const { data: authUserData, error: authError2 } = await adminClient.auth.admin.getUserById(userId);
    
    let authUser = null;
    if (!authError2 && authUserData?.user) {
      authUser = authUserData.user;
    }

    // Fetch bookings with payment transactions
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(`
        *,
        trips (
          id,
          title,
          destination,
          start_date,
          end_date,
          discounted_price
        ),
        payment_transactions (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Fetch activity logs
    const { data: activities } = await adminClient
      .from('admin_activity_log')
      .select(`
        *,
        admin:profiles!admin_activity_log_admin_id_fkey(
          id,
          full_name,
          first_name,
          last_name,
          email
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // If the user was referred, fetch the referrer's profile
    let referrer: { id: string; full_name?: string; first_name?: string; last_name?: string; email?: string; phone?: string; referral_code?: string } | null = null;
    if (userProfile.referred_by) {
      const { data: ref } = await adminClient
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, phone, referral_code')
        .eq('id', userProfile.referred_by)
        .single();
      if (ref) referrer = ref;
    }

    return NextResponse.json({
      user: userProfile,
      authUser,
      bookings: bookings || [],
      activities: activities || [],
      referrer,
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const userId = params.id;
    const body = await request.json();

    // Use admin client to update user data
    const adminClient = createAdminClient();

    // Get old profile data for comparison
    const { data: oldProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Update profile
    const { data: updatedProfile, error: updateError } = await adminClient
      .from('profiles')
      .update(body)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update user profile' },
        { status: 500 }
      );
    }

    // Log the activity - track what fields were changed
    const changedFields: string[] = [];
    Object.keys(body).forEach(key => {
      if (oldProfile && oldProfile[key] !== body[key]) {
        changedFields.push(key);
      }
    });

    if (changedFields.length > 0) {
      await adminClient
        .from('admin_activity_log')
        .insert({
          user_id: userId,
          admin_id: auth.user.id,
          action_type: 'profile_updated',
          action_description: `Updated profile fields: ${changedFields.join(', ')}`,
          metadata: {
            changed_fields: changedFields,
            old_values: oldProfile,
            new_values: body
          }
        });
    }

    return NextResponse.json({ user: updatedProfile });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


// Permanently delete a user and their data (bookings, payments, coupon usage,
// wallet, referrals, profile, and the auth account). Irreversible.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const id = params.id;
    const admin = createAdminClient();
    const safe = async (fn: () => any) => { try { await fn(); } catch { /* table may not exist */ } };

    // Payment transactions for this user's bookings first.
    const { data: bks } = await admin.from('bookings').select('id').eq('user_id', id);
    const bookingIds = (bks || []).map((b: any) => b.id);
    if (bookingIds.length) await safe(() => admin.from('payment_transactions').delete().in('booking_id', bookingIds));

    await safe(() => admin.from('coupon_usages').delete().eq('user_id', id));
    await safe(() => admin.from('bookings').delete().eq('user_id', id));
    // profiles delete cascades referrals + wallet_transactions.
    await safe(() => admin.from('profiles').delete().eq('id', id));

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete user' }, { status: 500 });
  }
}
