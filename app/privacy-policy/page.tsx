import type { Metadata } from 'next';
import { LegalPolicyPage, LEGAL_LAST_UPDATED_ISO } from '@/components/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Ghumakkars covering information collected, booking data, payments, cookies, analytics, third-party services, retention, rights and Indian law compliance.',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Privacy Policy | Ghumakkars',
    description: 'How Ghumakkars collects, uses, protects and shares traveller and booking information.',
    url: '/privacy-policy',
    type: 'article',
    modifiedTime: LEGAL_LAST_UPDATED_ISO,
  },
};

export default function PrivacyPolicyPage() {
  return <LegalPolicyPage type="privacy" />;
}
