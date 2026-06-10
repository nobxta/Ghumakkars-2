'use client';

import Link from 'next/link';
import { Users, Award, Heart, MapPin, ArrowRight } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const STATS = [
  { icon: Users, value: '5K+', label: 'Happy travellers', desc: 'Trusted by explorers across India', tint: 'bg-purple-100', fg: 'text-purple-600' },
  { icon: MapPin, value: '50+', label: 'Destinations', desc: 'From the Himalayas to the coast', tint: 'bg-fuchsia-100', fg: 'text-fuchsia-600' },
  { icon: Award, value: '100+', label: 'Curated trips', desc: 'Every route planned and vetted', tint: 'bg-blue-100', fg: 'text-blue-600' },
  { icon: Heart, value: '98%', label: 'Would book again', desc: 'Travellers who come back for more', tint: 'bg-rose-100', fg: 'text-rose-600' },
];

export default function About() {
  return (
    <section id="about" className="relative py-16 md:py-24 lg:py-28 bg-gradient-to-b from-white via-purple-50/30 to-white border-t border-purple-100 overflow-hidden">
      {/* Travel-themed decorative blur */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-20 right-0 w-[28rem] h-[28rem] bg-purple-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-10 w-[24rem] h-[24rem] bg-fuchsia-200/25 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">

          {/* LEFT — heading, copy, CTA */}
          <ScrollAnimation>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider mb-5">
              Why Ghumakkars
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-5">
              Travel should feel exciting, not exhausting.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-4 max-w-xl">
              From transport and stays to local experiences, we handle the planning so you can focus on making memories.
            </p>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8 max-w-xl">
              Thousands of travellers trust Ghumakkars to explore India through small-group trips built for comfort, adventure, and the kind of moments you actually remember.
            </p>
            <Link
              href="/trips"
              className="group inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all"
            >
              Explore trips
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </ScrollAnimation>

          {/* RIGHT — stats grid (icon + number + label merged into one card each) */}
          <ScrollAnimation delay={150}>
            <div className="grid grid-cols-2 gap-4 md:gap-5">
              {STATS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="group bg-white/80 backdrop-blur-sm border border-purple-100 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${s.tint} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${s.fg}`} aria-hidden="true" />
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-none">{s.value}</div>
                    <div className="text-sm font-bold text-gray-900 mt-1.5">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-snug">{s.desc}</div>
                  </div>
                );
              })}
            </div>
          </ScrollAnimation>

        </div>
      </div>
    </section>
  );
}
