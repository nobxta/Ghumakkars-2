import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = params;
    const adminClient = createAdminClient();

    // Fetch trip
    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Fetch bookings with related data
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select(`
        *,
        payment_transactions (
          id,
          amount,
          payment_status,
          created_at
        )
      `)
      .eq('trip_id', id)
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
    }

    // Fetch user profiles for bookings
    let users: any[] = [];
    if (bookings && bookings.length > 0) {
      const userIds = [...new Set(bookings.map((b: any) => b.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('id, first_name, last_name, email, phone')
          .in('id', userIds);

        if (profiles) {
          users = profiles;
          
          // Map profiles to bookings
          const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
          bookings.forEach((booking: any) => {
            booking.profiles = profileMap.get(booking.user_id) || null;
          });
        }
      }
    }

    // Calculate metrics
    const confirmedBookings = bookings?.filter((b: any) => b.booking_status === 'confirmed') || [];
    const pendingBookings = bookings?.filter((b: any) => 
      b.booking_status === 'pending' || b.booking_status === 'seat_locked'
    ) || [];

    const verifiedPayments = bookings?.flatMap((booking: any) => 
      booking.payment_transactions?.filter((pt: any) => pt.payment_status === 'verified') || []
    ) || [];

    const totalRevenue = verifiedPayments.reduce((sum: number, pt: any) => 
      sum + parseFloat(String(pt.amount || 0)), 0
    );

    const totalParticipants = bookings?.reduce((sum: number, b: any) => 
      sum + (parseInt(String(b.number_of_participants || 1))), 0
    ) || 0;

    const averageBookingValue = confirmedBookings.length > 0
      ? totalRevenue / confirmedBookings.length
      : 0;

    const metrics = {
      totalRevenue,
      totalBookings: bookings?.length || 0,
      confirmedBookings: confirmedBookings.length,
      pendingBookings: pendingBookings.length,
      totalParticipants,
      averageBookingValue,
    };

    return NextResponse.json({
      trip,
      bookings: bookings || [],
      metrics,
      users,
    });
  } catch (error: any) {
    console.error('Error fetching trip details:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const adminClient = createAdminClient();

    // Check if trip has bookings
    const { data: bookings, error: bookingsError } = await adminClient
      .from('bookings')
      .select('id')
      .eq('trip_id', id)
      .limit(1);

    if (bookingsError) {
      console.error('Error checking bookings:', bookingsError);
    }

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete trip with existing bookings. Cancel the trip instead.' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('trips')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting trip:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting trip:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
