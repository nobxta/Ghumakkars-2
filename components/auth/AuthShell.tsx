'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';

/**
 * Split-screen auth layout (light theme): brand showcase on the left (desktop),
 * form on the right. Reused by sign-in, sign-up and forgot-password.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const chips = ['Manali', 'Kasol', 'Spiti', 'Chopta', 'Mussoorie'];
  const stats: [string, string][] = [
    ['25K+', 'Travellers'],
    ['4.9★', 'Avg Rating'],
    ['50+', 'Destinations'],
  ];

  return (
    <div className="min-h-[100svh] w-full flex bg-[#FAFAFC]">
      {/* Left showcase — desktop only */}
      <div className="hidden lg:flex w-[46%] xl:w-[48%] relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-[#f5f3ff] via-white to-[#faf5ff]">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#7C3AED] to-[#9333EA]" />
        <div className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-purple-200/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-8 right-0 w-[280px] h-[280px] rounded-full bg-fuchsia-200/40 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Ghumakkars" className="w-9 h-9 rounded-lg" />
          <span className="text-lg font-extrabold text-[#0F172A] tracking-tight">Ghumakkars</span>
        </Link>

        {/* Headline + chips + floating card */}
        <div className="relative z-10">
          <h2 className="text-4xl xl:text-5xl font-extrabold text-[#0F172A] leading-[1.08] tracking-tight">
            Discover hidden<br />gems across India.
          </h2>
          <p className="mt-3 text-[#64748B]">Explore Beyond Ordinary</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c} className="px-3.5 py-1.5 rounded-full text-sm font-semibold text-[#7C3AED] bg-white border border-purple-100 shadow-sm">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-lg px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">Just booked Spiti trip</p>
              <p className="text-xs text-[#94a3b8]">Arjun · 2 min ago</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          {stats.map(([n, l]) => (
            <div key={l}>
              <p className="text-xl font-extrabold text-[#0F172A]">{n}</p>
              <p className="text-xs text-[#64748B]">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form area */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Ghumakkars" className="w-9 h-9 rounded-lg" />
            <span className="text-lg font-extrabold text-[#0F172A] tracking-tight">Ghumakkars</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
