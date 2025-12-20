import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otp-store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'OTP must be a 6-digit number' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.trim();

    // Verify OTP
    const isValid = await verifyOTP(normalizedEmail, normalizedOTP, 'signup');

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please request a new one.' },
        { status: 400 }
      );
    }

    // Get user from Supabase
    const adminClient = createAdminClient();
    const { data, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError || !data?.users) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to verify account' },
        { status: 500 }
      );
    }

    const users = data.users as SupabaseUser[];
    const user = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User account not found. Please try signing up again.' },
        { status: 404 }
      );
    }

    // Mark email as verified in auth
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateAuthError) {
      console.error('Error updating auth user:', updateAuthError);
      return NextResponse.json(
        { error: 'Failed to verify email address' },
        { status: 500 }
      );
    }

    // Update profile email_verified status
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail if profile update fails, but log it
    }

    // Generate a session token for the user
    const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      // Return success anyway, user can log in manually
      return NextResponse.json({
        success: true,
        message: 'Email verified successfully! Your account is now active. Please sign in to continue.',
        userId: user.id,
        sessionCreated: false,
      });
    }

    // OTP is already marked as used in verifyOTP, no need to remove

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! Your account is now active.',
      userId: user.id,
      sessionCreated: true,
      // Note: The client will need to sign in with password to get a proper session
    });
  } catch (error: any) {
    console.error('Error verifying signup OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}

