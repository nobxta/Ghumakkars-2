import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

const PAYMENT_MODES = new Set(['manual', 'razorpay', 'both']);

function razorpayStatus() {
  const hasKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const hasWebhook = !!process.env.RAZORPAY_WEBHOOK_SECRET;
  return {
    configured: hasKeys,
    webhookConfigured: hasWebhook,
    status: hasKeys ? (hasWebhook ? 'configured' : 'webhook_not_configured') : 'missing_configuration',
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payment_settings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    payment: {
      payment_mode: payment?.payment_mode || 'manual',
      referral_reward_amount: Number(payment?.referral_reward_amount ?? 100),
      referral_friend_reward_amount: Number(payment?.referral_friend_reward_amount ?? 50),
      seat_lock_due_days_before: Number(payment?.seat_lock_due_days_before ?? 5),
      allow_cash_payment: payment?.allow_cash_payment !== false,
      updated_at: payment?.updated_at || null,
      razorpay: razorpayStatus(),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const section = String(body.section || '');
  const admin = createAdminClient();

  if (section === 'payment') {
    const mode = String(body.payment_mode || 'manual');
    if (!PAYMENT_MODES.has(mode)) {
      return NextResponse.json({ error: 'Invalid payment mode.' }, { status: 400 });
    }
    const dueDays = Number(body.seat_lock_due_days_before);
    const referrer = Number(body.referral_reward_amount);
    const friend = Number(body.referral_friend_reward_amount);
    if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 60) {
      return NextResponse.json({ error: 'Seat-lock deadline must be between 0 and 60 days before departure.' }, { status: 400 });
    }
    if (!Number.isFinite(referrer) || referrer < 0 || !Number.isFinite(friend) || friend < 0) {
      return NextResponse.json({ error: 'Referral rewards cannot be negative.' }, { status: 400 });
    }
    const { data: existing } = await admin.from('payment_settings').select('id').order('created_at', { ascending: false }).limit(1).single();
    const allowCashPayment = body.allow_cash_payment !== undefined ? !!body.allow_cash_payment : true;
    const payload: Record<string, any> = {
      payment_mode: mode,
      referral_reward_amount: referrer,
      referral_friend_reward_amount: friend,
      seat_lock_due_days_before: dueDays,
      allow_cash_payment: allowCashPayment,
      razorpay_key_id: null,
      razorpay_key_secret: null,
      razorpay_webhook_secret: null,
      updated_by: auth.user.id,
    };
    let { data, error } = existing?.id
      ? await admin.from('payment_settings').update(payload).eq('id', existing.id).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, allow_cash_payment, updated_at').single()
      : await admin.from('payment_settings').insert([payload]).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, allow_cash_payment, updated_at').single();

    // Fallback: If migration hasn't been run yet in DB
    if (error && (error.message?.includes('allow_cash_payment') || error.code === '42703')) {
      delete payload.allow_cash_payment;
      const retry = existing?.id
        ? await admin.from('payment_settings').update(payload).eq('id', existing.id).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, updated_at').single()
        : await admin.from('payment_settings').insert([payload]).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, updated_at').single();
      data = retry.data ? { ...retry.data, allow_cash_payment: allowCashPayment } : null;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, payment: { ...data, allow_cash_payment: data?.allow_cash_payment ?? allowCashPayment, razorpay: razorpayStatus() } });
  }

  return NextResponse.json({ error: 'Unknown settings section.' }, { status: 400 });
}
