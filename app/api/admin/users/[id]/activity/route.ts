import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Use admin client to fetch activity logs
    const adminClient = createAdminClient();

    const { data: activities, error: activitiesError } = await adminClient
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
      .limit(100);

    if (activitiesError) {
      console.error('Error fetching activity logs:', activitiesError);
      return NextResponse.json(
        { error: activitiesError.message || 'Failed to fetch activity logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

