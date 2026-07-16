import type { Metadata } from 'next';
import { LegalPolicyPage, LEGAL_LAST_UPDATED_ISO } from '@/components/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description:
    'Refund and Cancellation Policy for Ghumakkars travel bookings covering seat-lock amounts, timing-based cancellation charges, no-shows, partial usage, company cancellations and payment gateway timelines.',
  alternates: { canonical: '/refund-policy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Refund & Cancellation Policy | Ghumakkars',
    description: 'Cancellation charges, non-refundable seat-lock terms and refund timelines for Ghumakkars trips.',
    url: '/refund-policy',
    type: 'article',
    modifiedTime: LEGAL_LAST_UPDATED_ISO,
  },
};

export default function RefundPolicyPage() {
  return <LegalPolicyPage type="refund" />;
}
