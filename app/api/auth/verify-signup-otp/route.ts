import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/otp-store';
import { getPendingSignup, deletePendingSignup } from '@/lib/pending-signup-store';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, AUTH_LIMITS } from '@/lib/rate-limit';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, 'verifySignupOtp', AUTH_LIMITS.verifySignupOtp);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }
    const { email, otp, password } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }
    if (password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be 6–128 characters' },
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

    const adminClient = createAdminClient();

    // Get pending signup (account is created only after OTP)
    const pending = await getPendingSignup(normalizedEmail);

    // Fallback: existing auth user without profile (orphan) or legacy flow – just mark verified
    if (!pending) {
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const users = (listData?.users || []) as SupabaseUser[];
      const existingUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (existingUser) {
        await adminClient.auth.admin.updateUserById(existingUser.id, { email_confirm: true });
        await adminClient.from('profiles').update({ email_verified: true }).eq('id', existingUser.id);
        return NextResponse.json({
          success: true,
          message: 'Email verified. Signing you in.',
          userId: existingUser.id,
        });
      }
      return NextResponse.json(
        { error: 'Verification expired or invalid. Please start signup again.' },
        { status: 404 }
      );
    }

    // Create user in Supabase Auth (verified, since we verified email via OTP)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: pending.first_name,
        last_name: pending.last_name,
        phone: pending.phone,
        full_name: `${pending.first_name} ${pending.last_name}`,
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
    let userReferralCode: string;
    try {
      const { data: referralCodeData, error: rpcError } = await adminClient.rpc('generate_referral_code');
      if (rpcError || !referralCodeData) {
        throw new Error('RPC failed');
      }
      userReferralCode = referralCodeData;
    } catch {
      userReferralCode = newUser.user.id.substring(0, 8).toUpperCase() +
        Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    let referredByUserId: string | null = null;
    if (pending.referral_code) {
      const { data: referrerProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('referral_code', pending.referral_code)
        .maybeSingle();
      if (referrerProfile && referrerProfile.id !== newUser.user.id) {
        referredByUserId = referrerProfile.id;
      }
    }

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert([
        {
          id: newUser.user.id,
          email: normalizedEmail,
          first_name: pending.first_name,
          last_name: pending.last_name,
          full_name: `${pending.first_name} ${pending.last_name}`,
          phone: pending.phone,
          phone_number: pending.phone,
          role: 'user',
          email_verified: true,
          referral_code: userReferralCode,
          referred_by: referredByUserId,
          wallet_balance: 0,
        },
      ]);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      try {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
      } catch (e) {
        console.error('Rollback delete user failed:', e);
      }
      return NextResponse.json(
        { error: 'Failed to create profile. Please try again.' },
        { status: 500 }
      );
    }

    // Create referral record if referred
    if (referredByUserId) {
      try {
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
        await adminClient.from('referrals').insert([
          {
            referrer_id: referredByUserId,
            referred_user_id: newUser.user.id,
            referral_code: pending.referral_code,
            reward_status: 'pending',
            referrer_name: referrerName,
            referrer_email: referrerEmail,
            referred_user_name: `${pending.first_name} ${pending.last_name}`,
            referred_user_email: normalizedEmail,
          },
        ]);
      } catch (e) {
        console.error('Referral record creation failed:', e);
      }
    }

    await deletePendingSignup(normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Signing you in.',
      userId: newUser.user.id,
    });
  } catch (error: any) {
    console.error('Error verifying signup OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}
