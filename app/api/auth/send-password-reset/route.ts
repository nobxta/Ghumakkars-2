import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeResetToken } from '@/lib/reset-token-store';
import crypto from 'crypto';
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
      // Still allow password reset if user exists in auth.users, but log warning
    }

    // Only send email if account exists
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    storeResetToken(resetToken, normalizedEmail, 60); // 1 hour expiry

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin}/auth/reset-password?token=${resetToken}`;

    // Send email only after confirming account exists
    await sendPasswordResetEmail(normalizedEmail, resetLink);

    // Return success message
    return NextResponse.json({ 
      success: true, 
      message: 'Password reset link sent to your email. Please check your inbox.' 
    });
  } catch (error: any) {
    console.error('Error sending password reset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send password reset email' },
      { status: 500 }
    );
  }
}

