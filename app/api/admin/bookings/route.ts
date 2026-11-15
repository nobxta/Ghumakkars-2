import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';
import { moneyOf } from '@/lib/booking-money';
import { isPartnerBooking, partnerMoneyOf } from '@/lib/partner-money';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const adminClient = createAdminClient();
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(`
        *,
        trips (
          title,
          destination,
          duration_days,
          start_date,
          end_date,
          is_recurring,
          discounted_price,
          cover_image_url,
          image_url,
          payment_due_days_before,
          whatsapp_group_link
        ),
        payment_transactions (
          id,
          transaction_id,
          amount,
          amount_refunded,
          payment_type,
          payment_status,
          payment_mode,
          payment_method,
          payment_reviewed_at,
          payment_reviewed_by,
          payment_review_notes,
          rejection_reason,
          paid_at,
          manual_payment_snapshot,
          collected_by,
          created_at
        ),
        partner:partners ( id, name, phone, contact_name, upi_id, default_price_basis, default_price_rate ),
        booking_addons (
          id, trip_addon_id, name, description, icon_key, category, pricing_method, unit_price,
          selected_passenger_ids, selected_passenger_names, quantity, room_occupancy, room_count,
          chargeable_units, addon_total, is_refundable, status, payment_status,
          cancellation_reason, cancelled_at, created_at
        )
      `)
      .order('created_at', { ascending: false });

    // Fetch profiles separately for each booking
    if (bookings && bookings.length > 0) {
      const userIds = Array.from(new Set(bookings.map(b => b.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('id, first_name, last_name, email, phone, referral_code, referred_by')
          .in('id', userIds);

        // Map profiles to bookings
        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          bookings.forEach((booking: any) => {
            booking.profiles = profileMap.get(booking.user_id) || null;
          });
        }

        const { data: referrals } = await adminClient
          .from('referrals')
          .select('id, referrer_id, referred_user_id, referral_code, reward_amount, reward_status, first_booking_id, credited_at, created_at, referrer_name, referrer_email, referred_user_name, referred_user_email')
          .in('referred_user_id', userIds);

        if (referrals && referrals.length > 0) {
          const referrerIds = Array.from(new Set(referrals.map((r: any) => r.referrer_id).filter(Boolean)));
          let referrerMap = new Map<string, any>();
          if (referrerIds.length > 0) {
            const { data: referrerProfiles } = await adminClient
              .from('profiles')
              .select('id, first_name, last_name, email, phone, referral_code')
              .in('id', referrerIds);
            referrerMap = new Map((referrerProfiles || []).map((p: any) => [p.id, p]));
          }

          const referralMap = new Map<string, any>();
          referrals.forEach((referral: any) => {
            referral.referrer_profile = referrerMap.get(referral.referrer_id) || null;
            referralMap.set(referral.referred_user_id, referral);
          });

          bookings.forEach((booking: any) => {
            booking.referral = referralMap.get(booking.user_id) || null;
          });
        }
      }
    }

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: bookingsError.message || 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    const rows = bookings || [];

    // Settlements recorded against partner bookings (admin-only table).
    const partnerBookingIds = rows.filter((b: any) => isPartnerBooking(b)).map((b: any) => b.id);
    const settlementsByBooking = new Map<string, any[]>();
    if (partnerBookingIds.length > 0) {
      const { data: settlements } = await adminClient
        .from('partner_settlements')
        .select('id, partner_id, booking_id, direction, amount, method, reference, notes, settled_on, created_at')
        .in('booking_id', partnerBookingIds)
        .order('settled_on', { ascending: true });
      for (const st of settlements || []) {
        const list = settlementsByBooking.get(st.booking_id) || [];
        list.push(st);
        settlementsByBooking.set(st.booking_id, list);
      }
    }
    rows.forEach((b: any) => {
      b.partner_settlements = settlementsByBooking.get(b.id) || [];
    });
    const isActive = (booking: any) =>
      !['cancelled', 'rejected', 'referred'].includes(String(booking.booking_status)) && !isPartnerBooking(booking);
    const activeRows = rows.filter(isActive);
    const summary = rows.reduce((acc: any, booking: any) => {
      const money = moneyOf(booking as any, (booking as any).trips);
      const active = isActive(booking);
      if (active) {
        acc.collected += money.paid;
        acc.outstanding += money.remaining;
      }
      const status = String(booking.booking_status || 'pending');
      acc.byBookingStatus[status] = (acc.byBookingStatus[status] || 0) + 1;
      const needsReview =
        (booking.payment_transactions || []).some((p: any) => p.payment_status === 'pending') ||
        (booking.payment_mode === 'cash' && ['cash_pending', 'pending_cash'].includes(String(booking.payment_status)));
      if (needsReview) acc.needsReview += 1;
      // Partner bookings: our margin + who owes whom. (The customer "refer a
      // friend" reward in booking.referral is a different thing — not counted here.)
      if (isPartnerBooking(booking)) {
        const pm = partnerMoneyOf(booking, booking.trips, booking.partner_settlements);
        acc.referralCommission.total += pm.margin;
        acc.referralCommission.count += 1;
        if (pm.balance < 0) acc.referralCommission.theyOwe += -pm.balance;
        if (pm.balance > 0) acc.referralCommission.weOwe += pm.balance;
      }
      return acc;
    }, {
      collected: 0,
      outstanding: 0,
      needsReview: 0,
      totalBookings: rows.length,
      activeBookings: activeRows.length,
      byBookingStatus: {},
      referralCommission: {
        total: 0,
        count: 0,
        theyOwe: 0,
        weOwe: 0,
      },
    });

    return NextResponse.json({ bookings: rows, summary });
  } catch (error: any) {
    console.error('Error in admin bookings API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
