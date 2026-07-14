import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import { isAllowedAdminSender, sendAdminComposedEmail } from '@/lib/email';

export const runtime = 'nodejs';

const sentKeys = new Map<string, { messageId?: string; sentAt: number }>();

function cleanHeader(value: unknown, max: number) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim().slice(0, max);
}

function cleanBody(value: unknown) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, 12000);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const rate = checkRateLimit(request, `admin-email-send:${auth.user.id}`, 30);
    if (rate.ok === false) {
      return NextResponse.json({ error: 'Rate limited. Please try again shortly.', retryAfter: rate.retryAfter }, { status: 429 });
    }

    const body = await request.json();
    const fromEmail = cleanHeader(body.senderEmail, 120);
    const fromName = cleanHeader(body.senderName, 80);
    const subject = cleanHeader(body.subject, 140);
    const message = cleanBody(body.message);
    const idempotencyKey = cleanHeader(body.idempotencyKey || request.headers.get('idempotency-key'), 120);

    if (idempotencyKey && sentKeys.has(idempotencyKey)) {
      return NextResponse.json({ success: true, duplicate: true, messageId: sentKeys.get(idempotencyKey)?.messageId });
    }
    if (!isAllowedAdminSender(fromEmail)) {
      return NextResponse.json({ error: 'Sender address is not allowed' }, { status: 400 });
    }
    if (!fromName || /[\r\n]/.test(fromName)) {
      return NextResponse.json({ error: 'Invalid sender name' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!message || message.length > 12000) {
      return NextResponse.json({ error: 'Message is required and must be under 12000 characters' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, first_name, last_name')
      .eq('id', params.id)
      .single();

    if (profileError || !profile?.email || !isEmail(profile.email)) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    const result = await sendAdminComposedEmail({
      to: profile.email,
      fromEmail,
      fromName,
      subject,
      text: message,
      replyTo: fromEmail === 'no-reply@ghumakkars.in' ? 'support@ghumakkars.in' : fromEmail,
    });

    if (idempotencyKey) {
      sentKeys.set(idempotencyKey, { messageId: result.messageId, sentAt: Date.now() });
    }

    await admin
      .from('admin_activity_log')
      .insert({
        user_id: params.id,
        admin_id: auth.user.id,
        action_type: 'email_sent',
        action_description: `Sent email "${subject}" to ${profile.email}`,
        metadata: {
          recipient: profile.email,
          sender_address: fromEmail,
          sender_name: fromName,
          subject,
          provider_message_id: result.messageId || null,
          send_status: 'sent',
        },
      });

    return NextResponse.json({ success: true, messageId: result.messageId, recipient: profile.email });
  } catch (error: any) {
    console.error('Admin email send failed:', error?.message || error);
    return NextResponse.json({ error: 'Email could not be sent. Your draft has been preserved.' }, { status: 500 });
  }
}
