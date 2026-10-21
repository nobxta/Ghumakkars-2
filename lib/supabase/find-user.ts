import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseUser } from '@/lib/types/supabase';

const PAGE_SIZE = 1000;

/**
 * Find an auth user by email.
 *
 * Don't use `auth.admin.listUsers()` + `.find()` for this: it only returns the
 * first page (50 users by default), so older accounts look like they don't exist.
 *
 * Looks up the id via `profiles.email` (one indexed query), then loads the auth user.
 * Falls back to paging through every auth user if the profile is missing or out of sync.
 */
export async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<SupabaseUser | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    console.error('[findAuthUserByEmail] Profile lookup failed:', profileError);
  }

  if (profile?.id) {
    const { data, error } = await adminClient.auth.admin.getUserById(profile.id);
    if (error) {
      console.error('[findAuthUserByEmail] getUserById failed:', error);
    } else if (data.user?.email?.toLowerCase() === normalizedEmail) {
      return data.user;
    }
  }

  // Fallback: scan every page of auth users
  for (const user of await listAllAuthUsers(adminClient)) {
    if (user.email?.toLowerCase() === normalizedEmail) return user;
  }
  return null;
}

/** Every auth user, across all pages. Throws if Supabase returns an error. */
export async function listAllAuthUsers(adminClient: SupabaseClient): Promise<SupabaseUser[]> {
  const all: SupabaseUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < PAGE_SIZE) return all;
  }
}
