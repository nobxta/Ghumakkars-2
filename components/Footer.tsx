import Link from 'next/link';
import { MapPin, Mail, Phone, Instagram, MessageCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-white to-purple-50/50 border-t border-purple-200 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 md:gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2 tracking-tight">
              <MapPin className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              <span>Ghumakkars</span>
            </h3>
            <p className="text-sm md:text-base text-gray-600 mb-5 max-w-md font-light leading-relaxed">
              Making India&apos;s most breathtaking destinations accessible to everyone through
              thoughtfully curated, budget-friendly group trips.
            </p>
            <div className="flex space-x-3">
              <a href="https://instagram.com/ghumakkars.in" target="_blank" rel="noopener noreferrer"
                 className="w-9 h-9 rounded-full bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://wa.me/918218020972" target="_blank" rel="noopener noreferrer"
                 className="w-9 h-9 rounded-full bg-green-100 hover:bg-green-600 hover:text-white text-green-700 flex items-center justify-center transition-colors" aria-label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
              <a href="mailto:Contact@ghumakkars.in"
                 className="w-9 h-9 rounded-full bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 flex items-center justify-center transition-colors" aria-label="Email">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs md:text-sm font-bold text-gray-900 mb-4 tracking-wider uppercase">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/" className="text-gray-600 hover:text-purple-600 transition-colors">Home</Link></li>
              <li><Link href="/trips" className="text-gray-600 hover:text-purple-600 transition-colors">All Trips</Link></li>
              <li><Link href="/about" className="text-gray-600 hover:text-purple-600 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-purple-600 transition-colors">Contact</Link></li>
              <li><Link href="/referral" className="text-gray-600 hover:text-purple-600 transition-colors">Refer &amp; Earn</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs md:text-sm font-bold text-gray-900 mb-4 tracking-wider uppercase">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/terms" className="text-gray-600 hover:text-purple-600 transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy" className="text-gray-600 hover:text-purple-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cancellation-policy" className="text-gray-600 hover:text-purple-600 transition-colors">Refund &amp; Cancellation</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-purple-600 transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Get in touch */}
          <div>
            <h4 className="text-xs md:text-sm font-bold text-gray-900 mb-4 tracking-wider uppercase">Get In Touch</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                <a href="mailto:Contact@ghumakkars.in" className="hover:text-purple-600 break-all">Contact@ghumakkars.in</a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                <a href="https://wa.me/918218020972" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600">+91 82180 20972</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <a href="tel:+918218020972" className="hover:text-purple-600">+91 82180 20972</a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                <span>Mathura, Uttar Pradesh, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm text-gray-500">
          <p>&copy; 2026 Ghumakkars. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-purple-600">Terms</Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="hover:text-purple-600">Privacy</Link>
            <span aria-hidden>·</span>
            <Link href="/cancellation-policy" className="hover:text-purple-600">Refunds</Link>
            <span aria-hidden>·</span>
            <Link href="/contact" className="hover:text-purple-600">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
