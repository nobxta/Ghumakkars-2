'use client';

import { Shield, Clock, Users, MapPin, Heart, Award, Sparkles, Zap } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const features = [
  {
    icon: Shield,
    title: 'We check every stay',
    description: 'Our team personally vets hotels and homestays before adding them. If we wouldn\'t sleep there, you won\'t either.',
  },
  {
    icon: Clock,
    title: 'Pick your dates',
    description: 'Most trips run on multiple dates. Can\'t make one? Reschedule to the next batch — no extra charge.',
  },
  {
    icon: Users,
    title: '10-25 people per trip',
    description: 'Big enough to have a good time, small enough that you actually get to know people. Not a 50-person tourist bus.',
  },
  {
    icon: MapPin,
    title: 'Off the beaten path',
    description: 'We skip the overcrowded tourist spots. Think hidden waterfalls in Meghalaya, not the same old Mall Road walk.',
  },
  {
    icon: Heart,
    title: 'Actually affordable',
    description: 'A 4-day Manali trip for ₹4,999 including stays, transport, and meals. That\'s not a typo.',
  },
  {
    icon: Award,
    title: 'No surprise costs',
    description: 'The price on the page is the price you pay. We list everything that\'s included and what\'s not. Simple.',
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
            <span className="text-xs md:text-sm font-semibold text-purple-600 uppercase tracking-wider">How it works</span>
            <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-4 md:mb-6 tracking-tight">
            What you get with us
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            We&apos;ve done over 200 trips. Here&apos;s what we&apos;ve figured out matters most.
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

