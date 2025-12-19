import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    
    // Fetch the latest payment settings
    const { data, error } = await adminClient
      .from('payment_settings')
      .select('payment_qr_url, payment_upi_id')
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
    });
  } catch (error: any) {
    console.error('Error in payment settings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

