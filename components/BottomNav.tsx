'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, User, Wallet, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function BottomNav() {
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const supabase = createClient();

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

  // Only show bottom nav for logged-in users on mobile, but not for admin routes
  if (!user) return null;
  if (pathname?.startsWith('/admin')) return null;

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/bookings', icon: Calendar, label: 'Bookings' },
    { href: '/wallet', icon: Wallet, label: 'Wallet' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-purple-100 shadow-lg">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-purple-600'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${active ? 'scale-110' : ''} transition-transform`} />
              <span className={`text-xs font-medium ${active ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

