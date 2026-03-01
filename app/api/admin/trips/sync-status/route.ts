import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

/**
 * Calls the DB function update_trip_status() to:
 * - Auto-mark trips as completed when end_date has passed
 * - Publish scheduled trips when scheduled_publish_at is due
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc('update_trip_status');

    if (error) {
      console.error('Error syncing trip status:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in sync-status:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
