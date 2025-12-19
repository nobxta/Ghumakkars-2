'use client';

import { Shield, Clock, Users, MapPin, Heart, Award, Sparkles, Zap } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const features = [
  {
    icon: Shield,
    title: 'Safe & Secure',
    description: 'Verified accommodations and trusted local partners ensure your safety throughout the journey',
  },
  {
    icon: Clock,
    title: 'Flexible Scheduling',
    description: 'Choose dates that fit your academic calendar with easy rescheduling options',
  },
  {
    icon: Users,
    title: 'Group Adventures',
    description: 'Meet like-minded students and create lasting friendships on group trips',
  },
  {
    icon: MapPin,
    title: 'Curated Routes',
    description: 'Expertly planned itineraries covering hidden gems and must-see destinations',
  },
  {
    icon: Heart,
    title: 'Student-Focused',
    description: 'Every detail designed with student budgets and preferences in mind',
  },
  {
    icon: Award,
    title: 'Best Value',
    description: 'Unbeatable prices with transparent pricing - no hidden costs or surprises',
  },
];

export default function Features() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-white border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <div className="inline-flex items-center space-x-2 mb-4 md:mb-6">
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
            <span className="text-xs md:text-sm font-semibold text-purple-600 uppercase tracking-wider">Why Choose Us</span>
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-4 md:mb-6 tracking-tight">
            Everything You Need
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Comprehensive travel solutions designed to make your journey seamless, affordable, and unforgettable
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <ScrollAnimation key={index} delay={index * 100} className="group relative bg-gradient-to-br from-purple-50/50 to-white border-2 border-purple-100 rounded-xl md:rounded-2xl p-6 md:p-8 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 bg-purple-300 rounded-full"></div>
                </div>
                <div className="mb-4 md:mb-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Icon className="h-6 w-6 md:h-7 md:w-7 text-purple-600" />
                  </div>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 md:mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm md:text-base text-gray-600 font-light leading-relaxed">
                  {feature.description}
                </p>
              </ScrollAnimation>
            );
          })}
        </div>
      </div>
    </section>
  );
}

