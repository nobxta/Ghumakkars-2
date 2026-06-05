import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Trips - Budget Student Trips Across India',
  description:
    'Browse all available student trips — Manali, Goa, Rishikesh, Kashmir, Meghalaya & more. Filter by destination, price, dates. Book with seat-lock option. Starting from ₹2,999.',
  keywords: [
    'student trips India',
    'budget travel packages',
    'college group tours',
    'Manali trip for students',
    'Goa student package',
    'Rishikesh adventure trip',
  ],
  alternates: { canonical: '/trips' },
  openGraph: {
    title: 'Explore Student Trips Across India | Ghumakkars',
    description: 'Budget-friendly curated trips for university students. Manali, Goa, Rishikesh & more.',
  },
};

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
