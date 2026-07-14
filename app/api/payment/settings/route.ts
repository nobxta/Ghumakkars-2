import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-helpers';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const adminClient = createAdminClient();
    
    // Fetch the latest payment settings
    const { data, error } = await adminClient
      .from('payment_settings')
      .select('payment_qr_url, payment_upi_id, payment_mode, seat_lock_due_days_before')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching payment settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment settings' },
        { status: 500 }
      );
    }

    const { data: methods, error: methodsError } = await adminClient
      .from('manual_payment_methods')
      .select('id, nickname, upi_id, payee_name, qr_image_url, instructions, is_default, display_order')
      .eq('is_enabled', true)
      .order('is_default', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (methodsError && methodsError.code !== '42P01') {
      console.error('Error fetching manual payment methods:', methodsError);
    }

    const fallbackMethod = data?.payment_upi_id
      ? [{
          id: 'legacy',
          nickname: 'Primary UPI',
          upi_id: data.payment_upi_id,
          payee_name: 'Ghumakkars',
          qr_image_url: data.payment_qr_url,
          instructions: null,
          is_default: true,
          display_order: 0,
        }]
      : [];
    const manualMethods = methods && methods.length > 0 ? methods : fallbackMethod;
    const configuredMode = data?.payment_mode || 'manual';
    const paymentMode = configuredMode === 'both'
      ? 'both'
      : configuredMode === 'razorpay'
        ? 'razorpay'
        : manualMethods.length > 0
          ? 'manual'
          : 'razorpay';

    return NextResponse.json({
      qrUrl: data?.payment_qr_url || null,
      upiId: data?.payment_upi_id || null,
      paymentMode,
      dueDaysBefore: data?.seat_lock_due_days_before ?? 5,
      manualMethods,
    });
  } catch (error: any) {
    console.error('Error in payment settings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
