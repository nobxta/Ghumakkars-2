import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertTriangle, CloudRain, XCircle, Clock, Gavel } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy | Ghumakkars',
  description: 'Read the Ghumakkars cancellation and refund policy covering participant cancellations, trip cancellations, weather conditions and refund processing.',
  alternates: { canonical: '/cancellation-policy' },
};

export default function CancellationPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
            Cancellation & Refund Policy
          </h1>
          <p className="text-sm text-gray-500">Last Updated: June 2026</p>
          <p className="mt-5 text-base text-gray-700 leading-relaxed">
            At Ghumakkars, we invest significant resources in transportation, accommodation, permits,
            guides and other trip arrangements well in advance. Cancellations and refunds are therefore
            governed by the policy below.
          </p>
        </header>

        <div className="space-y-8 text-gray-800">
          <Section icon={<AlertTriangle className="h-5 w-5 text-purple-700" />} title="1. Participant Cancellation">
            <p>
              As a general policy, bookings made with Ghumakkars are{' '}
              <strong>non-refundable and non-transferable</strong>.
            </p>
            <p className="mt-3">
              Refund requests will only be considered under exceptional circumstances where the traveler
              provides valid and verifiable supporting documents, including but not limited to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li>Serious medical emergencies</li>
              <li>Hospitalization</li>
              <li>Death of an immediate family member</li>
              <li>Government-imposed travel restrictions affecting the traveler</li>
              <li>Other genuine emergencies approved by the Ghumakkars team</li>
            </ul>
            <p className="mt-3">
              Ghumakkars reserves the sole right to approve or reject any refund request after reviewing
              the submitted evidence. Submission of documents does not guarantee approval of a refund.
            </p>
          </Section>

          <Section icon={<Shield className="h-5 w-5 text-purple-700" />} title="2. Trip Cancellation by Ghumakkars">
            <p>
              In rare situations, Ghumakkars may cancel a trip due to circumstances beyond our reasonable
              control, including but not limited to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li>Natural disasters</li>
              <li>Landslides</li>
              <li>Floods</li>
              <li>Earthquakes</li>
              <li>Political unrest</li>
              <li>Government restrictions</li>
              <li>Safety concerns</li>
              <li>Insufficient participant count</li>
              <li>Transportation disruptions</li>
            </ul>
            <p className="mt-3">
              Where a trip is cancelled by Ghumakkars, affected travelers may be offered one of the
              following, at Ghumakkars&rsquo; discretion:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li>Full refund of the amount paid</li>
              <li>Partial refund after deduction of non-recoverable costs already incurred</li>
              <li>Credit voucher for a future trip</li>
              <li>Rescheduling to an alternative departure date</li>
            </ul>
          </Section>

          <Section icon={<CloudRain className="h-5 w-5 text-purple-700" />} title="3. Weather Conditions">
            <p>
              Trips generally operate in <strong>all weather conditions</strong> unless authorities,
              local administrations, transportation providers or safety experts advise otherwise.
            </p>
            <p className="mt-3">
              Unfavorable weather such as rain, snowfall, fog, storms, road closures or other natural
              events does <strong>not</strong> automatically qualify for cancellation, refund,
              compensation or reimbursement.
            </p>
            <p className="mt-3">
              Any decision regarding trip continuation, modification, postponement or cancellation shall
              be made solely based on traveler safety and operational feasibility.
            </p>
          </Section>

          <Section icon={<XCircle className="h-5 w-5 text-purple-700" />} title="4. No Refund for Unused Services">
            <p>No refund shall be provided for:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li>Missed departures</li>
              <li>Late arrivals</li>
              <li>Early departure from the trip</li>
              <li>Voluntary withdrawal from activities</li>
              <li>Unused hotel stays</li>
              <li>Unused meals</li>
              <li>Unused transportation</li>
              <li>Any service not utilized by the traveler</li>
            </ul>
          </Section>

          <Section icon={<Clock className="h-5 w-5 text-purple-700" />} title="5. Processing of Approved Refunds">
            <p>
              If a refund is approved, processing may take between <strong>7 to 15 business days</strong>
              {' '}depending on the payment method, banking partner and payment gateway.
            </p>
          </Section>

          <Section icon={<Gavel className="h-5 w-5 text-purple-700" />} title="6. Final Decision">
            <p>
              All refund and cancellation decisions made by Ghumakkars shall be{' '}
              <strong>final and binding</strong>.
            </p>
            <p className="mt-3">
              By booking any trip through Ghumakkars, the traveler acknowledges and agrees to this
              Cancellation &amp; Refund Policy.
            </p>
          </Section>
        </div>

        <div className="mt-12 p-5 rounded-2xl bg-purple-50 border border-purple-200">
          <p className="text-sm text-gray-700">
            Need to talk to us about a refund request? Reach out at{' '}
            <a href="mailto:support@ghumakkars.in" className="text-purple-700 font-semibold underline">
              support@ghumakkars.in
            </a>
            {' '}with your booking ID and supporting documents.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="text-sm sm:text-base text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}
