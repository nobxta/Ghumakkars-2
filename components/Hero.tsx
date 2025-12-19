'use client';

import { Users, Calendar, MapPin, Sparkles, TrendingUp, Shield } from 'lucide-react';

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
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 border border-purple-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 mb-5 sm:mb-6 md:mb-8 animate-fade-in rounded-full shadow-md hover:shadow-lg transition-shadow">
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 text-purple-600" />
          <span className="text-xs sm:text-sm md:text-sm font-semibold tracking-wider text-purple-700 uppercase">Exclusive Student Deals</span>
        </div>
        
        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold mb-4 sm:mb-5 md:mb-6 lg:mb-8 text-gray-900 tracking-tight animate-fade-in leading-[1.1] sm:leading-tight px-2">
          Discover India's Hidden
          <span className="block mt-1 sm:mt-2 md:mt-3 font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Gems & Wonders
          </span>
        </h1>
        
        {/* Primary Description */}
        <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-700 mb-3 sm:mb-4 md:mb-5 lg:mb-6 max-w-3xl mx-auto px-2 sm:px-4 animate-fade-in-delay font-medium leading-relaxed">
          Curated journeys designed exclusively for university students seeking authentic experiences without breaking the bank
        </p>
        
        {/* Secondary Description */}
        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-600 mb-6 sm:mb-8 md:mb-10 lg:mb-12 max-w-2xl mx-auto px-2 sm:px-4 animate-fade-in-delay leading-relaxed">
          Join our community of adventurous students exploring India's diverse landscapes, rich cultures, and unforgettable destinations with unbeatable group rates
        </p>
        
        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 md:gap-4 mb-6 sm:mb-8 md:mb-10 lg:mb-12 px-2 sm:px-4 animate-fade-in-delay-2">
          <div className="flex items-center space-x-2 border border-purple-200/80 bg-white/90 backdrop-blur-sm px-3.5 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full shadow-md hover:shadow-lg hover:border-purple-300 hover:bg-white transition-all duration-200">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            <span className="text-xs sm:text-sm md:text-sm font-semibold text-gray-800 tracking-wide">Group Adventures</span>
          </div>
          <div className="flex items-center space-x-2 border border-purple-200/80 bg-white/90 backdrop-blur-sm px-3.5 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full shadow-md hover:shadow-lg hover:border-purple-300 hover:bg-white transition-all duration-200">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            <span className="text-xs sm:text-sm md:text-sm font-semibold text-gray-800 tracking-wide">Flexible Scheduling</span>
          </div>
          <div className="flex items-center space-x-2 border border-purple-200/80 bg-white/90 backdrop-blur-sm px-3.5 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full shadow-md hover:shadow-lg hover:border-purple-300 hover:bg-white transition-all duration-200">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            <span className="text-xs sm:text-sm md:text-sm font-semibold text-gray-800 tracking-wide">Best Prices</span>
          </div>
          <div className="flex items-center space-x-2 border border-purple-200/80 bg-white/90 backdrop-blur-sm px-3.5 sm:px-4 md:px-5 py-2 sm:py-2.5 rounded-full shadow-md hover:shadow-lg hover:border-purple-300 hover:bg-white transition-all duration-200">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
            <span className="text-xs sm:text-sm md:text-sm font-semibold text-gray-800 tracking-wide">Safe Travel</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 md:gap-4 justify-center items-center animate-fade-in-delay-2 px-2 sm:px-4">
          <a
            href="/trips"
            className="group w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-700 text-white px-7 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-base font-semibold tracking-wide uppercase hover:from-purple-700 hover:to-purple-800 transition-all duration-200 inline-flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-100"
          >
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2 group-hover:animate-pulse" />
            Explore Destinations
          </a>
          <a
            href="/auth/signup"
            className="w-full sm:w-auto border-2 border-purple-600 text-purple-700 bg-white/90 backdrop-blur-sm px-7 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-base font-semibold tracking-wide uppercase hover:bg-purple-50 hover:border-purple-700 transition-all duration-200 rounded-full shadow-md hover:shadow-lg transform hover:scale-105 active:scale-100"
          >
            Start Your Journey
          </a>
        </div>
      </div>
    </section>
  );
}

