'use client';

import { useState } from 'react';
import { Mail, Send, CheckCircle } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter subscription
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setEmail('');
    }, 3000);
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-purple-50 via-white to-purple-50/50 border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="bg-white/90 backdrop-blur-md border-2 border-purple-200 rounded-2xl p-8 md:p-12 text-center shadow-xl">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8">
            <Mail className="h-8 w-8 md:h-10 md:w-10 text-purple-600" />
          </div>
          
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-gray-900 mb-3 md:mb-4 tracking-tight">
            Stay Updated
          </h2>
          <p className="text-base md:text-lg text-gray-600 mb-6 md:mb-8 max-w-2xl mx-auto font-light leading-relaxed">
            Get notified about new trips, exclusive deals, and special student discounts
          </p>

          {submitted ? (
            <div className="flex items-center justify-center space-x-2 text-purple-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Thank you for subscribing!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 md:gap-4 max-w-md mx-auto">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.email@university.edu"
                  className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base text-gray-900 placeholder-gray-400"
                />
              </div>
              <button
                type="submit"
                className="bg-purple-600 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-lg font-semibold hover:bg-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
              >
                <Send className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-sm md:text-base">Subscribe</span>
              </button>
            </form>
          )}
        </ScrollAnimation>
      </div>
    </section>
  );
}

