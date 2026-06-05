import type { Metadata } from 'next';
import Hero from '@/components/Hero';
import Trips from '@/components/Trips';
import Features from '@/components/Features';
import FAQ from '@/components/FAQ';
import Stats from '@/components/Stats';
import Testimonials from '@/components/Testimonials';
import About from '@/components/About';
import Newsletter from '@/components/Newsletter';
import CTA from '@/components/CTA';

export const metadata: Metadata = {
  title: 'Ghumakkars - Budget Group Travel Across India | Explore India',
  description:
    'Book curated budget-friendly group trips across India. Manali, Goa, Rishikesh, Kashmir & more. Seat-lock booking, referral rewards, honest prices. Start your adventure today!',
  alternates: { canonical: '/' },
};

export default function Home() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Ghumakkars?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ghumakkars is a budget travel platform that organises curated group trips across India. We take you to places like Manali, Goa, Rishikesh, Kashmir, and more — all at prices that actually make sense.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much do Ghumakkars trips cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our trips start from ₹2,999. We negotiate group rates and pass the savings directly to you. Lock your seat with a small deposit and pay the rest before departure.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is seat lock booking?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Seat lock lets you reserve your spot by paying a small deposit (usually 20-30% of the trip cost). You pay the remaining amount before the trip departure date.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the referral program work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Share your referral code with friends. When they sign up and complete their first booking, you earn ₹100 and your friend earns ₹50 as wallet credit — use it on your next trip!',
        },
      },
      {
        '@type': 'Question',
        name: 'Which destinations does Ghumakkars cover?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We cover popular destinations across India including Manali, Goa, Rishikesh, Kashmir, Meghalaya, Ladakh, Kerala, and many more. New trips are added regularly.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who can join Ghumakkars trips?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Not at all! Our trips are open to everyone — solo travellers, couples, friend groups, families. If you love exploring new places without overpaying, you will fit right in.',
        },
      },
    ],
  };

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ghumakkars',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@ghumakkars.in',
      contactType: 'customer support',
    },
  };

  return (
    <div className="pt-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <Hero />
      <Stats />
      <Trips />
      <Features />
      <FAQ />
      <Testimonials />
      <About />
      <Newsletter />
      <CTA />
    </div>
  );
}
