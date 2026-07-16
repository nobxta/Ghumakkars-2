import type { Metadata } from 'next';
import { LegalPolicyPage, LEGAL_LAST_UPDATED_ISO } from '@/components/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Terms & Conditions for Ghumakkars covering eligibility, booking rules, pricing, payments, traveller responsibilities, trip changes, liability and Indian law.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Terms & Conditions | Ghumakkars',
    description: 'Booking terms and website terms for Ghumakkars travellers.',
    url: '/terms',
    type: 'article',
    modifiedTime: LEGAL_LAST_UPDATED_ISO,
  },
};

export default function TermsPage() {
  return <LegalPolicyPage type="terms" />;
}
