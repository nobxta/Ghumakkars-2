import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageCircle, Phone, MapPin, Clock, Instagram } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us | Ghumakkars',
  description: 'Get in touch with the Ghumakkars team for bookings, support, partnerships or any travel-related queries.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Contact Us</h1>
          <p className="mt-3 text-base text-gray-700 leading-relaxed">
            Have a question about a trip, your booking or anything else? We&rsquo;d love to hear from you.
            Reach out through any of the channels below and we&rsquo;ll get back to you as soon as we can.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <ContactCard
            icon={<Mail className="h-5 w-5 text-purple-700" />}
            label="Email — General"
            value="support@ghumakkars.in"
            href="mailto:support@ghumakkars.in"
          />
          <ContactCard
            icon={<Mail className="h-5 w-5 text-purple-700" />}
            label="Email — Bookings"
            value="bookings@ghumakkars.in"
            href="mailto:bookings@ghumakkars.in"
          />
          <ContactCard
            icon={<MessageCircle className="h-5 w-5 text-green-700" />}
            label="WhatsApp"
            value="+91 96218 86657"
            href="https://wa.me/919621886657"
            iconBg="bg-green-100"
          />
          <ContactCard
            icon={<Phone className="h-5 w-5 text-purple-700" />}
            label="Phone"
            value="+91 96218 86657"
            href="tel:+919621886657"
          />
          <ContactCard
            icon={<Instagram className="h-5 w-5 text-pink-600" />}
            label="Instagram"
            value="@ghumakkars.in"
            href="https://instagram.com/ghumakkars.in"
            iconBg="bg-pink-100"
          />
          <ContactCard
            icon={<MapPin className="h-5 w-5 text-purple-700" />}
            label="Based in"
            value="Mathura, Uttar Pradesh, India"
          />
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-purple-700" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Support Hours</h2>
          </div>
          <div className="text-sm sm:text-base text-gray-700 leading-relaxed space-y-1">
            <p><strong>Mon – Sat:</strong> 9:00 AM – 9:00 PM IST</p>
            <p><strong>Sunday:</strong> 10:00 AM – 6:00 PM IST</p>
            <p className="text-sm text-gray-600 mt-3">
              During an active trip, our team is reachable 24/7 on WhatsApp for emergencies.
            </p>
          </div>
        </section>

        <section className="bg-purple-50 border border-purple-200 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Looking for something specific?</h2>
          <ul className="text-sm sm:text-base text-gray-700 space-y-2">
            <li>
              <strong>Refunds & cancellations →</strong>{' '}
              <Link href="/cancellation-policy" className="text-purple-700 font-semibold underline">Cancellation Policy</Link>
            </li>
            <li>
              <strong>Booking terms →</strong>{' '}
              <Link href="/terms" className="text-purple-700 font-semibold underline">Terms &amp; Conditions</Link>
            </li>
            <li>
              <strong>Data & privacy →</strong>{' '}
              <Link href="/privacy" className="text-purple-700 font-semibold underline">Privacy Policy</Link>
            </li>
            <li>
              <strong>Browse trips →</strong>{' '}
              <Link href="/trips" className="text-purple-700 font-semibold underline">All Trips</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ContactCard({
  icon,
  label,
  value,
  href,
  iconBg = 'bg-purple-100',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  iconBg?: string;
}) {
  const inner = (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-purple-300 transition-all h-full">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{label}</p>
          <p className="font-bold text-gray-900 text-sm sm:text-base mt-0.5 break-all">{value}</p>
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>
        {inner}
      </a>
    );
  }
  return inner;
}
