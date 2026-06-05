'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MapPin, LogOut, User, Menu, X } from 'lucide-react';

export default function AdminNavbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', user.id)
        .single();
      if (!cancelled) setProfile(data);
    };
    loadProfile();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-purple-200 shadow-sm h-12 sm:h-14 md:h-16" style={{ boxShadow: '0 2px 10px rgba(168, 85, 247, 0.1)' }}>
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left: Menu toggle and Logo */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuToggle}
            className="hidden text-gray-700 hover:text-purple-600 transition-colors p-2 neon-button rounded-lg"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/admin" className="flex items-center space-x-1.5 sm:space-x-2 group">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-md sm:rounded-lg">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-gray-900">
              Ghumakkars
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[8px] sm:text-[10px] font-bold rounded sm:rounded-md uppercase">
              Admin
            </span>
          </Link>
        </div>

        {/* Right: User info and sign out */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-3 text-sm">
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                {profile?.full_name || profile?.first_name || 'Admin'}
              </div>
              <div className="text-xs text-gray-500">Administrator</div>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md sm:rounded-lg transition-all border border-gray-200 hover:border-red-300"
          >
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline text-xs sm:text-sm font-semibold">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

