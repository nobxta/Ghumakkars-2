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
      .select('payment_qr_url, payment_upi_id, payment_mode')
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

    return NextResponse.json({
      qrUrl: data?.payment_qr_url || null,
      upiId: data?.payment_upi_id || null,
      paymentMode: data?.payment_mode || 'manual',
    });
  } catch (error: any) {
    console.error('Error in payment settings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

