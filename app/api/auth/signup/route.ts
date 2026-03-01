import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSignupOTPEmail } from '@/lib/email';
import { generateOTP, storeOTP } from '@/lib/otp-store';
import { storePendingSignup } from '@/lib/pending-signup-store';
import { checkRateLimit, AUTH_LIMITS } from '@/lib/rate-limit';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, 'signup', AUTH_LIMITS.signup);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }
    const { firstName, lastName, email, phone, password, referralCode } = await request.json();

    // Validation - Check all required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate first name and last name
    if (firstName.trim().length < 2) {
      return NextResponse.json(
        { error: 'First name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (lastName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Last name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.toLowerCase().trim();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate phone number (10 digits for Indian numbers)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return NextResponse.json(
        { error: 'Phone number must be exactly 10 digits' },
        { status: 400 }
      );
    }

    // Format phone number (store as 10 digits)
    const formattedPhone = phoneDigits;

    // Validate password
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be less than 128 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists by email
    const adminClient = createAdminClient();
    
    // Check in auth.users - look for all users (including deleted/inactive)
    const { data, error: listUsersError } = await adminClient.auth.admin.listUsers();
    
    if (listUsersError || !data?.users) {
      console.error('Error listing users:', listUsersError);
      return NextResponse.json(
        { error: 'Unable to verify account. Please try again.' },
        { status: 500 }
      );
    }
    
    const users = data.users as SupabaseUser[];
    const existingUserByEmail = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    
    if (existingUserByEmail) {
      // Log detailed info about the existing user for debugging
      console.log(`[Signup] User found in auth.users:`, {
        id: existingUserByEmail.id,
        email: existingUserByEmail.email,
        email_confirmed: existingUserByEmail.email_confirmed_at,
        created_at: existingUserByEmail.created_at,
        confirmed_at: existingUserByEmail.confirmed_at,
        deleted_at: (existingUserByEmail as any).deleted_at,
      });
      
      // Check if user has a profile
      const { data: existingProfile, error: profileCheckError } = await adminClient
        .from('profiles')
        .select('id, email, email_verified')
        .eq('id', existingUserByEmail.id)
        .maybeSingle();
      
      if (profileCheckError) {
        console.error('[Signup] Error checking profile:', profileCheckError);
      }
      
      // If user exists but has no profile (orphaned account), create the missing profile
      if (!existingProfile) {
        console.warn(`[Signup] User exists in auth.users but has no profile: ${normalizedEmail}. Creating profile...`);
        
        // Create the missing profile for the existing auth user
        const { error: profileCreateError } = await adminClient
          .from('profiles')
          .insert([
            {
              id: existingUserByEmail.id,
              email: normalizedEmail,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              phone: formattedPhone,
              phone_number: formattedPhone,
              role: 'user',
              email_verified: !!existingUserByEmail.email_confirmed_at,
            },
          ]);

        if (profileCreateError) {
          console.error('[Signup] Error creating profile for existing user:', profileCreateError);
          // If profile creation fails due to duplicate key, check if it exists now
          if (profileCreateError.code === '23505') { // Unique violation
            console.log('[Signup] Profile may have been created by another process. Continuing...');
          } else {
            return NextResponse.json(
              { 
                error: 'Account exists but profile setup failed. Please contact support.',
                suggestion: 'contact',
              },
              { status: 500 }
            );
          }
        }

        // Generate and store OTP for email verification if email not confirmed
        if (!existingUserByEmail.email_confirmed_at) {
          const otp = generateOTP();
          await storeOTP(normalizedEmail, otp, 10, 'signup');
          
          try {
            await sendSignupOTPEmail(normalizedEmail, otp, firstName.trim());
          } catch (emailError) {
            console.error('Error sending signup OTP email:', emailError);
          }
          
          return NextResponse.json({
            success: true,
            userId: existingUserByEmail.id,
            message: 'Profile created successfully! Please check your email for the OTP to verify your account.',
          });
        }

        return NextResponse.json({
          success: true,
          userId: existingUserByEmail.id,
          message: 'Profile created successfully. You can now sign in.',
        });
      }
      
      // User exists with profile - normal case
      return NextResponse.json(
        { 
          error: 'An account with this email already exists. Please sign in instead.',
          suggestion: 'signin',
          message: 'If you already have an account, please use the sign in page instead.'
        },
        { status: 409 }
      );
    }

    // Check if phone number already exists in profiles
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .or(`phone.eq.${phoneDigits},phone_number.eq.${phoneDigits}`)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists' },
        { status: 409 }
      );
    }

    // Store pending signup (account is created only after OTP verification)
    await storePendingSignup({
      email: normalizedEmail,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: formattedPhone,
      referral_code: referralCode?.trim().toUpperCase() || null,
    });

    // Generate and store OTP for email verification
    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 10, 'signup'); // 10 minutes expiry

    // Send OTP email
    try {
      await sendSignupOTPEmail(normalizedEmail, otp, firstName.trim());
    } catch (emailError) {
      console.error('Error sending signup OTP email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent. Check your email and enter the code to complete signup.',
    });
  } catch (error: any) {
    console.error('Error during signup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

