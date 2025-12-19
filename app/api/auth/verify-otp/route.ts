import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otp-store';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const { data: { users }, error: userError } = await adminClient.auth.admin.listUsers();

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to verify user' },
        { status: 500 }
      );
    }

    const user = users.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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

    return NextResponse.json({ 
      success: true,
      userId: user.id,
      email: user.email,
      magicLink: linkData.properties?.action_link,
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}

