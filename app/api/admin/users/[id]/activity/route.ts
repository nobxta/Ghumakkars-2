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

