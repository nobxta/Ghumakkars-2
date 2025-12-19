import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOTP, storeOTP, verifyOTP } from '@/lib/otp-store';
import { sendLoginOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { action, email, otp, newPassword } = await request.json();

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'send-otp') {
      // Send OTP to current email
      const userEmail = user.email;
      if (!userEmail) {
        return NextResponse.json(
          { error: 'User email not found' },
          { status: 400 }
        );
      }

      // Generate and store OTP
      const otpCode = generateOTP();
      await storeOTP(userEmail.toLowerCase(), otpCode, 10, 'change-password');

      // Send OTP email
      await sendLoginOTPEmail(userEmail, otpCode);

      return NextResponse.json({
        success: true,
        message: 'OTP sent to your email address'
      });
    }

    if (action === 'verify-and-update') {
      // Verify OTP and update password
      if (!otp || !newPassword) {
        return NextResponse.json(
          { error: 'OTP and new password are required' },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      const userEmail = user.email;
      if (!userEmail) {
        return NextResponse.json(
          { error: 'User email not found' },
          { status: 400 }
        );
      }

      const normalizedOTP = otp.trim();

      // Verify OTP
      const isValid = await verifyOTP(userEmail.toLowerCase(), normalizedOTP, 'change-password');

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP' },
          { status: 400 }
        );
      }

      // Update password
      const adminClient = createAdminClient();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update password' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in change-password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

