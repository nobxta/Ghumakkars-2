import Link from 'next/link';
import { MapPin, Mail, Phone, Facebook, Instagram, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-white to-purple-50/50 border-t border-purple-200 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-5 flex items-center space-x-2 tracking-tight">
              <MapPin className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              <span>Ghumakkars</span>
            </h3>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 max-w-lg font-light leading-relaxed">
              Empowering Indian university students to explore India&apos;s breathtaking destinations through 
              thoughtfully curated, budget-friendly travel experiences. Join our community of passionate 
              travelers creating unforgettable memories without compromising on adventure.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-purple-400 hover:text-purple-600 transition-colors" aria-label="Facebook">
                <Facebook className="h-5 w-5 md:h-6 md:w-6" />
              </a>
              <a href="#" className="text-purple-400 hover:text-purple-600 transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5 md:h-6 md:w-6" />
              </a>
              <a href="#" className="text-purple-400 hover:text-purple-600 transition-colors" aria-label="Twitter">
                <Twitter className="h-5 w-5 md:h-6 md:w-6" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-4 md:mb-5 tracking-wide uppercase">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm md:text-base text-gray-600 hover:text-purple-600 transition-colors font-light">
                  Home
                </Link>
              </li>
              <li>
                <Link href="#trips" className="text-sm md:text-base text-gray-600 hover:text-purple-600 transition-colors font-light">
                  Explore Trips
                </Link>
              </li>
              <li>
                <Link href="#about" className="text-sm md:text-base text-gray-600 hover:text-purple-600 transition-colors font-light">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/auth/signup" className="text-sm md:text-base text-gray-600 hover:text-purple-600 transition-colors font-light">
                  Join Now
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-4 md:mb-5 tracking-wide uppercase">Get In Touch</h4>
            <ul className="space-y-3 text-sm md:text-base text-gray-600 font-light">
              <li className="flex items-start space-x-2 md:space-x-3">
                <Mail className="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-purple-500" />
                <a href="mailto:Contact@ghumakkars.in" className="hover:text-purple-600 transition-colors">Contact@ghumakkars.in</a>
              </li>
              <li className="flex items-center space-x-2 md:space-x-3">
                <Phone className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
                <a href="tel:+918384826414" className="hover:text-purple-600 transition-colors">+91 8384826414</a>
              </li>
              <li className="flex items-start space-x-2 md:space-x-3">
                <MapPin className="h-4 w-4 md:h-5 md:w-5 mt-0.5 text-purple-500" />
                <span>Mathura, Uttar Pradesh, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-purple-200 text-center">
          <p className="text-xs md:text-sm text-gray-500 tracking-wide uppercase font-light">
            &copy; 2024 Ghumakkars. All rights reserved. Crafted for adventurous students.
          </p>
        </div>
      </div>
    </footer>
  );
}

