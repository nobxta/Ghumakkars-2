import type React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Cookie,
  CreditCard,
  Database,
  FileText,
  Gavel,
  Lock,
  Mail,
  Map,
  RefreshCw,
  Scale,
  Shield,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { CONTACT } from '@/lib/contact';
import { getSiteUrl } from '@/lib/site-url';

export const LEGAL_LAST_UPDATED = '16 July 2026';
export const LEGAL_LAST_UPDATED_ISO = '2026-07-16';

type PolicyKey = 'privacy' | 'terms' | 'refund';

type Section = {
  title: string;
  icon: React.ReactNode;
  body: React.ReactNode;
};

const sectionShell =
  'bg-white/95 border border-purple-100 rounded-xl shadow-sm p-5 sm:p-6 scroll-mt-24';

const paragraph = 'text-sm sm:text-base text-slate-700 leading-relaxed';
const list = 'list-disc pl-5 mt-3 space-y-2 text-sm sm:text-base text-slate-700 leading-relaxed';

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">
      {children}
    </Link>
  );
}

function EmailLink({ email = CONTACT.supportEmail }: { email?: string }) {
  return (
    <a href={`mailto:${email}`} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">
      {email}
    </a>
  );
}

const iconClass = 'h-5 w-5 text-purple-700';

