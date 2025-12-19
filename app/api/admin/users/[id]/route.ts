import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function GET(
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

    return NextResponse.json({
      user: userProfile,
      authUser,
      bookings: bookings || [],
      activities: activities || [],
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
          admin_id: user.id,
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

