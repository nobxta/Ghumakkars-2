import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

// Generates a one-time magic-link the admin can open (ideally in a private window)
// to sign in AS the user and see their account exactly as they do.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: u } = await admin.auth.admin.getUserById(params.id);
  const email = u?.user?.email;
  if (!email) return NextResponse.json({ error: 'This user has no email to sign in with.' }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/profile` },
  });
  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: error?.message || 'Could not create a login link.' }, { status: 400 });
  }
  return NextResponse.json({ link: data.properties.action_link, email });
}
