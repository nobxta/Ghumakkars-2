'use client';

import { ArrowRight, Sparkles, MapPin } from 'lucide-react';
import Link from 'next/link';
import ScrollAnimation from './ScrollAnimation';

export default function CTA() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm border border-white/30 px-4 md:px-6 py-2 md:py-2.5 mb-6 md:mb-8 rounded-full">
            <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
            <span className="text-xs md:text-sm font-semibold text-white uppercase tracking-wider">Ready to Explore?</span>
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-white mb-6 md:mb-8 tracking-tight leading-tight">
            Start Your Adventure
            <span className="block mt-2 md:mt-3 font-medium">Today</span>
          </h2>

          <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-8 md:mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Join thousands of students discovering India's incredible destinations. Your next unforgettable journey awaits.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center mb-8 md:mb-12">
            <Link
              href="/auth/signup"
              className="group w-full sm:w-auto bg-white text-purple-600 px-8 md:px-10 py-4 md:py-5 text-sm md:text-base font-semibold tracking-wide uppercase hover:bg-purple-50 transition-all duration-200 inline-flex items-center justify-center space-x-2 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <span>Create Account</span>
              <ArrowRight className="h-4 w-4 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/trips"
              className="w-full sm:w-auto border-2 border-white text-white px-8 md:px-10 py-4 md:py-5 text-sm md:text-base font-semibold tracking-wide uppercase hover:bg-white/10 transition-all duration-200 inline-flex items-center justify-center space-x-2 rounded-full backdrop-blur-sm"
            >
              <MapPin className="h-4 w-4 md:h-5 md:w-5" />
              <span>Browse Trips</span>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-white/80">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm md:text-base font-light">No Hidden Fees</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm md:text-base font-light">24/7 Support</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm md:text-base font-light">Easy Cancellation</span>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

