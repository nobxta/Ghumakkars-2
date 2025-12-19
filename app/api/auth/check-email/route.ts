import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const adminClient = createAdminClient();

    // Check in auth.users
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    
    const userInAuth = users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    // Check in profiles
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', normalizedEmail);

    // Check in otp_codes (any recent OTPs)
    const { data: otps } = await adminClient
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      email: normalizedEmail,
      existsInAuth: !!userInAuth,
      authUser: userInAuth ? {
        id: userInAuth.id,
        email: userInAuth.email,
        email_confirmed: !!userInAuth.email_confirmed_at,
        created_at: userInAuth.created_at,
        confirmed_at: userInAuth.confirmed_at,
        last_sign_in: userInAuth.last_sign_in_at,
        user_metadata: userInAuth.user_metadata,
      } : null,
      existsInProfiles: profiles && profiles.length > 0,
      profiles: profiles || [],
      recentOTPs: otps || [],
    });
  } catch (error: any) {
    console.error('Error checking email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check email' },
      { status: 500 }
    );
  }
}

