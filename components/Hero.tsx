'use client';

import { MapPin } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-[85vh] sm:min-h-[90vh] md:min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-purple-50/30 to-purple-100/20">
      {/* Enhanced gradient background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-0 w-56 h-56 sm:w-64 sm:h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 sm:w-80 sm:h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-45 animate-blob animation-delay-6000"></div>
      </div>

      {/* Enhanced floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-8 sm:top-20 sm:left-10 w-2 h-2 sm:w-3 sm:h-3 bg-purple-400 rounded-full opacity-50 animate-pulse"></div>
        <div className="absolute top-32 right-12 sm:top-40 sm:right-20 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded-full opacity-40 animate-pulse animation-delay-1000"></div>
        <div className="absolute bottom-24 left-1/4 sm:bottom-32 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-purple-400 rounded-full opacity-50 animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-16 right-1/3 sm:bottom-20 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded-full opacity-40 animate-pulse animation-delay-3000"></div>
        <div className="absolute top-1/3 right-8 sm:right-10 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-purple-400 rounded-full opacity-50 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#8B5CF6_1px,transparent_1px),linear-gradient(to_bottom,#8B5CF6_1px,transparent_1px)] bg-[size:24px_24px] sm:bg-[size:32px_32px]"></div>

      {/* Geometric shapes for professional look */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-32 h-32 sm:w-40 sm:h-40 border border-purple-200/30 rounded-lg rotate-12 opacity-20 hidden sm:block"></div>
        <div className="absolute bottom-20 left-10 w-24 h-24 sm:w-32 sm:h-32 border border-purple-300/30 rounded-full opacity-20 hidden sm:block"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-12 sm:py-16 md:py-24 lg:py-32">
        {/* Main Heading — editorial serif */}
        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 sm:mb-7 md:mb-8 text-gray-900 tracking-tight animate-fade-in leading-[1.05] px-2">
          Your next travel story starts{' '}
          <span className="italic font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            this weekend.
          </span>
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg md:text-xl text-gray-700 mb-8 sm:mb-10 max-w-2xl mx-auto px-2 sm:px-4 animate-fade-in-delay font-medium leading-relaxed">
          Join verified group trips across India. Travel with like-minded people, not random tour buses.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center animate-fade-in-delay-2 px-2 sm:px-4">
          <a
            href="/trips"
            className="group w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-700 text-white px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-semibold tracking-wide hover:from-purple-700 hover:to-purple-800 transition-all duration-200 inline-flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100"
          >
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2 group-hover:animate-pulse" />
            Explore Trips
          </a>
          <a
            href="/#about"
            className="w-full sm:w-auto border-2 border-purple-600 text-purple-700 bg-white/90 backdrop-blur-sm px-8 sm:px-10 py-3.5 sm:py-4 text-sm sm:text-base font-semibold tracking-wide hover:bg-purple-50 hover:border-purple-700 transition-all duration-200 rounded-full shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100"
          >
            How It Works
          </a>
        </div>
      </div>
    </section>
  );
}

