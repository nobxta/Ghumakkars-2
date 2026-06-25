'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { getStatusConfig } from './statusConfig';
import StatusHero from './StatusHero';
import BookingSummaryCard, { type PaymentData } from './BookingSummaryCard';
import BookingActions from './BookingActions';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-jakarta' });

export interface BookingStatusViewProps {
  bookingId: string;
  status: string;
  shortId: string;
  guests: number;
  tripTitle?: string;
  destination?: string;
  dateRange?: string | null;
  hasSubmitted: boolean;
  payment: PaymentData;
}

/**
 * Top-level, status-driven booking confirmation view. One layout for every
 * `booking_status`; the config swaps badge, icon, colour, copy, payment block
 * and actions. The page owns all data fetching and business logic — this is pure
 * presentation.
 */
export default function BookingStatusView(props: BookingStatusViewProps) {
  const { bookingId, status, shortId, guests, tripTitle, destination, dateRange, hasSubmitted, payment } = props;
  const config = getStatusConfig(status, { bookingId, hasSubmitted });
  const light = config.surface === 'light';

  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    if (config.confetti) {
      const t = setTimeout(() => setConfetti(true), 250);
      return () => clearTimeout(t);
    }
  }, [config.confetti]);

  return (
    <div
      className={`${jakarta.variable} relative min-h-[100svh] w-full overflow-hidden`}
      style={{ background: config.gradient, backgroundColor: light ? '#f9f9ff' : config.accent }}
    >
      {/* Ambient blobs for depth */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      {confetti && <Confetti />}

      {/* Minimal brand header (matches the focused Stitch shell) */}
      <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-5 py-5 sm:px-10">
        <Link
          href="/"
          className={`bs-display text-xl font-extrabold tracking-tight sm:text-2xl ${light ? 'text-[#191b23]' : 'text-white'}`}
        >
          Ghumakkars
        </Link>
        <Link
          href="/profile"
          aria-label="Account"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${light ? 'text-[#191b23] hover:bg-black/5' : 'text-white hover:bg-white/10'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3.2" /><path d="M5 19c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      {/* Content */}
      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[560px] flex-col items-center justify-center gap-6 px-4 pb-16 pt-28 sm:pt-24">
        <StatusHero config={config} />
        <BookingSummaryCard
          config={config}
          shortId={shortId}
          guests={guests}
          tripTitle={tripTitle}
          destination={destination}
          dateRange={dateRange}
          payment={payment}
        />
        <BookingActions config={config} />
      </main>

      <style jsx global>{`
        .bs-display { font-family: var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif; }
        @keyframes bs-pop { 0% { transform: scale(0.5); opacity: 0; } 55% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes bs-icon-pop { 0% { transform: scale(0); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes bs-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bs-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .bs-pop { animation: bs-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
        .bs-icon-pop { animation: bs-icon-pop 0.5s ease-out 0.25s both; }
        .bs-fade { animation: bs-fade 0.5s ease-out 0.15s both; }
        .bs-fade-up { animation: bs-fade-up 0.6s ease-out 0.3s both; }
        @media (prefers-reduced-motion: reduce) {
          .bs-pop, .bs-icon-pop, .bs-fade, .bs-fade-up { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Lightweight CSS confetti for the confirmed state — no canvas, no deps. */
function Confetti() {
  const colors = ['#fde047', '#f9a8d4', '#ffffff', '#67e8f9', '#bbf7d0'];
  const pieces = Array.from({ length: 22 });
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden" aria-hidden>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.4 + Math.random() * 1.6;
        const size = 6 + Math.random() * 6;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-5%',
              left: `${left}%`,
              width: size,
              height: size * 0.6,
              background: color,
              borderRadius: 2,
              opacity: 0.9,
              animation: `bs-confetti ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
      <style jsx>{`
        @keyframes bs-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