const policyContent: Record<PolicyKey, {
  title: string;
  eyebrow: string;
  description: string;
  canonicalPath: string;
  jsonLdType: string;
  sections: Section[];
}> = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Data protection and traveller privacy',
    canonicalPath: '/privacy-policy',
    jsonLdType: 'PrivacyPolicy',
    description:
      'This Privacy Policy explains how Ghumakkars collects, uses, stores, protects and shares information when you visit www.ghumakkars.in, create an account, contact us or book a trip.',
    sections: [
      {
        title: '1. Information we collect',
        icon: <Database className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>We collect only the information needed to operate the website, manage travel bookings, provide customer support, process payments and meet legal or safety requirements.</p>
            <ul className={list}>
              <li><strong>Account and contact information:</strong> name, email address, mobile number, password credentials, profile details and communication preferences.</li>
              <li><strong>Booking details:</strong> selected trip, destination, departure date, pickup point, number of travellers, passenger names, age, gender, emergency contact and information required for trip coordination.</li>
              <li><strong>Identity or permit details:</strong> government ID details may be requested where required by hotels, transport providers, local authorities, permits or safety protocols.</li>
              <li><strong>Payment information:</strong> payment amount, payment mode, transaction ID, order ID, refund status and payment confirmation details. Card, UPI PIN, net-banking password and wallet credentials are processed by the payment provider and are not stored by Ghumakkars.</li>
              <li><strong>Support information:</strong> emails, WhatsApp messages, call details, feedback, complaints, refund requests and supporting documents you submit.</li>
              <li><strong>Device and analytics data:</strong> IP address, browser, operating system, device type, pages visited, referring URL, approximate location, session information and usage events.</li>
              <li><strong>Cookies and similar technologies:</strong> cookies, pixels and local storage used for login sessions, security, preferences, analytics and website performance.</li>
            </ul>
          </>
        ),
      },
      {
        title: '2. Purpose of collection',
        icon: <UserCog className={iconClass} />,
        body: (
          <ul className={list}>
            <li>To create and manage your account.</li>
            <li>To confirm bookings, lock seats, issue confirmations and coordinate transport, stays, guides and trip leaders.</li>
            <li>To process payments, verify transactions, prevent fraud and manage approved refunds.</li>
            <li>To send important booking updates, payment reminders, itinerary changes, safety alerts and customer support responses by email, phone, SMS or WhatsApp.</li>
            <li>To comply with applicable Indian laws, tax, accounting, audit, safety and travel-related obligations.</li>
            <li>To improve website performance, trip offerings, customer experience, security and fraud prevention.</li>
            <li>To send promotional updates about trips or offers where permitted by law or where you have not opted out.</li>
          </ul>
        ),
      },
      {
        title: '3. Payments and third-party services',
        icon: <CreditCard className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>Ghumakkars uses trusted third-party services to operate bookings and payments. These providers process data under their own policies and applicable law.</p>
            <ul className={list}>
              <li><strong>Razorpay:</strong> used for online payment collection, payment verification, settlement and eligible payment-gateway refunds.</li>
              <li><strong>UPI apps including PhonePe:</strong> where manual UPI or deep-link UPI payment is offered, the selected UPI application processes the payment inside its own secure environment.</li>
              <li><strong>Google Analytics and Vercel Analytics:</strong> may be used to understand website performance, traffic and user journeys.</li>
              <li><strong>Meta Pixel:</strong> may be used only if enabled for advertising measurement or campaign attribution.</li>
              <li><strong>Email, messaging, hosting and database providers:</strong> used for notifications, support, website hosting, storage and operational security.</li>
              <li><strong>Travel partners:</strong> hotels, transporters, guides, vendors and local coordinators receive only the details reasonably required to deliver your trip.</li>
            </ul>
          </>
        ),
      },
      {
        title: '4. Cookies',
        icon: <Cookie className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>Cookies help the website remember sessions, protect forms, measure performance and improve user experience. You can control cookies through your browser settings. Blocking cookies may affect login, booking and payment flows.</p>
          </>
        ),
      },
      {
        title: '5. Data sharing',
        icon: <Shield className={iconClass} />,
        body: (
          <ul className={list}>
            <li>We do not sell your personal information.</li>
            <li>We share information with service providers only where needed for bookings, payments, support, analytics, security, legal compliance or trip delivery.</li>
            <li>We may disclose information to courts, regulators, law enforcement or government authorities where required by law or to protect travellers, staff, property or legal rights.</li>
          </ul>
        ),
      },
      {
        title: '6. Data retention',
        icon: <Clock className={iconClass} />,
        body: (
          <p className={paragraph}>We retain personal information for as long as needed to provide services, maintain booking and payment records, resolve disputes, enforce policies, meet tax, accounting and legal obligations, and prevent fraud. Support documents that are no longer required are deleted or restricted where reasonably possible, subject to legal retention needs.</p>
        ),
      },
      {
        title: '7. User rights',
        icon: <UserCheck className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>Subject to applicable law, you may request access, correction, updating, deletion, withdrawal of consent, grievance redressal or restriction of certain processing activities.</p>
            <p className={`${paragraph} mt-3`}>To exercise these rights, write to <EmailLink /> with enough detail to identify your account or booking. Some records may need to be retained where required for legal, tax, safety, fraud-prevention or dispute-resolution purposes.</p>
          </>
        ),
      },
      {
        title: '8. Security practices',
        icon: <Lock className={iconClass} />,
        body: (
          <p className={paragraph}>We use reasonable security practices including HTTPS, restricted admin access, server-side payment verification, role-based controls, audit trails where available and secure infrastructure providers. No internet transmission or storage system can be guaranteed to be completely secure, but we work to protect information against unauthorized access, misuse, loss and alteration.</p>
        ),
      },
      {
        title: '9. Indian law compliance',
        icon: <Scale className={iconClass} />,
        body: (
          <p className={paragraph}>This policy is intended to align with applicable Indian laws, including the Information Technology Act, 2000, relevant rules made under it, and the Digital Personal Data Protection Act, 2023 to the extent applicable and in force. By using the website or booking with Ghumakkars, you consent to processing of your information in India for the purposes described in this policy.</p>
        ),
      },
      {
        title: '10. Contact details',
        icon: <Mail className={iconClass} />,
        body: (
          <div className="space-y-2">
            <p className={paragraph}>For privacy questions, data requests or grievances, contact Ghumakkars at:</p>
            <p className={paragraph}><strong>Email:</strong> <EmailLink /></p>
            <p className={paragraph}><strong>Phone/WhatsApp:</strong> <a href={CONTACT.whatsappLink} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">{CONTACT.phoneDisplay}</a></p>
            <p className={paragraph}><strong>Location:</strong> {CONTACT.address}</p>
          </div>
        ),
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    eyebrow: 'Website use and booking terms',
    canonicalPath: '/terms',
    jsonLdType: 'WebPage',
    description:
      'These Terms & Conditions govern your use of the Ghumakkars website and all trip bookings made with Ghumakkars.',
    sections: [
      {
        title: '1. Acceptance of terms',
        icon: <FileText className={iconClass} />,
        body: (
          <p className={paragraph}>By accessing www.ghumakkars.in, creating an account, contacting us, making a payment or booking a trip, you agree to these Terms & Conditions, the <TextLink href="/privacy-policy">Privacy Policy</TextLink> and the <TextLink href="/refund-policy">Refund & Cancellation Policy</TextLink>. If you do not agree, do not use the website or complete a booking.</p>
        ),
      },
      {
        title: '2. Eligibility',
        icon: <UserCheck className={iconClass} />,
        body: (
          <ul className={list}>
            <li>You must be at least 18 years old to make a booking in your own name.</li>
            <li>Minors may travel only with a parent, legal guardian or with consent and documents accepted by Ghumakkars for the specific trip.</li>
            <li>You must provide accurate account, passenger, contact, identity and payment information.</li>
            <li>Ghumakkars may refuse or cancel a booking if information is incomplete, false, suspicious or unsafe for the trip.</li>
          </ul>
        ),
      },
      {
        title: '3. Services and digital delivery',
        icon: <Map className={iconClass} />,
        body: (
          <ul className={list}>
            <li>Ghumakkars provides travel booking services, group trip packages, itinerary coordination, transport and stay coordination, and optional trip add-ons.</li>
            <li>No physical product is shipped by Ghumakkars. Booking confirmations, payment confirmations, trip details, tickets, invoices or support updates are delivered digitally by website dashboard, email, WhatsApp, SMS, phone or PDF where applicable.</li>
            <li>A booking confirmation is normally generated after successful payment verification. Manual UPI or offline payments may require additional review before the booking is marked as confirmed.</li>
            <li>Actual travel service delivery happens on the trip departure date and itinerary dates shown on the relevant trip page or booking confirmation.</li>
          </ul>
        ),
      },
      {
        title: '4. Booking rules',
        icon: <Map className={iconClass} />,
        body: (
          <ul className={list}>
            <li>A booking is confirmed only after the required payment is successfully received and verified by Ghumakkars.</li>
            <li>For seat-lock bookings, the seat-lock amount reserves the seat and the remaining amount must be paid by the due date shown during booking or communicated by Ghumakkars. The standard due date is 5 days before departure unless another date is communicated.</li>
            <li>Trip inclusions, exclusions, itinerary, pickup points, departure dates, package price, seat-lock amount and add-ons are governed by the relevant trip page and booking confirmation.</li>
            <li>Travellers must carry valid ID and any documents required by hotels, transporters, local authorities or permit rules.</li>
            <li>Ghumakkars may cancel unpaid, partially paid, duplicate, suspicious or policy-violating bookings.</li>
          </ul>
        ),
      },
      {
        title: '5. Pricing, offers and payments',
        icon: <CreditCard className={iconClass} />,
        body: (
          <ul className={list}>
            <li>Prices are listed in Indian Rupees unless stated otherwise.</li>
            <li>Prices may change based on season, availability, early-bird offers, add-ons, coupons, pickup location or operational costs.</li>
            <li>A price is locked only after successful payment and booking confirmation.</li>
            <li>Payments may be collected through PhonePe, Razorpay, UPI, wallet balance, manual payment review or other methods enabled by Ghumakkars.</li>
            <li>Online payments are subject to successful authorization, capture and verification by the relevant payment gateway, bank, card network, UPI system or wallet provider.</li>
            <li>Payment gateway charges, bank charges or convenience fees, if shown during checkout, may be non-refundable unless required by law or the gateway's rules.</li>
          </ul>
        ),
      },
      {
        title: '6. Traveller responsibilities',
        icon: <Shield className={iconClass} />,
        body: (
          <ul className={list}>
            <li>Follow instructions from trip leaders, guides, drivers, hotel staff and local authorities.</li>
            <li>Arrive on time for pickups, departures, check-ins and activities.</li>
            <li>Respect fellow travellers, staff, local communities, property, culture, wildlife and the environment.</li>
            <li>Do not carry illegal items or engage in fighting, harassment, abuse, unsafe conduct, public nuisance or illegal activity.</li>
            <li>Consumption or possession of alcohol, drugs or illegal substances may result in refusal of boarding, removal from the trip and cancellation without refund where safety, law or group discipline is affected.</li>
            <li>You are responsible for personal belongings, fitness for travel, medication, insurance and expenses not included in the package.</li>
          </ul>
        ),
      },
      {
        title: '7. Trip modifications',
        icon: <RefreshCw className={iconClass} />,
        body: (
          <p className={paragraph}>Travel operations can change due to weather, road conditions, landslides, traffic, vehicle issues, permits, hotel availability, local restrictions, government orders or safety concerns. Ghumakkars may modify routes, stay arrangements, transport, pickup points, activity order or itinerary timing while making reasonable efforts to preserve the overall trip experience.</p>
        ),
      },
      {
        title: '8. Force majeure',
        icon: <AlertTriangle className={iconClass} />,
        body: (
          <p className={paragraph}>Ghumakkars is not liable for delay, modification, interruption or cancellation caused by events beyond reasonable control, including natural disasters, extreme weather, landslides, road closures, epidemics, strikes, political unrest, war, terrorism, government restrictions, transport disruption, supplier failure or safety emergencies. Refunds or credits in such cases are governed by the <TextLink href="/refund-policy">Refund & Cancellation Policy</TextLink>.</p>
        ),
      },
      {
        title: '9. Intellectual property',
        icon: <FileText className={iconClass} />,
        body: (
          <p className={paragraph}>The Ghumakkars name, website design, text, photographs, videos, itineraries, graphics, logos and other content are owned by Ghumakkars or licensed to Ghumakkars. You may not copy, reproduce, sell, scrape, redistribute or commercially use website content without written permission. By submitting reviews, photos or testimonials, you allow Ghumakkars to use them for service, marketing and promotional purposes, unless you withdraw permission in writing where legally available.</p>
        ),
      },
      {
        title: '10. Limitation of liability',
        icon: <Scale className={iconClass} />,
        body: (
          <p className={paragraph}>To the maximum extent permitted by law, Ghumakkars is not liable for indirect, incidental, special, punitive or consequential losses, loss of enjoyment, loss of opportunity, personal expenses, missed connections, personal injury caused by your negligence or third-party acts, or loss of belongings. For any proven direct claim, Ghumakkars' aggregate liability is limited to the amount paid by you to Ghumakkars for the specific booking giving rise to the claim.</p>
        ),
      },
      {
        title: '11. Governing law and dispute resolution',
        icon: <Gavel className={iconClass} />,
        body: (
          <p className={paragraph}>These Terms are governed by the laws of India. The parties will first try to resolve disputes through good-faith communication by email or phone. If unresolved, disputes will be subject to the exclusive jurisdiction of competent courts at Mathura, Uttar Pradesh, India, unless applicable law requires another forum.</p>
        ),
      },
      {
        title: '12. Contact',
        icon: <Mail className={iconClass} />,
        body: (
          <p className={paragraph}>For questions about these Terms, contact <EmailLink /> or call/WhatsApp <a href={CONTACT.whatsappLink} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">{CONTACT.phoneDisplay}</a>.</p>
        ),
      },
    ],
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    eyebrow: 'Travel booking cancellations and refunds',
    canonicalPath: '/refund-policy',
    jsonLdType: 'WebPage',
    description:
      'This Refund & Cancellation Policy applies to Ghumakkars travel bookings, seat-lock payments, full payments, no-shows, partial usage and company cancellations.',
    sections: [
      {
        title: '1. Scope',
        icon: <FileText className={iconClass} />,
        body: (
          <p className={paragraph}>This policy applies to all travel bookings made with Ghumakkars through www.ghumakkars.in, WhatsApp, phone, manual UPI, PhonePe, Razorpay or any other payment method accepted by Ghumakkars. Ghumakkars sells travel booking services, group trip packages and related trip add-ons. No physical product is shipped; booking confirmations and trip details are delivered digitally by email, WhatsApp, website dashboard or phone support.</p>
        ),
      },
      {
        title: '2. Seat-lock amount',
        icon: <Lock className={iconClass} />,
        body: (
          <p className={paragraph}>Where a seat-lock option is available, the seat booking amount is <strong>non-refundable once the seat is confirmed</strong>. The seat-lock amount is used to reserve inventory, transport, stay or operational capacity. If the remaining amount is not paid by the due date, Ghumakkars may release the seat and the seat-lock amount will not be refunded.</p>
        ),
      },
      {
        title: '3. Traveller cancellation charges',
        icon: <Clock className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>Cancellation charges are calculated from the scheduled trip departure date and apply after deducting any non-refundable seat-lock amount, payment gateway fee, bank charge and non-recoverable vendor cost.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-purple-50 text-slate-900">
                  <tr>
                    <th className="px-4 py-3 font-bold">Cancellation timing</th>
                    <th className="px-4 py-3 font-bold">Cancellation charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  <tr><td className="px-4 py-3">30 days or more before departure</td><td className="px-4 py-3">25% of eligible trip amount</td></tr>
                  <tr><td className="px-4 py-3">15 to 29 days before departure</td><td className="px-4 py-3">50% of eligible trip amount</td></tr>
                  <tr><td className="px-4 py-3">7 to 14 days before departure</td><td className="px-4 py-3">75% of eligible trip amount</td></tr>
                  <tr><td className="px-4 py-3">Less than 7 days before departure</td><td className="px-4 py-3">100% of eligible trip amount</td></tr>
                </tbody>
              </table>
            </div>
            <p className={`${paragraph} mt-3`}>The eligible trip amount means the amount actually paid by the traveller after discounts and wallet use, excluding the non-refundable seat-lock amount and any non-recoverable costs already committed to suppliers.</p>
          </>
        ),
      },
      {
        title: '4. How to request cancellation',
        icon: <Mail className={iconClass} />,
        body: (
          <p className={paragraph}>Cancellation requests must be sent to <EmailLink /> from the registered email address or by contacting the official Ghumakkars WhatsApp number <a href={CONTACT.whatsappLink} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">{CONTACT.phoneDisplay}</a>. The request must include booking ID, traveller name, trip name, departure date and reason for cancellation. The cancellation time is recorded when Ghumakkars receives enough information to identify the booking.</p>
        ),
      },
      {
        title: '5. Refund processing timeline',
        icon: <RefreshCw className={iconClass} />,
        body: (
          <>
            <p className={paragraph}>Eligible refunds are initiated by Ghumakkars within <strong>5 to 7 working days</strong> after the cancellation request is accepted and payment records are verified. Refunds are made to the original payment source wherever supported by the payment gateway.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-purple-50 text-slate-900">
                  <tr>
                    <th className="px-4 py-3 font-bold">Payment mode</th>
                    <th className="px-4 py-3 font-bold">Expected credit timeline after initiation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                  <tr><td className="px-4 py-3">PhonePe UPI / UPI</td><td className="px-4 py-3">Same day or next working day in most cases</td></tr>
                  <tr><td className="px-4 py-3">PhonePe wallet / wallet</td><td className="px-4 py-3">Usually immediate after gateway processing</td></tr>
                  <tr><td className="px-4 py-3">Debit card / credit card</td><td className="px-4 py-3">7 to 9 working days, depending on the issuing bank</td></tr>
                  <tr><td className="px-4 py-3">Net banking or other gateway methods</td><td className="px-4 py-3">5 to 10 working days, depending on the bank or gateway</td></tr>
                  <tr><td className="px-4 py-3">Manual UPI or offline refund</td><td className="px-4 py-3">5 to 7 working days after account verification</td></tr>
                </tbody>
              </table>
            </div>
            <p className={`${paragraph} mt-3`}>Gateway or bank delays after refund initiation are outside Ghumakkars' control, but we will share available refund reference details with the traveller on request.</p>
          </>
        ),
      },
      {
        title: '6. Trip cancellation by Ghumakkars',
        icon: <Shield className={iconClass} />,
        body: (
          <p className={paragraph}>If Ghumakkars cancels a trip before departure due to an internal operational reason, insufficient participation or a company decision, the traveller is eligible for a <strong>100% refund of the amount paid to Ghumakkars</strong>. If the traveller prefers, the amount can instead be transferred to another departure or kept as trip credit, but a refund remains available for company-side cancellations covered by this section.</p>
        ),
      },
      {
        title: '7. Weather, landslides, road closures and restrictions',
        icon: <AlertTriangle className={iconClass} />,
        body: (
          <p className={paragraph}>If a trip is cancelled, delayed, shortened, rerouted or modified due to weather, landslide, road closure, traffic disruption, government restriction, permit issue, safety advisory, transport disruption or other force majeure event, Ghumakkars will first try to provide a safe alternate itinerary, rescheduling option or trip credit. If a monetary refund is applicable, it will be limited to the amount Ghumakkars can recover from hotels, transporters, activity vendors and other suppliers after deducting costs already incurred for the booking.</p>
        ),
      },
      {
        title: '8. Failed, duplicate or excess payments',
        icon: <CreditCard className={iconClass} />,
        body: (
          <p className={paragraph}>If money is deducted but a booking is not confirmed, or if a duplicate or excess payment is received, Ghumakkars will verify the payment with the gateway or bank. Confirmed duplicate or excess payments are refunded to the original payment source. Failed payment reversals follow the applicable UPI, PhonePe, card, bank or gateway timeline.</p>
        ),
      },
      {
        title: '9. No-show and late arrival',
        icon: <AlertTriangle className={iconClass} />,
        body: (
          <p className={paragraph}>No refund is provided for no-shows, missed departures, late arrival at pickup point, failure to carry required documents, refusal by authorities or vendors due to traveller conduct or documents, or voluntary withdrawal before or during the trip.</p>
        ),
      },
      {
        title: '10. Partial usage and unused services',
        icon: <RefreshCw className={iconClass} />,
        body: (
          <p className={paragraph}>No refund is provided for partially used services, early departure, unused meals, unused stays, unused transport, skipped activities, personal preference changes, illness during travel, or any service not used by the traveller after the trip has started. If a supplier returns any specific unused-service amount to Ghumakkars, that recovered amount will be passed to the traveller after deducting applicable charges.</p>
        ),
      },
      {
        title: '11. Misconduct and safety removals',
        icon: <Gavel className={iconClass} />,
        body: (
          <p className={paragraph}>A traveller removed from a trip or denied boarding for fighting, harassment, abuse, intoxication, possession of illegal substances, unsafe conduct, damage to property, non-compliance with trip leader instructions or violation of law is not eligible for refund. The traveller is responsible for any additional return travel, stay, fine, damage or legal cost arising from such conduct.</p>
        ),
      },
      {
        title: '12. Final review',
        icon: <Scale className={iconClass} />,
        body: (
          <p className={paragraph}>Every refund is calculated according to this policy, the booking record, the payment record, the cancellation date and the trip status. If a traveller believes a refund has been calculated incorrectly, they can contact Ghumakkars support with the booking ID and payment reference for review.</p>
        ),
      },
    ],
  },
};

