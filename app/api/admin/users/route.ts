import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { authAvatarUrl } from '@/lib/auth-avatar';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminClient = createAdminClient();

    const { data: users, error: usersError } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: usersError.message || 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Users who signed in with Google (etc.) have their photo in auth metadata,
    // not in profiles.avatar_url. Fill it in so the list shows their picture.
    const authAvatars = new Map<string, string>();
    const needsAvatar = (users || []).some((u: any) => !u.avatar_url);
    if (needsAvatar) {
      try {
        for (let page = 1; page <= 50; page++) {
          const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
          if (error || !data?.users?.length) break;
          for (const au of data.users) {
            const url = authAvatarUrl(au);
            if (url) authAvatars.set(au.id, url);
          }
          if (data.users.length < 1000) break;
        }
      } catch (e) {
        console.error('Error fetching auth avatars:', e);
      }
    }

    const merged = (users || []).map((u: any) =>
      u.avatar_url ? u : { ...u, avatar_url: authAvatars.get(u.id) || null }
    );

    return NextResponse.json({ users: merged });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
