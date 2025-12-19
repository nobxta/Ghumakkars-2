'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MapPin, LogOut, User, Menu, X } from 'lucide-react';

export default function AdminNavbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData?.role !== 'admin') {
        router.push('/');
        return;
      }

      setUser(user);
      setProfile(profileData);
    };

    getUser();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-purple-300 shadow-xl h-16 md:h-20" style={{ boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)' }}>
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Left: Menu toggle and Logo */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuToggle}
            className="md:hidden text-gray-700 hover:text-purple-600 transition-colors p-2 neon-button rounded-lg"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/admin" className="flex items-center space-x-2 group">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <MapPin className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight text-gray-900">
              Ghumakkars
            </span>
            <span className="hidden md:inline-block px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold rounded-lg uppercase shadow-lg">
              Admin
            </span>
          </Link>
        </div>

        {/* Right: User info and sign out */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-3 text-sm">
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                {profile?.full_name || user?.user_metadata?.full_name || 'Admin'}
              </div>
              <div className="text-xs text-gray-500">Administrator</div>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border-2 border-gray-200 hover:border-red-300 hover:shadow-lg"
          >
            <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            <span className="hidden md:inline text-sm font-semibold">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

