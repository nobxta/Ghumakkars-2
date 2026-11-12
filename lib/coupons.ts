import type { SupabaseClient } from '@supabase/supabase-js';

// (Not a discriminated union: this project's tsconfig doesn't narrow on `ok`.)
export type CouponCheck = {
  ok: boolean;
  coupon?: any;
  discountAmount?: number;
  error?: string;
  status?: number;
};

/**
 * Single source of truth for "can this user use this coupon on this trip for
 * this amount, and how much is it worth?". Used by the coupon box
 * (/api/payment/validate-coupon) AND by booking creation, so skipping the
 * coupon box can't bypass any rule.
 */
export async function checkCoupon(
  client: SupabaseClient,
  opts: { code: string; amount: number; tripId?: string | null; userId?: string | null },
): Promise<CouponCheck> {
  const code = String(opts.code || '').toUpperCase().trim();
  const amount = Number(opts.amount) || 0;
  if (!code) return { ok: false, error: 'Coupon code is required', status: 400 };

  const { data: coupon, error: couponError } = await client
    .from('coupon_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (couponError || !coupon) {
    return { ok: false, error: 'Invalid or expired coupon code', status: 404 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (coupon.start_date) {
    const startDate = new Date(coupon.start_date);
    startDate.setHours(0, 0, 0, 0);
    if (today < startDate) {
      return { ok: false, error: `This coupon is not yet valid. Valid from ${startDate.toLocaleDateString()}`, status: 400 };
    }
  }

  if (coupon.expiry_date) {
    const expiryDate = new Date(coupon.expiry_date);
    expiryDate.setHours(23, 59, 59, 999);
    if (today > expiryDate) {
      return { ok: false, error: 'This coupon has expired', status: 400 };
    }
  }

  if (Array.isArray(coupon.trip_ids) && coupon.trip_ids.length > 0) {
    if (!opts.tripId || !coupon.trip_ids.includes(opts.tripId)) {
      return { ok: false, error: 'This coupon is not valid for this trip', status: 400 };
    }
  }

  if (Array.isArray(coupon.user_ids) && coupon.user_ids.length > 0) {
    if (!opts.userId || !coupon.user_ids.includes(opts.userId)) {
      return { ok: false, error: 'This coupon is not valid for your account', status: 400 };
    }
  }

  if (coupon.is_early_bird && coupon.early_bird_days_before && opts.tripId) {
    const { data: trip } = await client.from('trips').select('start_date').eq('id', opts.tripId).maybeSingle();
    if (trip?.start_date) {
      const daysUntilTrip = Math.ceil((new Date(trip.start_date).getTime() - today.getTime()) / 86400000);
      if (daysUntilTrip < coupon.early_bird_days_before) {
        return {
          ok: false,
          error: `This early bird coupon must be used at least ${coupon.early_bird_days_before} days before the trip start date`,
          status: 400,
        };
      }
    }
  }

  if (coupon.per_user_limit && opts.userId) {
    const { count, error: usageError } = await client
      .from('coupon_usages')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', opts.userId);
    if (!usageError && (count || 0) >= coupon.per_user_limit) {
      return {
        ok: false,
        error: `You have already used this coupon ${coupon.per_user_limit} time(s). Maximum usage limit reached.`,
        status: 400,
      };
    }
  }

  if (coupon.usage_limit && (coupon.used_count || 0) >= coupon.usage_limit) {
    return { ok: false, error: 'This coupon has reached its total usage limit', status: 400 };
  }

  if (coupon.min_amount && amount < coupon.min_amount) {
    return { ok: false, error: `Minimum booking amount of ₹${coupon.min_amount} required to use this coupon`, status: 400 };
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = (amount * coupon.discount_value) / 100;
    if (coupon.max_discount && discountAmount > coupon.max_discount) discountAmount = coupon.max_discount;
  } else if (coupon.discount_type === 'fixed') {
    discountAmount = Math.min(Number(coupon.discount_value) || 0, amount);
  }

  if (coupon.max_total_discount) {
    const remaining = coupon.max_total_discount - parseFloat(String(coupon.total_discount_given || 0));
    if (remaining <= 0) {
      return { ok: false, error: 'This coupon has reached its maximum total discount limit', status: 400 };
    }
    if (discountAmount > remaining) discountAmount = remaining;
  }

  return { ok: true, coupon, discountAmount };
}
