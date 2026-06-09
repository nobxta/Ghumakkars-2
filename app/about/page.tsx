import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mountain, Heart, Users, Shield, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Ghumakkars | Group Trips Across India',
  description: 'Ghumakkars is a community of travelers running curated, safe and budget-friendly group trips across India.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/40 via-white to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900 font-semibold mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider mb-4">
            <Mountain className="h-3.5 w-3.5" /> Our story
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
            Travel that feels like family.
          </h1>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
            Ghumakkars is a community of curious travelers running curated, safe and budget-friendly
            group trips across India — built for people who want real experiences without the hassle of
            planning.
          </p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 pl-3 border-l-4 border-purple-600">
            Why we started
          </h2>
          <p className="text-base text-gray-700 leading-relaxed">
            We grew up loving the mountains, the deserts and the coast, but realised travel often felt
            either expensive or chaotic — overpriced packages, sketchy operators, or solo trips that
            felt lonely. We started Ghumakkars to fix that: small groups, honest pricing, vetted stays,
            and trip leaders who actually care.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-7 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5 pl-3 border-l-4 border-purple-600">
            What we stand for
          </h2>
          <div className="space-y-5">
            <Value
              icon={<Shield className="h-5 w-5 text-green-700" />}
              iconBg="bg-green-100"
              title="Transparent pricing"
              body="No hidden fees, no surprise charges. What you see on the trip page is what you pay."
            />
            <Value
              icon={<Heart className="h-5 w-5 text-pink-600" />}
              iconBg="bg-pink-100"
              title="Vetted stays & partners"
              body="Every hotel, homestay and driver in our network has been personally checked by our team."
            />
            <Value
              icon={<Users className="h-5 w-5 text-purple-700" />}
              iconBg="bg-purple-100"
              title="Small groups, real bonds"
              body="We cap our group sizes intentionally so trips feel personal — not like a packaged tour."
            />
            <Value
              icon={<Sparkles className="h-5 w-5 text-amber-600" />}
              iconBg="bg-amber-100"
              title="Local-first"
              body="We work with local guides, eat at family-run dhabas and put money back into the places we visit."
            />
          </div>
        </section>

        <section className="bg-gradient-to-br from-purple-600 to-fuchsia-700 rounded-2xl p-6 sm:p-8 text-white text-center shadow-lg shadow-purple-500/30">
          <h2 className="text-xl sm:text-2xl font-extrabold mb-2">Ready for your next trip?</h2>
          <p className="text-purple-100 mb-5 text-sm sm:text-base">
            Browse our upcoming departures and find one that fits your vibe.
          </p>
          <Link
            href="/trips"
            className="inline-block px-6 py-3 bg-white text-purple-700 font-bold rounded-xl hover:bg-purple-50 transition-colors"
          >
            Explore Trips
          </Link>
        </section>
      </div>
    </div>
  );
}

function Value({ icon, iconBg, title, body }: { icon: React.ReactNode; iconBg: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <h3 className="font-bold text-gray-900 mb-0.5">{title}</h3>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
