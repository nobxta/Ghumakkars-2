import { NextRequest, NextResponse } from 'next/server';
import { getResetTokenEmail } from '@/lib/reset-token-store';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
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

    return NextResponse.json({ 
      success: true,
      email,
    });
  } catch (error: any) {
    console.error('Error verifying reset token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify token' },
      { status: 500 }
    );
  }
}

