import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import { logError, type ErrorCategory } from '@/lib/error-log';

export const runtime = "nodejs";

const ALLOWED_CATEGORIES: ErrorCategory[] = ['payment', 'booking', 'auth', 'otp', 'system'];

/**
 * Browser-side failures the server never sees (e.g. Razorpay checkout declining a card).
 * Logged-in users only; device, IP and user are taken from the request, not the body.
 */
export async function POST(request: NextRequest) {
  const limit = checkRateLimit(request, 'errorReport', 20);
  if (limit.ok === false) {
    return NextResponse.json({ error: 'Too many reports' }, { status: 429 });
  }

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.process !== 'string' || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'process and message are required' }, { status: 400 });
  }

  await logError({
    category: ALLOWED_CATEGORIES.includes(body.category) ? body.category : 'system',
    process: `${body.process.slice(0, 100)} (browser)`,
    message: body.message.slice(0, 1000),
    code: typeof body.code === 'string' || typeof body.code === 'number' ? body.code : null,
    request,
    userId: auth.user.id,
    userEmail: auth.user.email,
    bookingId: typeof body.bookingId === 'string' ? body.bookingId : null,
    details: body.details && typeof body.details === 'object' ? body.details : undefined,
  });

  return NextResponse.json({ ok: true });
}
