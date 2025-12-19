import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import DestinationsSwiper from './DestinationsSwiper';
import ScrollAnimation from './ScrollAnimation';

export default function Trips() {

  return (
    <section id="trips" className="py-16 md:py-24 lg:py-32 bg-gradient-to-b from-white to-purple-50/30 border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <div className="flex-1 h-px bg-purple-200 max-w-20"></div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mx-4 md:mx-8 tracking-tight">
              Curated Journeys
            </h2>
            <div className="flex-1 h-px bg-purple-200 max-w-20"></div>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Handpicked destinations and meticulously planned itineraries crafted specifically for adventurous students seeking authentic experiences
          </p>
        </ScrollAnimation>

        {/* Destinations Swiper */}
        <DestinationsSwiper />

        {/* View All Trips Link */}
        <div className="text-center mt-12 md:mt-16">
          <Link
            href="/trips"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium text-base md:text-lg transition-colors group px-6 py-3 border-2 border-purple-200 rounded-xl hover:border-purple-300"
          >
            <span>View All Trips</span>
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
