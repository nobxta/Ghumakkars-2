import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOTP, storeOTP, verifyOTP } from '@/lib/otp-store';
import { sendLoginOTPEmail } from '@/lib/email';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { action, email, otp } = await request.json();

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'send-otp') {
      // Send OTP to new email
      if (!email || !email.includes('@')) {
        return NextResponse.json(
          { error: 'Valid email is required' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if email is already in use
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.auth.admin.listUsers();

      if (error || !data?.users) {
        return NextResponse.json(
          { error: 'Unable to fetch users' },
          { status: 500 }
        );
      }

      const users = data.users as SupabaseUser[];
      const emailExists = users.some(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (emailExists) {
        return NextResponse.json(
          { error: 'This email is already registered' },
          { status: 400 }
        );
      }

      // Generate and store OTP
      const otpCode = generateOTP();
      await storeOTP(normalizedEmail, otpCode, 10, 'change-email');

      // Send OTP email
      await sendLoginOTPEmail(normalizedEmail, otpCode);

      return NextResponse.json({
        success: true,
        message: 'OTP sent to your new email address'
      });
    }

    if (action === 'verify-and-update') {
      // Verify OTP and update email
      if (!email || !otp) {
        return NextResponse.json(
          { error: 'Email and OTP are required' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const normalizedOTP = otp.trim();

      // Verify OTP
      const isValid = await verifyOTP(normalizedEmail, normalizedOTP, 'change-email');

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP' },
          { status: 400 }
        );
      }

      // Update email in auth
      const adminClient = createAdminClient();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { email: normalizedEmail }
      );

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update email' },
          { status: 500 }
        );
      }

      // Update email in profiles table
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ email: normalizedEmail })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile email:', profileError);
        // Don't fail if profile update fails, auth update succeeded
      }

      return NextResponse.json({
        success: true,
        message: 'Email updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in change-email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

