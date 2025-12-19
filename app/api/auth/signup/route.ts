import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSignupOTPEmail } from '@/lib/email';
import { generateOTP, storeOTP } from '@/lib/otp-store';

export async function POST(request: NextRequest) {
  try {
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
    const { data: { users }, error: listUsersError } = await adminClient.auth.admin.listUsers();
    
    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
      return NextResponse.json(
        { error: 'Unable to verify account. Please try again.' },
        { status: 500 }
      );
    }
    
    const existingUserByEmail = users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    
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

    // Create user in Supabase Auth (unverified)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false, // User needs to verify email via OTP
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: formattedPhone,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      },
    });

    if (createError || !newUser.user) {
      console.error('Error creating auth user:', createError);
      return NextResponse.json(
        { error: createError?.message || 'Failed to create account. Please try again.' },
        { status: 500 }
      );
    }

    // Generate referral code for new user
    // Try to use the database function, fallback to manual generation
    let userReferralCode: string;
    try {
      const { data: referralCodeData, error: rpcError } = await adminClient.rpc('generate_referral_code');
      if (rpcError || !referralCodeData) {
        throw new Error('RPC failed');
      }
      userReferralCode = referralCodeData;
    } catch (error) {
      // Fallback: generate code from user ID + random
      userReferralCode = newUser.user.id.substring(0, 8).toUpperCase() + 
        Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    // Handle referral code if provided
    let referredByUserId = null;
    if (referralCode && referralCode.trim()) {
      const normalizedRefCode = referralCode.trim().toUpperCase();
      // Find referrer by referral code
      const { data: referrerProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('referral_code', normalizedRefCode)
        .single();

      if (referrerProfile && referrerProfile.id !== newUser.user.id) {
        referredByUserId = referrerProfile.id;
      }
    }

    // Create profile in database
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert([
        {
          id: newUser.user.id,
          email: normalizedEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          phone: formattedPhone,
          phone_number: formattedPhone, // Also set phone_number for backward compatibility
          role: 'user',
          email_verified: false,
          referral_code: userReferralCode,
          referred_by: referredByUserId,
          wallet_balance: 0,
        },
      ]);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // If profile creation fails, delete the auth user to maintain data consistency
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting auth user after profile creation failure:', deleteError);
      }
      return NextResponse.json(
        { error: profileError.message || 'Failed to create profile. Please try again.' },
        { status: 500 }
      );
    }

    // Create referral record if user was referred
    if (referredByUserId) {
      try {
        // Fetch referrer's profile to get name and email
        const { data: referrerProfile } = await adminClient
          .from('profiles')
          .select('email, first_name, last_name, full_name')
          .eq('id', referredByUserId)
          .single();

        const referrerName = referrerProfile?.full_name || 
          (referrerProfile?.first_name && referrerProfile?.last_name
            ? `${referrerProfile.first_name} ${referrerProfile.last_name}`
            : referrerProfile?.first_name || referrerProfile?.last_name || 'Unknown');
        const referrerEmail = referrerProfile?.email || '';

        // Get referred user details
        const referredUserName = `${firstName.trim()} ${lastName.trim()}`;
        const referredUserEmail = normalizedEmail;

        await adminClient
          .from('referrals')
          .insert([
            {
              referrer_id: referredByUserId,
              referred_user_id: newUser.user.id,
              referral_code: referralCode.trim().toUpperCase(),
              reward_status: 'pending',
              referrer_name: referrerName,
              referrer_email: referrerEmail,
              referred_user_name: referredUserName,
              referred_user_email: referredUserEmail,
            },
          ]);
      } catch (referralError) {
        console.error('Error creating referral record:', referralError);
        // Don't fail signup if referral record creation fails
      }
    }

    // Generate and store OTP for email verification
    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 10, 'signup'); // 10 minutes expiry

    // Send OTP email for signup/registration
    try {
      await sendSignupOTPEmail(normalizedEmail, otp, firstName.trim());
    } catch (emailError) {
      console.error('Error sending signup OTP email:', emailError);
      // Don't fail the signup if email fails, but log it
      // User can request OTP resend later
    }

    return NextResponse.json({
      success: true,
      userId: newUser.user.id,
      message: 'Account created successfully! Please check your email for the OTP to verify your account.',
    });
  } catch (error: any) {
    console.error('Error during signup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

