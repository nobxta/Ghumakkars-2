import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCouponEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin access
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const userId = params.id;
    const { discountAmount, expiryDate, description } = await request.json();

    if (!discountAmount || isNaN(parseFloat(discountAmount))) {
      return NextResponse.json({ error: 'Invalid discount amount' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch user profile
    const { data: userProfile, error: userError } = await adminClient
      .from('profiles')
      .select('email, full_name, first_name')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate unique coupon code
    const generateCouponCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let couponCode = generateCouponCode();
    let attempts = 0;
    let isUnique = false;

    // Ensure unique coupon code
    while (!isUnique && attempts < 10) {
      const { data: existing } = await adminClient
        .from('coupon_codes')
        .select('id')
        .eq('code', couponCode)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        couponCode = generateCouponCode();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to generate unique coupon code' }, { status: 500 });
    }

    // Create coupon
    const couponData: any = {
      code: couponCode,
      discount_type: 'fixed',
      discount_value: parseFloat(discountAmount),
      min_amount: 0,
      usage_limit: 1, // Single use coupon
      used_count: 0,
      is_active: true,
      description: description || `Special discount for ${userProfile.full_name || userProfile.first_name || 'user'}`,
      created_by: user.id,
    };

    if (expiryDate) {
      couponData.expiry_date = expiryDate;
    }

    const { data: coupon, error: couponError } = await adminClient
      .from('coupon_codes')
      .insert(couponData)
      .select()
      .single();

    if (couponError) {
      console.error('Error creating coupon:', couponError);
      return NextResponse.json(
        { error: couponError.message || 'Failed to create coupon' },
        { status: 500 }
      );
    }

    // Log the activity
    await adminClient
      .from('admin_activity_log')
      .insert({
        user_id: userId,
        admin_id: user.id,
        action_type: 'coupon_generated',
        action_description: `Generated coupon code "${coupon.code}" with ₹${discountAmount} discount${expiryDate ? ` (valid till ${new Date(expiryDate).toLocaleDateString()})` : ''}`,
        metadata: {
          coupon_code: coupon.code,
          discount_amount: parseFloat(discountAmount),
          expiry_date: expiryDate,
          description: description
        }
      });

    // Send email
    try {
      await sendCouponEmail(
        userProfile.email,
        userProfile.full_name || userProfile.first_name || 'User',
        {
          couponCode: coupon.code,
          discountAmount: parseFloat(discountAmount),
          expiryDate: expiryDate || null,
          description: description || 'Special discount on your next booking',
        }
      );

      return NextResponse.json({ 
        success: true,
        coupon: coupon,
        message: 'Coupon generated and email sent successfully'
      });
    } catch (emailError: any) {
      console.error('Error sending coupon email:', emailError);
      // Coupon was created, but email failed - still return success with warning
      return NextResponse.json({ 
        success: true,
        coupon: coupon,
        warning: 'Coupon created but email failed to send: ' + emailError.message
      });
    }
  } catch (error: any) {
    console.error('Error generating coupon:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

