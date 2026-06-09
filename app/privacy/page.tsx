import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Database, Lock, Share2, Cookie, UserCog, Baby, Mail, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ghumakkars',
  description: 'How Ghumakkars collects, uses, stores and protects your personal data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last Updated: June 2026</p>
          <p className="mt-5 text-base text-gray-700 leading-relaxed">
            This Privacy Policy explains how Ghumakkars (&quot;we&quot;, &quot;us&quot;) collects, uses, stores and protects
            your personal information when you use the Ghumakkars website and trip booking services.
          </p>
        </header>

        <div className="space-y-8 text-gray-800">
          <Section icon={<Database className="h-5 w-5 text-purple-700" />} title="1. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li><strong>Account data:</strong> name, email, phone, password (hashed), profile photo.</li>
              <li><strong>Booking & traveler data:</strong> passenger names, age, gender, emergency contact, Aadhaar / government ID details required for verification and travel permits.</li>
              <li><strong>Payment data:</strong> transaction reference, amount, status (processed via Razorpay — we do not store card or bank account numbers).</li>
              <li><strong>Communication data:</strong> messages you send to support, feedback and reviews.</li>
              <li><strong>Technical data:</strong> IP address, device info, browser type, pages visited, referral source.</li>
            </ul>
          </Section>

          <Section icon={<UserCog className="h-5 w-5 text-purple-700" />} title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>To confirm bookings, issue tickets and coordinate logistics.</li>
              <li>To verify identity and comply with travel permit requirements.</li>
              <li>To process payments and refunds.</li>
              <li>To send booking confirmations, trip reminders and important updates via email, SMS or WhatsApp.</li>
              <li>To respond to support queries and resolve complaints.</li>
              <li>To improve the Platform, prevent fraud and ensure security.</li>
              <li>To send marketing communications about upcoming trips — only if you have opted in (you can opt out anytime).</li>
            </ul>
          </Section>

          <Section icon={<Share2 className="h-5 w-5 text-purple-700" />} title="3. Sharing of Information">
            <p>We share your information only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li><strong>Trip partners</strong> (hotels, transporters, guides) — only what is strictly required to deliver your trip.</li>
              <li><strong>Payment gateway</strong> (Razorpay) — for processing transactions.</li>
              <li><strong>Service providers</strong> (email/SMS providers, analytics, cloud hosting) — bound by confidentiality.</li>
              <li><strong>Government authorities</strong> — when required by law, court order or for safety investigations.</li>
            </ul>
            <p className="mt-3">
              We <strong>do not sell</strong> your personal data to advertisers or third parties.
            </p>
          </Section>

          <Section icon={<Lock className="h-5 w-5 text-purple-700" />} title="4. Data Security">
            <p>
              We use industry-standard safeguards including HTTPS encryption, hashed passwords, role-based
              access control and audit logging. Data is stored on secure Supabase infrastructure. While we
              follow reasonable security practices, no method of transmission over the internet is 100%
              secure.
            </p>
          </Section>

          <Section icon={<Database className="h-5 w-5 text-purple-700" />} title="5. Data Retention">
            <p>
              We retain personal data for as long as your account is active or as needed to provide services,
              comply with legal obligations, resolve disputes and enforce our agreements. You may request
              deletion of your account and associated data at any time.
            </p>
          </Section>

          <Section icon={<UserCog className="h-5 w-5 text-purple-700" />} title="6. Your Rights">
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate or incomplete information.</li>
              <li>Request deletion of your account and data (subject to legal retention requirements).</li>
              <li>Withdraw consent for marketing communications.</li>
              <li>Restrict or object to certain processing activities.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, write to{' '}
              <a href="mailto:support@ghumakkars.in" className="text-purple-700 font-semibold underline">
                support@ghumakkars.in
              </a>
              .
            </p>
          </Section>

          <Section icon={<Cookie className="h-5 w-5 text-purple-700" />} title="7. Cookies & Analytics">
            <p>
              We use cookies and similar technologies for authentication, session management, analytics and
              improving the Platform. You can disable cookies in your browser, but some features may not
              work properly without them.
            </p>
          </Section>

          <Section icon={<Baby className="h-5 w-5 text-purple-700" />} title="8. Children's Privacy">
            <p>
              The Platform is not directed at individuals under 18. We do not knowingly collect personal
              data from children. If you believe a minor has provided us with personal data, contact us so
              we can remove it.
            </p>
          </Section>

          <Section icon={<FileText className="h-5 w-5 text-purple-700" />} title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. The updated version will be posted on
              this page with a new &ldquo;Last Updated&rdquo; date. Continued use of the Platform after changes
              constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section icon={<Mail className="h-5 w-5 text-purple-700" />} title="10. Contact Us">
            <p>
              For privacy-related questions, contact us at{' '}
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
