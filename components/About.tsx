'use client';

import { Users, Award, Heart, MapPin } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

export default function About() {
  return (
    <section id="about" className="py-16 md:py-24 lg:py-32 bg-white border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
          <ScrollAnimation className="px-4 md:px-0">
            <div className="flex items-center mb-4 md:mb-6">
              <div className="h-px bg-purple-200 w-12 md:w-16"></div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mx-4 md:mx-6 tracking-tight">
                Why Ghumakkars?
              </h2>
              <div className="h-px bg-purple-200 flex-1"></div>
            </div>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-5 md:mb-6 font-light leading-relaxed">
              We recognize that university life comes with limited funds but unlimited wanderlust. 
              Ghumakkars was born from the vision of making extraordinary travel experiences accessible 
              to every Indian student, transforming budget constraints into opportunities for authentic exploration.
            </p>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 md:mb-12 font-light leading-relaxed">
              Our carefully curated journeys combine affordable pricing, thoughtfully designed itineraries, 
              and authentic local experiences. We handle every detail—from accommodation to activities—so you can focus 
              on creating memories that last a lifetime with friends and fellow travelers.
            </p>
            
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <div className="text-center p-5 md:p-6 border-2 border-purple-100 bg-purple-50/50 rounded-xl hover:border-purple-200 transition-all duration-300 hover:shadow-lg group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-purple-100 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Users className="h-6 w-6 md:h-7 md:w-7 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-2xl md:text-3xl font-light text-gray-900 mb-1 tracking-tight">5K+</div>
                <div className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium">Adventurous Students</div>
              </div>
              <div className="text-center p-5 md:p-6 border-2 border-purple-100 bg-purple-50/50 rounded-xl hover:border-purple-200 transition-all duration-300 hover:shadow-lg group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-purple-100 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <MapPin className="h-6 w-6 md:h-7 md:w-7 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-2xl md:text-3xl font-light text-gray-900 mb-1 tracking-tight">50+</div>
                <div className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium">Destinations</div>
              </div>
              <div className="text-center p-5 md:p-6 border-2 border-purple-100 bg-purple-50/50 rounded-xl hover:border-purple-200 transition-all duration-300 hover:shadow-lg group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-purple-100 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Award className="h-6 w-6 md:h-7 md:w-7 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-2xl md:text-3xl font-light text-gray-900 mb-1 tracking-tight">100+</div>
                <div className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium">Curated Trips</div>
              </div>
              <div className="text-center p-5 md:p-6 border-2 border-purple-100 bg-purple-50/50 rounded-xl hover:border-purple-200 transition-all duration-300 hover:shadow-lg group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-purple-100 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Heart className="h-6 w-6 md:h-7 md:w-7 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-2xl md:text-3xl font-light text-gray-900 mb-1 tracking-tight">98%</div>
                <div className="text-xs md:text-sm text-gray-600 uppercase tracking-wide font-medium">Satisfaction Rate</div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200} className="relative px-4 md:px-0">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="space-y-3 md:space-y-4">
                <div className="h-40 md:h-48 lg:h-56 bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-200 rounded-2xl flex items-center justify-center hover:border-purple-300 transition-colors">
                  <Users className="h-10 w-10 md:h-12 md:w-12 text-purple-400" />
                </div>
                <div className="h-52 md:h-64 lg:h-72 bg-gradient-to-br from-purple-200 to-purple-100 border-2 border-purple-200 rounded-2xl flex items-center justify-center hover:border-purple-300 transition-colors">
                  <Award className="h-10 w-10 md:h-12 md:w-12 text-purple-500" />
                </div>
              </div>
              <div className="space-y-3 md:space-y-4 pt-8 md:pt-12">
                <div className="h-52 md:h-64 lg:h-72 bg-gradient-to-br from-purple-300 to-purple-200 border-2 border-purple-200 rounded-2xl flex items-center justify-center hover:border-purple-300 transition-colors">
                  <MapPin className="h-10 w-10 md:h-12 md:w-12 text-purple-600" />
                </div>
                <div className="h-40 md:h-48 lg:h-56 bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-200 rounded-2xl flex items-center justify-center hover:border-purple-300 transition-colors">
                  <Heart className="h-10 w-10 md:h-12 md:w-12 text-purple-400" />
                </div>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

