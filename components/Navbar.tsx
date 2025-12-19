'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { MapPin, Menu, X, LogOut, User, Calendar, Settings, Gift, Wallet, ChevronDown, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
    setProfileOpen(false);
  };

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/trips', label: 'Trips' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/80 backdrop-blur-xl shadow-lg border-b border-purple-100/50' 
        : 'bg-white/95 backdrop-blur-xl border-b border-purple-100/30'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2.5 group relative"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
              <MapPin className="h-6 w-6 md:h-7 md:w-7 text-purple-600 relative z-10 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent tracking-tight">
              Ghumakkars
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? 'text-purple-600'
                    : 'text-gray-700 hover:text-purple-600'
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full"></span>
                )}
              </Link>
            ))}
            
            {user ? (
              <>
                {user.user_metadata?.role === 'admin' && (
                  <Link
                    href="/admin"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive('/admin')
                        ? 'text-purple-600'
                        : 'text-gray-700 hover:text-purple-600'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <div className="relative ml-2" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50 hover:from-purple-100 hover:to-purple-200/70 transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <ChevronDown className={`h-4 w-4 text-purple-600 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-purple-100/50 py-2 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 border-b border-purple-100/50">
                        <p className="text-sm font-semibold text-gray-900">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Manage your account</p>
                      </div>
                      
                      <div className="py-2">
                        <Link
                          href="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50/50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <User className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">My Profile</span>
                        </Link>
                        
                        <Link
                          href="/bookings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50/50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <Calendar className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">My Bookings</span>
                        </Link>
                        
                        <Link
                          href="/profile/edit"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50/50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <Settings className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">Edit Profile</span>
                        </Link>
                        
                        <Link
                          href="/referral"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50/50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <Gift className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">Referral System</span>
                        </Link>
                        
                        <Link
                          href="/wallet"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-purple-50/50 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <Wallet className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">Wallet</span>
                        </Link>
                      </div>
                      
                      <div className="border-t border-purple-100/50 mt-1">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center space-x-3 px-4 py-2.5 text-red-600 hover:bg-red-50/50 transition-colors w-full group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                            <LogOut className="h-4 w-4 text-red-600" />
                          </div>
                          <span className="text-sm font-medium">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="ml-4 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium text-sm hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-purple-50 transition-colors relative"
            aria-label="Toggle menu"
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block h-0.5 bg-gray-700 rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ${
        isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-white/98 backdrop-blur-xl border-t border-purple-100/50 px-4 pt-2 pb-4">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive(link.href)
                    ? 'bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-600 border border-purple-200/50'
                    : 'text-gray-700 hover:bg-purple-50/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {user ? (
              <>
                {user.user_metadata?.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                      isActive('/admin')
                        ? 'bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-600 border border-purple-200/50'
                        : 'text-gray-700 hover:bg-purple-50/50'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                
                <div className="pt-2 mt-2 border-t border-purple-100/50">
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-purple-50/50 transition-colors"
                  >
                    <User className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-sm">Profile</span>
                  </Link>
                  
                  <Link
                    href="/bookings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-purple-50/50 transition-colors"
                  >
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-sm">Bookings</span>
                  </Link>
                  
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      handleSignOut();
                    }}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50/50 transition-colors w-full text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium text-sm">Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/auth/signin"
                onClick={() => setIsOpen(false)}
                className="block mt-4 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium text-sm text-center hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg shadow-purple-500/25"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