export function LegalPolicyPage({ type }: { type: PolicyKey }) {
  const content = policyContent[type];
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}${content.canonicalPath}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': content.jsonLdType,
    name: content.title,
    headline: content.title,
    description: content.description,
    url,
    dateModified: LEGAL_LAST_UPDATED_ISO,
    inLanguage: 'en-IN',
    isPartOf: {
      '@type': 'WebSite',
      name: CONTACT.brandName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: CONTACT.brandName,
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: CONTACT.phoneDisplay,
        email: CONTACT.supportEmail,
        contactType: 'customer support',
        areaServed: 'IN',
        availableLanguage: ['en', 'hi'],
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-950">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <header className="mt-8 overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
          <div className="border-b border-purple-100 bg-gradient-to-r from-purple-700 to-purple-900 px-5 py-8 sm:px-8 sm:py-10 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-100">{content.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{content.title}</h1>
            <p className="mt-4 max-w-3xl text-sm sm:text-base leading-7 text-purple-50">{content.description}</p>
          </div>
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Updated</p>
              <p className="mt-1 font-semibold text-slate-900">{LEGAL_LAST_UPDATED}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Applies To</p>
              <p className="mt-1 font-semibold text-slate-900">Ghumakkars website and bookings</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Jurisdiction</p>
              <p className="mt-1 font-semibold text-slate-900">India</p>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 rounded-xl border border-purple-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">On this page</p>
              <ol className="space-y-2">
                {content.sections.map((section) => (
                  <li key={section.title}>
                    <a href={`#${slugify(section.title)}`} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-purple-50 hover:text-purple-800">
                      {section.title.replace(/^\d+\.\s*/, '')}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="space-y-5">
            {content.sections.map((section) => (
              <section key={section.title} id={slugify(section.title)} className={sectionShell}>
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
                    {section.icon}
                  </div>
                  <h2 className="pt-1 text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
                    {section.title}
                  </h2>
                </div>
                {section.body}
              </section>
            ))}

            <section className="rounded-xl border border-purple-200 bg-purple-50 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-slate-950">Need help?</h2>
              <p className={`${paragraph} mt-2`}>
                Contact Ghumakkars at <EmailLink /> or WhatsApp/call{' '}
                <a href={CONTACT.whatsappLink} className="font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900">
                  {CONTACT.phoneDisplay}
                </a>
                . You can also visit the <TextLink href="/contact">Contact page</TextLink>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
