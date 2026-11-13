/** Profile photo from a Supabase auth user's OAuth metadata (Google sets `avatar_url` / `picture`). */
export function authAvatarUrl(user: { user_metadata?: Record<string, any> | null } | null | undefined): string | null {
  const meta = user?.user_metadata || {};
  const url = meta.avatar_url || meta.picture;
  return typeof url === 'string' && url.trim() ? url : null;
}
