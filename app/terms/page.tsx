import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, UserCheck, CreditCard, Map, AlertTriangle, Shield, Scale, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Ghumakkars',
  description: 'The terms and conditions governing your use of Ghumakkars and bookings made through the platform.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Terms &amp; Conditions</h1>
          <p className="text-sm text-gray-500">Last Updated: June 2026</p>
          <p className="mt-5 text-base text-gray-700 leading-relaxed">
            These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the Ghumakkars website,
            mobile experience and trip booking services (the &quot;Platform&quot;). By booking a trip or using the
            Platform you agree to these Terms.
          </p>
        </header>

        <div className="space-y-8 text-gray-800">
          <Section icon={<UserCheck className="h-5 w-5 text-purple-700" />} title="1. Eligibility & Account">
            <p>
              You must be 18 years or older (or have written consent from a legal guardian) to book a trip
              with Ghumakkars. You agree to provide accurate, current and complete information at the time
              of booking, including a valid Aadhaar or government ID for verification.
            </p>
            <p className="mt-3">
              You are responsible for safeguarding your account credentials and for all activity that
              occurs under your account.
            </p>
          </Section>

          <Section icon={<CreditCard className="h-5 w-5 text-purple-700" />} title="2. Bookings & Payments">
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>All prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise.</li>
              <li>Payments are processed via Razorpay. Ghumakkars does not store your card or banking details.</li>
              <li>A seat is confirmed only after the applicable amount (full payment or seat-lock amount) is successfully received.</li>
              <li>Early bird pricing, discounts and offers are valid only until the conditions mentioned on the trip page are met.</li>
              <li>Ghumakkars reserves the right to refuse, cancel or modify any booking in case of suspected fraud, misuse or violation of these Terms.</li>
            </ul>
          </Section>

          <Section icon={<Map className="h-5 w-5 text-purple-700" />} title="3. What's Included & Excluded">
            <p>
              Inclusions and exclusions for each trip are listed on the respective trip detail page. In the
              event of any conflict between marketing material and the trip detail page, the{' '}
              <strong>trip detail page</strong> shall prevail.
            </p>
            <p className="mt-3">
              Personal expenses, additional activities not listed in inclusions, travel insurance, and any
              cost arising from delays, diversions, illness or personal preference are the traveler&rsquo;s
              responsibility.
            </p>
          </Section>

          <Section icon={<AlertTriangle className="h-5 w-5 text-purple-700" />} title="4. Traveler Conduct & Responsibilities">
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>Travelers must follow the instructions of trip leaders, guides and drivers at all times.</li>
              <li>Consumption of alcohol, drugs or illegal substances during the trip is strictly prohibited unless explicitly permitted.</li>
              <li>Travelers must respect local culture, environment, fellow travelers and Ghumakkars staff.</li>
              <li>Ghumakkars reserves the right to remove any traveler from a trip without refund if their conduct endangers safety, disrupts the group or violates the law.</li>
              <li>Travelers are personally responsible for any damage caused to property, vehicles or accommodation during the trip.</li>
            </ul>
          </Section>

          <Section icon={<Shield className="h-5 w-5 text-purple-700" />} title="5. Cancellations & Refunds">
            <p>
              Cancellations and refunds are governed by our{' '}
              <Link href="/cancellation-policy" className="text-purple-700 font-semibold underline">
                Cancellation &amp; Refund Policy
              </Link>
              . By booking a trip you acknowledge and accept that policy.
            </p>
          </Section>

          <Section icon={<AlertTriangle className="h-5 w-5 text-purple-700" />} title="6. Itinerary Changes & Force Majeure">
            <p>
              Travel involves uncertainty. Itineraries may change due to weather, road conditions, permits,
              government restrictions, natural disasters or other events beyond Ghumakkars&rsquo; reasonable
              control. Ghumakkars will make commercially reasonable efforts to provide an equivalent
              experience but is not liable for losses arising from such changes.
            </p>
          </Section>

          <Section icon={<Scale className="h-5 w-5 text-purple-700" />} title="7. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Ghumakkars, its founders, employees and partners shall
              not be liable for any indirect, incidental, special or consequential damages arising out of or
              relating to your use of the Platform or participation in any trip.
            </p>
            <p className="mt-3">
              Ghumakkars&rsquo; total liability for any direct claim shall not exceed the amount actually paid
              by the traveler for the specific booking in question.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5 text-purple-700" />} title="8. Intellectual Property">
            <p>
              All content on the Platform, including text, photographs, logos, itineraries and design, is
              the property of Ghumakkars or its licensors and is protected by applicable copyright and
              trademark laws. You may not reproduce, distribute or use any content for commercial purposes
              without written permission.
            </p>
            <p className="mt-3">
              By submitting photos, reviews or testimonials, you grant Ghumakkars a non-exclusive,
              royalty-free, worldwide license to use that content for promotional purposes.
            </p>
          </Section>

          <Section icon={<Shield className="h-5 w-5 text-purple-700" />} title="9. Privacy">
            <p>
              Your personal data is handled in accordance with our{' '}
              <Link href="/privacy" className="text-purple-700 font-semibold underline">Privacy Policy</Link>.
            </p>
          </Section>

          <Section icon={<Scale className="h-5 w-5 text-purple-700" />} title="10. Governing Law & Disputes">
            <p>
              These Terms shall be governed by the laws of India. Any dispute arising out of or in connection
              with these Terms shall be subject to the exclusive jurisdiction of the courts at Mathura,
              Uttar Pradesh.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5 text-purple-700" />} title="11. Changes to These Terms">
            <p>
              Ghumakkars may revise these Terms from time to time. The updated version will be posted on
              this page with a new &ldquo;Last Updated&rdquo; date. Continued use of the Platform after changes
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section icon={<Mail className="h-5 w-5 text-purple-700" />} title="12. Contact">
            <p>
              For any questions about these Terms, write to us at{' '}
              <a href="mailto:support@ghumakkars.in" className="text-purple-700 font-semibold underline">
                support@ghumakkars.in
              </a>
              {' '}or visit our{' '}
              <Link href="/contact" className="text-purple-700 font-semibold underline">Contact page</Link>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">{icon}</div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="text-sm sm:text-base text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}
