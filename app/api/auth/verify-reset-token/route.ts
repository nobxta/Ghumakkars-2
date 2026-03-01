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

    const email = await getResetTokenEmail(token);

    // #region agent log
    const fs = await import('fs').catch(() => null);
    const logPath = 'debug-7d8f21.log';
    const payload = JSON.stringify({ sessionId: '7d8f21', location: 'verify-reset-token/route.ts', message: 'token lookup', data: { tokenLen: typeof token === 'string' ? token.length : 0, found: !!email }, timestamp: Date.now(), hypothesisId: 'H1' }) + '\n';
    if (fs) fs.promises.appendFile(logPath, payload).catch(() => {});
    // #endregion

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

