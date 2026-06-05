import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Trips - Budget Group Trips Across India',
  description:
    'Browse all available student trips — Manali, Goa, Rishikesh, Kashmir, Meghalaya & more. Filter by destination, price, dates. Book with seat-lock option. Starting from ₹2,999.',
  keywords: [
    'group trips India',
    'budget travel packages',
    'budget group tours',
    'Manali group trip',
    'Goa budget trip',
    'Rishikesh adventure trip',
  ],
  alternates: { canonical: '/trips' },
  openGraph: {
    title: 'Explore Budget Trips Across India | Ghumakkars',
    description: 'Budget-friendly curated group trips. Manali, Goa, Rishikesh & more.',
  },
};

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
