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
  title: 'Ghumakkars - Premium Budget Travel for Students | Explore India',
  description:
    'Book curated budget-friendly trips across India. Manali, Goa, Rishikesh, Kashmir & more. Exclusive student pricing, seat-lock booking, referral rewards. Start your adventure today!',
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
          text: 'Ghumakkars is a premium budget travel platform designed exclusively for university students in India. We offer curated, affordable group trips to destinations like Manali, Goa, Rishikesh, Kashmir, and more.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much do Ghumakkars trips cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our trips are budget-friendly, starting from ₹2,999. We negotiate group rates and pass the savings to students. You can also lock your seat with a small deposit and pay the rest later.',
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
          text: 'Share your unique referral code with friends. When they sign up and complete their first booking, you earn ₹100 and your friend earns ₹50 as wallet credit. Use it on your next trip!',
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
        name: 'Is Ghumakkars only for students?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'While our trips are designed and priced for university students, anyone who loves budget travel and group adventures is welcome to join!',
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
