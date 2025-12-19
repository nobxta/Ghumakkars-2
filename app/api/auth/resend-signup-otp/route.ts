import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSignupOTPEmail } from '@/lib/email';
import { generateOTP, storeOTP } from '@/lib/otp-store';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const adminClient = createAdminClient();
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const user = users.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { error: 'User account not found. Please complete the signup process first.' },
        { status: 404 }
      );
    }

    // Check if email is already verified
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();

    if (profile?.email_verified) {
      return NextResponse.json(
        { error: 'Email is already verified. Please sign in instead.' },
        { status: 400 }
      );
    }

    // Generate and store new OTP (storeOTP already removes old ones)
    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 10, 'signup'); // 10 minutes expiry

    // Get user's first name for personalized email
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single();

    const firstName = userProfile?.first_name || '';

    // Send signup OTP email
    try {
      await sendSignupOTPEmail(normalizedEmail, otp, firstName || undefined);
    } catch (emailError) {
      console.error('Error sending signup OTP email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP has been resent to your email. Please check your inbox.',
    });
  } catch (error: any) {
    console.error('Error resending signup OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resend OTP. Please try again.' },
      { status: 500 }
    );
  }
}

