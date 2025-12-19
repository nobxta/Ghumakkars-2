import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { code, amount, tripId, userId } = await request.json();

    if (!code || !amount) {
      return NextResponse.json(
        { error: 'Coupon code and amount are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'User must be authenticated' },
          { status: 401 }
        );
      }
    }

    const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id;

    // Check if coupon exists and is active
    const { data: coupon, error: couponError } = await supabase
      .from('coupon_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      return NextResponse.json(
        { error: 'Invalid or expired coupon code' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check start date
    if (coupon.start_date) {
      const startDate = new Date(coupon.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) {
        return NextResponse.json(
          { error: `This coupon is not yet valid. Valid from ${startDate.toLocaleDateString()}` },
          { status: 400 }
        );
      }
    }

    // Check expiry date
    if (coupon.expiry_date) {
      const expiryDate = new Date(coupon.expiry_date);
      expiryDate.setHours(23, 59, 59, 999);
      if (today > expiryDate) {
        return NextResponse.json(
          { error: 'This coupon has expired' },
          { status: 400 }
        );
      }
    }

    // Check trip-specific restrictions
    if (coupon.trip_ids && Array.isArray(coupon.trip_ids) && coupon.trip_ids.length > 0) {
      if (!tripId || !coupon.trip_ids.includes(tripId)) {
        return NextResponse.json(
          { error: 'This coupon is not valid for this trip' },
          { status: 400 }
        );
      }
    }

    // Check user-specific restrictions
    if (coupon.user_ids && Array.isArray(coupon.user_ids) && coupon.user_ids.length > 0) {
      if (!currentUserId || !coupon.user_ids.includes(currentUserId)) {
        return NextResponse.json(
          { error: 'This coupon is not valid for your account' },
          { status: 400 }
        );
      }
    }

    // Check early bird restrictions
    if (coupon.is_early_bird && coupon.early_bird_days_before && tripId) {
      const { data: trip } = await supabase
        .from('trips')
        .select('start_date')
        .eq('id', tripId)
        .single();

      if (trip && trip.start_date) {
        const tripStartDate = new Date(trip.start_date);
        const daysUntilTrip = Math.ceil((tripStartDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilTrip < coupon.early_bird_days_before) {
          return NextResponse.json(
            { error: `This early bird coupon must be used at least ${coupon.early_bird_days_before} days before the trip start date` },
            { status: 400 }
          );
        }
      }
    }

    // Check per-user usage limit
    if (coupon.per_user_limit && currentUserId) {
      const { data: userUsages, error: usageError } = await supabase
        .from('coupon_usages')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', currentUserId);

      if (!usageError && userUsages && userUsages.length >= coupon.per_user_limit) {
        return NextResponse.json(
          { error: `You have already used this coupon ${coupon.per_user_limit} time(s). Maximum usage limit reached.` },
          { status: 400 }
        );
      }
    }

    // Check total usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return NextResponse.json(
        { error: 'This coupon has reached its total usage limit' },
        { status: 400 }
      );
    }

    // Check minimum amount
    if (coupon.min_amount && amount < coupon.min_amount) {
      return NextResponse.json(
        { error: `Minimum booking amount of ₹${coupon.min_amount} required to use this coupon` },
        { status: 400 }
      );
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (amount * coupon.discount_value) / 100;
      if (coupon.max_discount && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = coupon.discount_value;
      if (discountAmount > amount) {
        discountAmount = amount; // Can't discount more than the total
      }
    }

    // Check maximum total discount limit
    if (coupon.max_total_discount) {
      const totalDiscountGiven = parseFloat(String(coupon.total_discount_given || 0));
      const remainingDiscount = coupon.max_total_discount - totalDiscountGiven;
      
      if (remainingDiscount <= 0) {
        return NextResponse.json(
          { error: 'This coupon has reached its maximum total discount limit' },
          { status: 400 }
        );
      }

      // If calculated discount exceeds remaining discount, cap it
      if (discountAmount > remainingDiscount) {
        discountAmount = remainingDiscount;
      }
    }

    const finalAmount = amount - discountAmount;

    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        description: coupon.description,
      },
      discount_amount: discountAmount,
      final_amount: finalAmount,
    });
  } catch (error: any) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}

