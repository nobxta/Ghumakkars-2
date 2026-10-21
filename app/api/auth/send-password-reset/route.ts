import { NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeResetToken } from '@/lib/reset-token-store';
import { checkRateLimit, AUTH_LIMITS } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';
import crypto from 'crypto';
import { findAuthUserByEmail } from '@/lib/supabase/find-user';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, 'sendPasswordReset', AUTH_LIMITS.sendPasswordReset);
    if (limit.ok === false) {
      const retryAfter = limit.retryAfter;
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
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
    
    let userInAuth;
    try {
      userInAuth = await findAuthUserByEmail(adminClient, normalizedEmail);
    } catch (lookupError) {
      console.error('Error looking up user:', lookupError);
      return NextResponse.json(
        { error: 'Unable to verify account. Please try again.' },
        { status: 500 }
      );
    }

    // Account must exist in auth.users
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

    // Only send email if account exists
    // Generate reset token (stored in DB so all API workers can validate it)
    const resetToken = crypto.randomBytes(32).toString('hex');
    await storeResetToken(resetToken, normalizedEmail, 60); // 1 hour expiry

    // Create reset link
    const resetLink = `${getSiteUrl() || request.nextUrl.origin}/auth/reset-password?token=${resetToken}`;

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
