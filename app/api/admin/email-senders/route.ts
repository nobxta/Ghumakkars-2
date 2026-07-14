import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { ADMIN_EMAIL_SENDERS, ADMIN_SENDER_NAMES } from '@/lib/email';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    senders: ADMIN_EMAIL_SENDERS,
    senderNames: ADMIN_SENDER_NAMES,
    replyTo: 'support@ghumakkars.in',
  });
}
