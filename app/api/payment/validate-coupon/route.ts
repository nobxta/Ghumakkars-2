import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCoupon } from '@/lib/coupons';
import { withErrorLog } from '@/lib/error-log';

export const runtime = "nodejs";

async function handlePOST(request: NextRequest) {
  try {
    const { code, amount, tripId } = await request.json();

    if (!code || !amount) {
      return NextResponse.json(
        { error: 'Coupon code and amount are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Always check against the signed-in user — never a userId from the body,
    // which would let someone test coupons restricted to another account.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User must be authenticated' },
        { status: 401 }
      );
    }

    const result = await checkCoupon(supabase, { code, amount: Number(amount), tripId, userId: user.id });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { coupon } = result;
    const discountAmount = result.discountAmount || 0;
    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        description: coupon.description,
      },
      discount_amount: discountAmount,
      final_amount: Number(amount) - discountAmount,
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}

export const POST = withErrorLog('payment', 'Validate coupon', handlePOST, { log4xx: false });
