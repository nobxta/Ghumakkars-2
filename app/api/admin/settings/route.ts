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
  const [{ data: general }, { data: payment }] = await Promise.all([
    admin.from('admin_general_settings').select('*').eq('id', 1).single(),
    admin
      .from('payment_settings')
      .select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, updated_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  return NextResponse.json({
    general: general || {
      email_notifications: true,
      booking_alerts: true,
      weekly_reports: false,
      maintenance_mode: false,
      updated_at: null,
    },
    payment: {
      payment_mode: payment?.payment_mode || 'manual',
      referral_reward_amount: Number(payment?.referral_reward_amount ?? 100),
      referral_friend_reward_amount: Number(payment?.referral_friend_reward_amount ?? 50),
      seat_lock_due_days_before: Number(payment?.seat_lock_due_days_before ?? 5),
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

  if (section === 'general') {
    const updates = {
      email_notifications: !!body.email_notifications,
      booking_alerts: !!body.booking_alerts,
      weekly_reports: !!body.weekly_reports,
      maintenance_mode: !!body.maintenance_mode,
      updated_by: auth.user.id,
    };
    const { data, error } = await admin
      .from('admin_general_settings')
      .update(updates)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, general: data });
  }

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
    const payload = {
      payment_mode: mode,
      referral_reward_amount: referrer,
      referral_friend_reward_amount: friend,
      seat_lock_due_days_before: dueDays,
      razorpay_key_id: null,
      razorpay_key_secret: null,
      razorpay_webhook_secret: null,
      updated_by: auth.user.id,
    };
    const query = existing?.id
      ? admin.from('payment_settings').update(payload).eq('id', existing.id).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, updated_at').single()
      : admin.from('payment_settings').insert([payload]).select('id, payment_mode, referral_reward_amount, referral_friend_reward_amount, seat_lock_due_days_before, updated_at').single();
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, payment: { ...data, razorpay: razorpayStatus() } });
  }

  return NextResponse.json({ error: 'Unknown settings section.' }, { status: 400 });
}
