import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResetTokenEmail, removeResetToken } from '@/lib/reset-token-store';
import type { SupabaseUser } from '@/lib/types/supabase';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const email = getResetTokenEmail(token);

    if (!email) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    // Update password using admin client
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers();

    if (error || !data?.users) {
      return NextResponse.json(
        { error: 'Unable to fetch users' },
        { status: 500 }
      );
    }

    const users = data.users as SupabaseUser[];
    const user = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Remove the token
    removeResetToken(token);

    return NextResponse.json({ 
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}

