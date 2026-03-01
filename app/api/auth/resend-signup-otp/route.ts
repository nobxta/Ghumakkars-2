import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPendingSignup } from '@/lib/pending-signup-store';
import { sendSignupOTPEmail } from '@/lib/email';
import { generateOTP, storeOTP } from '@/lib/otp-store';
import { checkRateLimit, AUTH_LIMITS } from '@/lib/rate-limit';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, 'resendSignupOtp', AUTH_LIMITS.resendSignupOtp);
    if (limit.ok === false) {
      const retryAfter = limit.retryAfter;
      return NextResponse.json(
        { error: 'Too many resend attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const adminClient = createAdminClient();

    // Case 1: Pending signup (no account yet) – resend OTP using pending data
    const pending = await getPendingSignup(normalizedEmail);
    if (pending) {
      const otp = generateOTP();
      await storeOTP(normalizedEmail, otp, 10, 'signup');
      try {
        await sendSignupOTPEmail(normalizedEmail, otp, pending.first_name);
      } catch (emailError) {
        console.error('Error sending signup OTP email:', emailError);
        return NextResponse.json(
          { error: 'Failed to send verification code. Please try again later.' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Verification code resent. Check your email.',
      });
    }

    // Case 2: Existing user not yet verified – legacy resend
    const { data, error } = await adminClient.auth.admin.listUsers();
    if (error || !data?.users) {
      return NextResponse.json(
        { error: 'Unable to verify. Please try again.' },
        { status: 500 }
      );
    }
    const users = data.users as SupabaseUser[];
    const user = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { error: 'No pending signup found. Please start signup again.' },
        { status: 404 }
      );
    }
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email_verified, first_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.email_verified) {
      return NextResponse.json(
        { error: 'Email is already verified. Please sign in instead.' },
        { status: 400 }
      );
    }
    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 10, 'signup');
    try {
      await sendSignupOTPEmail(normalizedEmail, otp, profile?.first_name || '');
    } catch (emailError) {
      console.error('Error sending signup OTP email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again later.' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: 'Verification code resent. Check your email.',
    });
  } catch (error: any) {
    console.error('Error resending signup OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resend. Please try again.' },
      { status: 500 }
    );
  }
}
