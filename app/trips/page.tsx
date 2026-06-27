import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import TripsBrowser from './TripsBrowser';

// ISR: the public trips list is the same for everyone, so render it on the
// server and revalidate every 10 minutes instead of fetching client-side on
// every visit. This removes the client data waterfall (HTML now arrives with
// trips already in it) and makes the page feel instant.
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Upcoming Group Trips Across India',
  description:
    'Browse upcoming budget group trips across India — Manali, Goa, Rishikesh, Kashmir and more. Lock your seat with a small deposit and pay the rest before departure.',
  alternates: { canonical: '/trips' },
};

const TRIP_COLUMNS =
  'id,slug,title,short_description,description,destination,original_price,discounted_price,discount_percentage,duration_days,duration_text,max_participants,current_participants,start_date,end_date,image_url,cover_image_url,included_features,highlights,is_active,status,completed_at,postponed_to_date,booking_deadline_date,seat_lock_price,early_bird_price,booking_disabled,created_at,updated_at';

const PAST_STATUSES = ['completed', 'cancelled', 'postponed'];

export default async function TripsPage() {
  const supabase = createPublicClient();

  // Fetch active and past trips in parallel — no sequential waterfall.
  const [activeRes, pastRes] = await Promise.all([
    supabase
      .from('trips')
      .select(TRIP_COLUMNS)
      .or('is_active.eq.true,status.eq.active,status.eq.scheduled')
      .order('created_at', { ascending: false }),
    supabase
      .from('trips')
      .select(TRIP_COLUMNS)
      .in('status', PAST_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  const activeData = (activeRes.data || []) as any[];
  const pastData = (pastRes.data || []) as any[];

  const pastIds = new Set(pastData.map((t) => t.id));
  // Ensure completed/cancelled/postponed never show under Available.
  const availableOnly = activeData.filter(
    (t) => !PAST_STATUSES.includes(t.status || '') && !pastIds.has(t.id)
  );

  return (
    <div className="min-h-screen pt-16 pb-8 bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Section */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 tracking-tight">
            Upcoming Trips
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            Pick a date, pay or lock your seat, show up. We&apos;ll handle the rest.
          </p>
        </div>

        <TripsBrowser trips={availableOnly} completedTrips={pastData} />
      </div>
    </div>
  );
}
