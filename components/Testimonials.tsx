'use client';

import { Star, Quote } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const testimonials = [
  {
    id: 1,
    name: 'Priya Sharma',
    university: 'Delhi University',
    rating: 5,
    text: 'Ghumakkars made my Goa trip absolutely incredible! The group was amazing, prices were unbeatable, and everything was perfectly organized. Best travel experience as a student!',
    trip: 'Goa Adventure',
  },
  {
    id: 2,
    name: 'Rahul Patel',
    university: 'Mumbai University',
    rating: 5,
    text: 'As a couple, we were looking for affordable travel options. Ghumakkars exceeded our expectations with their Kerala backwaters trip. Highly recommend!',
    trip: 'Kerala Backwaters',
  },
  {
    id: 3,
    name: 'Ananya Singh',
    university: 'Bangalore University',
    rating: 5,
    text: 'The Rajasthan trip was a dream come true! Met amazing people, saw incredible places, and stayed within my student budget. Can\'t wait for the next adventure!',
    trip: 'Rajasthan Royalty',
  },
];

export default function Testimonials() {
  return (
    <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-b from-white to-purple-50/30 border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <div className="flex-1 h-px bg-purple-200 max-w-16 md:max-w-24"></div>
            <Quote className="h-8 w-8 md:h-10 md:w-10 text-purple-400 mx-4 md:mx-6" />
            <div className="flex-1 h-px bg-purple-200 max-w-16 md:max-w-24"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-4 md:mb-6 tracking-tight">
            Stories from Our Travelers
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Real experiences from students who explored India with us
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <ScrollAnimation key={testimonial.id} delay={index * 100}>
              <div className="group relative bg-white/90 backdrop-blur-sm border-2 border-purple-100 rounded-xl md:rounded-2xl p-6 md:p-8 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
              <div className="absolute top-4 left-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Quote className="h-12 w-12 md:h-16 md:w-16 text-purple-600" />
              </div>
              
              <div className="flex items-center mb-4 md:mb-5">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 md:h-5 md:w-5 fill-purple-500 text-purple-500" />
                ))}
              </div>

              <p className="text-sm md:text-base text-gray-600 mb-5 md:mb-6 font-light leading-relaxed relative z-10">
                &quot;{testimonial.text}&quot;
              </p>

              <div className="border-t border-purple-100 pt-4 md:pt-5">
                <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
                  {testimonial.name}
                </p>
                <p className="text-xs md:text-sm text-gray-500 font-light mb-2">
                  {testimonial.university}
                </p>
                <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">
                  {testimonial.trip}
                </p>
              </div>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}

