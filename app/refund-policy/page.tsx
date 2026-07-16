import type { Metadata } from 'next';
import { LegalPolicyPage, LEGAL_LAST_UPDATED_ISO } from '@/components/LegalPolicyPage';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description:
    'Refund and Cancellation Policy for Ghumakkars travel bookings covering seat-lock amounts, cancellation charges, PhonePe/UPI refund timelines, no-shows, partial usage and company cancellations.',
  alternates: { canonical: '/refund-policy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Refund & Cancellation Policy | Ghumakkars',
    description: 'Cancellation charges, non-refundable seat-lock terms and PhonePe/UPI refund timelines for Ghumakkars trips.',
    url: '/refund-policy',
    type: 'article',
    modifiedTime: LEGAL_LAST_UPDATED_ISO,
  },
};

export default function RefundPolicyPage() {
  return <LegalPolicyPage type="refund" />;
}
