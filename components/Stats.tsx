'use client';

import { Users, MapPin, Heart, TrendingUp, Calendar, Award } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const stats = [
  {
    icon: Users,
    value: '5,000+',
    label: 'Happy Travelers',
    description: 'Students who explored India with us',
  },
  {
    icon: MapPin,
    value: '50+',
    label: 'Destinations',
    description: 'Curated locations across India',
  },
  {
    icon: Calendar,
    value: '200+',
    label: 'Trips Completed',
    description: 'Successful journeys organized',
  },
  {
    icon: TrendingUp,
    value: '24/7',
    label: 'Support Available',
    description: 'Round-the-clock assistance for travelers',
  },
  {
    icon: Heart,
    value: '98%',
    label: 'Satisfaction Rate',
    description: 'Students recommend us',
  },
  {
    icon: Award,
    value: '4.9/5',
    label: 'Average Rating',
    description: 'From verified travelers',
  },
];

export default function Stats() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-b from-purple-50/50 via-white to-purple-50/30 border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-purple-300 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-200 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-4 md:mb-6 tracking-tight">
            Our Impact in Numbers
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Building a community of adventurous students exploring India&apos;s diverse landscapes
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 lg:gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <ScrollAnimation key={index} delay={index * 100} className="group text-center p-4 md:p-6 bg-white/80 backdrop-blur-sm border-2 border-purple-100 rounded-xl md:rounded-2xl hover:border-purple-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-center mb-3 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                  </div>
                </div>
                <div className="text-2xl md:text-3xl lg:text-4xl font-light text-gray-900 mb-1 md:mb-2 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-gray-500 font-light hidden lg:block">
                  {stat.description}
                </div>
              </ScrollAnimation>
            );
          })}
        </div>
      </div>
    </section>
  );
}

