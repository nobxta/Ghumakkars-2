import type { Metadata } from 'next';
import { LegalPolicyPage, LEGAL_LAST_UPDATED_ISO } from '@/components/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Terms & Conditions for Ghumakkars covering travel booking rules, digital booking delivery, PhonePe/UPI payments, pricing, traveller responsibilities, liability and Indian law.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Terms & Conditions | Ghumakkars',
    description: 'Website and travel booking terms for Ghumakkars, including digital confirmation delivery and PhonePe/UPI payment terms.',
    url: '/terms',
    type: 'article',
    modifiedTime: LEGAL_LAST_UPDATED_ISO,
  },
};

export default function TermsPage() {
  return <LegalPolicyPage type="terms" />;
}
