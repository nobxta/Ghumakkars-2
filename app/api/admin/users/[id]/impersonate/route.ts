import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

// Returns a one-time token_hash the admin's "view as user" tab exchanges for an
// ISOLATED user session (stored in that tab's sessionStorage only). We deliberately
// do NOT return an action_link / redirect URL: opening a magic-link writes the shared
// auth cookie and would log the admin out, and its redirect target is whatever Supabase's
// dashboard "Site URL" is (which is why it was landing on localhost).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(params.id);
  const email = u?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'This user has no email to sign in with.' }, { status: 400 });
  }

  // magiclink generateLink gives us a hashed_token we can exchange via verifyOtp on a
  // standalone client — no cookies, no redirect involved.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Could not create a session token.' }, { status: 400 });
  }

  return NextResponse.json({
    token_hash: data.properties.hashed_token,
    email,
    name: (u?.user?.user_metadata as any)?.full_name || email,
  });
}
