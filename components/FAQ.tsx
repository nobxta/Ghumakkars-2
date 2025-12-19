'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, User, Mail, MessageSquare, Send, Phone } from 'lucide-react';
import ScrollAnimation from './ScrollAnimation';

const faqs = [
  {
    id: 1,
    question: 'How do I book a trip?',
    answer: 'Booking a trip is simple! Browse our curated journeys, select your preferred destination and dates, and click "Book Now". You\'ll need to create an account first if you haven\'t already. Once booked, you\'ll receive a confirmation email with all trip details.',
  },
  {
    id: 2,
    question: 'Are the trips really budget-friendly for students?',
    answer: 'Absolutely! We specialize in creating affordable travel experiences specifically for university students. Our trips include group rates, transparent pricing with no hidden costs, and carefully planned itineraries that maximize value. We focus on authentic experiences that fit student budgets.',
  },
  {
    id: 3,
    question: 'What is included in the trip price?',
    answer: 'Our trip prices typically include accommodation, transportation, guided tours, and some meals as specified in each trip\'s details. All inclusions are clearly listed on each trip page. Additional expenses like personal shopping, optional activities, or extra meals are not included.',
  },
  {
    id: 4,
    question: 'Can I cancel or reschedule my booking?',
    answer: 'Yes! We understand that plans can change. You can cancel or reschedule your booking up to 7 days before the trip start date. Cancellation fees may apply depending on the timing. Check our cancellation policy on the trip details page for specific terms.',
  },
  {
    id: 5,
    question: 'Do I need travel insurance?',
    answer: 'While travel insurance is not mandatory, we highly recommend it for your safety and peace of mind. It covers medical emergencies, trip cancellations, and lost belongings. You can purchase travel insurance through our partners or your preferred provider.',
  },
  {
    id: 6,
    question: 'What if a trip gets cancelled?',
    answer: 'In the rare event that we need to cancel a trip due to unforeseen circumstances, you\'ll receive a full refund or the option to transfer your booking to another available trip. We always prioritize your safety and will communicate any changes as early as possible.',
  },
  {
    id: 7,
    question: 'Are the trips safe for solo travelers?',
    answer: 'Yes! Our trips are designed to be safe and welcoming for all travelers, including solo adventurers. You\'ll be part of a group with experienced guides, and we ensure all accommodations and activities meet safety standards. Many solo travelers join our trips and make lasting friendships.',
  },
  {
    id: 8,
    question: 'How do I become an admin to create trips?',
    answer: 'Admin access is granted by our team. If you\'re interested in becoming an admin to help manage trips, please contact us at Contact@ghumakkars.in with your request. We review applications based on experience and commitment to providing quality travel experiences.',
  },
];

export default function FAQ() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [message, setMessage] = useState('');

  const toggleFAQ = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const contactReason = reason === 'custom' ? customReason : reason;
    const whatsappMessage = `Hello! I'd like to get in touch.\n\n*Name:* ${name}\n*Email:* ${email}\n*Reason:* ${contactReason}\n*Message:* ${message}`;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappUrl = `https://wa.me/918384826414?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-white border-t border-purple-100 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollAnimation className="text-center mb-12 md:mb-16 lg:mb-20 px-4">
          <div className="inline-flex items-center justify-center mb-4 md:mb-6">
            <HelpCircle className="h-8 w-8 md:h-10 md:w-10 text-purple-600 mr-3" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-light leading-relaxed">
            Find answers to common questions about booking, pricing, and our travel experiences
          </p>
        </ScrollAnimation>

        <div className="space-y-4 md:space-y-5">
          {faqs.map((faq, index) => (
            <ScrollAnimation key={faq.id} delay={index * 50}>
              <div className="bg-white border-2 border-purple-100 rounded-xl md:rounded-2xl overflow-hidden transition-all duration-300 hover:border-purple-200 hover:shadow-lg">
              <button
                onClick={() => toggleFAQ(faq.id)}
                className="w-full px-5 md:px-6 lg:px-8 py-4 md:py-5 flex items-center justify-between text-left group"
                aria-expanded={openId === faq.id}
              >
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-gray-900 pr-4 tracking-tight group-hover:text-purple-600 transition-colors">
                  {faq.question}
                </h3>
                <ChevronDown
                  className={`h-5 w-5 md:h-6 md:w-6 text-purple-600 flex-shrink-0 transition-transform duration-300 ${
                    openId === faq.id ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openId === faq.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-5 md:px-6 lg:px-8 pb-4 md:pb-5 lg:pb-6">
                  <div className="pt-2 border-t border-purple-100">
                    <p className="text-sm md:text-base text-gray-600 font-light leading-relaxed pt-4">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </ScrollAnimation>
          ))}
        </div>

        <ScrollAnimation className="mt-12 md:mt-16 lg:mt-20">
          <div className="bg-gradient-to-br from-purple-50/50 to-white border-2 border-purple-100 rounded-xl md:rounded-2xl p-6 md:p-8 lg:p-10 shadow-lg">
            <div className="text-center mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-light text-gray-900 mb-2 tracking-tight">
                Still have questions?
              </h3>
              <p className="text-sm md:text-base text-gray-600 font-light">
                Get in touch with us and we&apos;ll get back to you soon
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
              <div>
                <label htmlFor="contact-name" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base rounded-lg transition-all"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Your Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base rounded-lg transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-reason" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Reason for Contacting
                </label>
                <div className="relative">
                  <HelpCircle className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400 pointer-events-none z-10" />
                  <select
                    id="contact-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base rounded-lg transition-all appearance-none bg-white cursor-pointer text-gray-900"
                  >
                    <option value="" className="text-gray-500">Select a reason</option>
                    <option value="General Inquiry" className="text-gray-900">General Inquiry</option>
                    <option value="Booking Question" className="text-gray-900">Booking Question</option>
                    <option value="Trip Information" className="text-gray-900">Trip Information</option>
                    <option value="Payment Issue" className="text-gray-900">Payment Issue</option>
                    <option value="Cancellation Request" className="text-gray-900">Cancellation Request</option>
                    <option value="Partnership" className="text-gray-900">Partnership</option>
                    <option value="Feedback" className="text-gray-900">Feedback</option>
                    <option value="custom" className="text-gray-900">Other (Custom)</option>
                  </select>
                  <ChevronDown className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400 pointer-events-none" />
                </div>
              </div>

              {reason === 'custom' && (
                <div>
                  <label htmlFor="custom-reason" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Please Specify
                  </label>
                  <div className="relative">
                    <HelpCircle className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                    <input
                      id="custom-reason"
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      required={reason === 'custom'}
                      className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base rounded-lg transition-all"
                      placeholder="Please specify your reason"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="contact-message" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Your Message
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 md:left-4 top-4 h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-3.5 border-2 border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none text-sm md:text-base rounded-lg transition-all resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-600 text-white py-3.5 md:py-4 text-sm md:text-base font-semibold tracking-wide uppercase hover:bg-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 rounded-lg shadow-lg hover:shadow-xl"
              >
                <Phone className="h-4 w-4 md:h-5 md:w-5" />
                <span>Send via WhatsApp</span>
                <Send className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </form>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

