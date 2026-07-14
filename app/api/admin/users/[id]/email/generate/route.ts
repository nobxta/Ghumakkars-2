import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { checkRateLimit } from '@/lib/rate-limit';
import { isAllowedAdminSender } from '@/lib/email';

export const runtime = 'nodejs';

const LENGTH_LIMITS = {
  short: { label: 'Short', maxTokens: 300, words: '50-90 words' },
  standard: { label: 'Standard', maxTokens: 600, words: '100-180 words' },
  detailed: { label: 'Detailed', maxTokens: 1000, words: '200-350 words' },
} as const;

function cleanString(value: unknown, max = 4000) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, max);
}

function parseDraft(content: string) {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    subject: cleanString(parsed.subject, 140),
    body: cleanString(parsed.body, 12000),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const rate = checkRateLimit(request, `admin-email-ai:${auth.user.id}`, 20);
    if (rate.ok === false) {
      return NextResponse.json({ error: 'Rate limited. Please try again shortly.', retryAfter: rate.retryAfter }, { status: 429 });
    }

    if (!process.env.NVIDIA_API_KEY) {
      return NextResponse.json({ error: 'AI email generation is not configured' }, { status: 503 });
    }

    const body = await request.json();
    const instruction = cleanString(body.instruction, 1200);
    const length = (body.length || 'standard') as keyof typeof LENGTH_LIMITS;
    const senderEmail = cleanString(body.senderEmail, 120);
    const senderName = cleanString(body.senderName, 80);
    const existingSubject = cleanString(body.existingSubject, 140);
    const existingBody = cleanString(body.existingBody, 8000);
    const transform = cleanString(body.transform, 80);

    if (!instruction && !transform) {
      return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });
    }
    if (!LENGTH_LIMITS[length]) {
      return NextResponse.json({ error: 'Invalid email length' }, { status: 400 });
    }
    if (!isAllowedAdminSender(senderEmail)) {
      return NextResponse.json({ error: 'Sender address is not allowed' }, { status: 400 });
    }
    if (/[\r\n]/.test(senderName)) {
      return NextResponse.json({ error: 'Invalid sender name' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, full_name, first_name, last_name')
      .eq('id', params.id)
      .single();

    if (profileError || !profile?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: bookings } = await admin
      .from('bookings')
      .select('booking_status, final_amount, total_price, amount_paid, created_at, trips(title, destination, start_date)')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const userName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Customer';
    const bookingFacts = (bookings || []).map((booking: any) => ({
      tripName: booking.trips?.title || null,
      destination: booking.trips?.destination || null,
      tripDate: booking.trips?.start_date || null,
      bookingStatus: booking.booking_status || null,
      bookingAmount: booking.final_amount || booking.total_price || null,
      paidAmount: booking.amount_paid || null,
    }));

    const nvidia = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });

    const completion = await nvidia.chat.completions.create({
      model: 'z-ai/glm-5.2',
      temperature: 0.45,
      max_tokens: LENGTH_LIMITS[length].maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You write customer emails for Ghumakkars, an Indian travel company. Write natural, professional and conversational emails that sound like they were written specifically for the recipient. Use plain language and short paragraphs. Do not use robotic filler, exaggerated politeness, em dashes, fake urgency or invented details. Preserve every supplied name, date, amount and booking fact exactly. Return only a JSON object with subject and body string fields. Do not include markdown fences.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: transform ? `Revise the existing draft: ${transform}` : 'Write a new customer email',
            adminInstruction: instruction,
            outputLength: `${LENGTH_LIMITS[length].label}, approximately ${LENGTH_LIMITS[length].words}`,
            sender: { name: senderName, email: senderEmail },
            customer: { firstName: profile.first_name || null, fullName: userName },
            bookingFacts,
            existingDraft: transform ? { subject: existingSubject, body: existingBody } : undefined,
            constraints: [
              'Do not invent facts, IDs, timelines, policies, payment details, or refund details.',
              'If critical information is missing, ask the admin to add it instead of fabricating it.',
              'No em dashes.',
              'The admin will review and edit before sending.',
            ],
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'AI did not return a draft' }, { status: 502 });
    }

    const draft = parseDraft(content);
    if (!draft.subject || !draft.body) {
      return NextResponse.json({ error: 'AI returned an incomplete draft' }, { status: 502 });
    }

    return NextResponse.json(draft);
  } catch (error: any) {
    console.error('Admin email generation failed:', error?.message || error);
    return NextResponse.json({ error: 'Email draft could not be generated' }, { status: 500 });
  }
}
