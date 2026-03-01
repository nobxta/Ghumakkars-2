import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otp-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, AUTH_LIMITS } from '@/lib/rate-limit';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, 'verifyOtp', AUTH_LIMITS.verifyOtp);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim();

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(normalizedOTP)) {
      return NextResponse.json(
        { error: 'OTP must be a 6-digit number. Please check and try again.' },
        { status: 400 }
      );
    }

    // Verify OTP
    console.log(`[Verify OTP API] Attempting to verify OTP for: ${normalizedEmail}`);
    const isValid = await verifyOTP(normalizedEmail, normalizedOTP, 'login');

    if (!isValid) {
      console.log(`[Verify OTP API] OTP verification failed for: ${normalizedEmail}`);
      return NextResponse.json(
        { 
          error: 'Invalid or expired OTP. Please check the code and try again, or request a new OTP.',
          suggestion: 'Please request a new OTP if the code has expired'
        },
        { status: 400 }
      );
    }
    
    console.log(`[Verify OTP API] OTP verified successfully for: ${normalizedEmail}`);

    // Get user from Supabase Auth using admin client
    const adminClient = createAdminClient();
    const { data, error: userError } = await adminClient.auth.admin.listUsers();

    if (userError || !data?.users) {
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500 }
      );
    }

    const users = data.users as SupabaseUser[];
    const user = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Mark email as confirmed so password login works next time (fixes "Invalid login credentials" for unconfirmed users)
    const authUser = user as SupabaseUser & { email_confirmed_at?: string | null };
    if (!authUser.email_confirmed_at) {
      await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true });
    }

    // Generate a magic link for the user to sign in
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (linkError) {
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // #region agent log
    const actionLink = linkData.properties?.action_link;
    const props = linkData.properties as { hashed_token?: string };
    const hashedToken = props?.hashed_token;
    let fromUrl: string | null = null;
    if (actionLink) {
      try {
        const u = new URL(actionLink);
        fromUrl = u.searchParams.get('token_hash') ?? u.searchParams.get('token');
      } catch {}
    }
    const queryKeys = actionLink ? Array.from(new URL(actionLink).searchParams.keys()) : [];
    fetch('http://127.0.0.1:7245/ingest/bb06f43a-5249-47f3-a9d7-c841981aadc5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7d8f21'},body:JSON.stringify({sessionId:'7d8f21',location:'verify-otp/route.ts:response',message:'generateLink response',data:{hasActionLink:!!actionLink,queryParamKeys:queryKeys,hasHashedToken:!!hashedToken,hasFromUrl:!!fromUrl},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    const tokenHash = hashedToken ?? fromUrl ?? undefined;

    return NextResponse.json({ 
      success: true,
      userId: user.id,
      email: user.email,
      magicLink: actionLink,
      token_hash: tokenHash,
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}

