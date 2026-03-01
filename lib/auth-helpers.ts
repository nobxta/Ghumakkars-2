import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export type AuthUser = { id: string; email?: string };
export type ProfileWithRole = { role: string };

/**
 * Get current session (user only). Returns null if not authenticated.
 */
export async function getSession(): Promise<{ user: User } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { user };
}

/**
 * Require authenticated user. Returns 401 response if not logged in.
 */
export async function requireAuth(): Promise<
  { user: User } | NextResponse
> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

/**
 * Require admin role. Returns 401 if not logged in, 403 if not admin.
 */
export async function requireAdmin(): Promise<
  { user: User; profile: { role: string } } | NextResponse
> {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  return { user: session.user, profile };
}

/**
 * Check if request is from internal server (e.g. webhook calling send-notification).
 */
export function isInternalRequest(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-internal-secret');
  return header === secret;
}

/**
 * Headers for server-to-server calls to protected internal endpoints (e.g. send-notification).
 */
export function internalFetchHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-internal-secret'] = secret;
  return headers;
}
