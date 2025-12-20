import { NextRequest, NextResponse } from 'next/server';
import { sendLoginOTPEmail } from '@/lib/email';
import { generateOTP, storeOTP } from '@/lib/otp-store';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseUser } from '@/lib/types/supabase';

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
    
    // Check if user account exists BEFORE sending any email
    const adminClient = createAdminClient();
    
    // First, check in auth.users table (primary check)
    const { data, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError || !data?.users) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Unable to verify account. Please try again.' },
        { status: 500 }
      );
    }

    const users = data.users as SupabaseUser[];
    const userInAuth = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    
    // Also check in profiles table for additional verification
    const { data: profiles, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .limit(1);

    // Account must exist in auth.users (primary requirement)
    if (!userInAuth) {
      return NextResponse.json(
        { 
          error: 'No account found with this email address',
          suggestion: 'signup',
          message: 'Would you like to create an account instead?'
        },
        { status: 404 }
      );
    }

    // Additional check: ensure profile exists too (for consistency)
    if (!profiles || profiles.length === 0) {
      console.warn(`User exists in auth but not in profiles: ${normalizedEmail}`);
      // Still allow login if user exists in auth.users, but log warning
    }

    // Only send email if account exists
    // Generate and store OTP
    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 10, 'login'); // 10 minutes expiry

    // Send email only after confirming account exists
    await sendLoginOTPEmail(normalizedEmail, otp);

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent to your email' 
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}

