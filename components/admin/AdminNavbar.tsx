'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MapPin, LogOut, User, Menu } from 'lucide-react';

interface AdminNavbarProps {
  onMenuToggle: () => void;
  onDesktopCollapseToggle?: () => void;
  isCollapsed?: boolean;
}

export default function AdminNavbar({
  onMenuToggle,
  onDesktopCollapseToggle,
  isCollapsed = false,
}: AdminNavbarProps) {
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, email')
        .eq('id', user.id)
        .single();
      if (!cancelled) setProfile(data);
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const displayName = profile?.full_name || profile?.first_name || 'Admin';
  const displayInitial = (displayName || 'A').charAt(0).toUpperCase();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200/80 h-14 transition-all">
      <div className="flex items-center justify-between h-full px-3 sm:px-5">
        {/* Left: Mobile drawer toggle / Desktop collapse toggle & Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Mobile drawer toggle */}
          <button
            onClick={onMenuToggle}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop sidebar toggle button */}
          {onDesktopCollapseToggle && (
            <button
              onClick={onDesktopCollapseToggle}
              className="hidden md:flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:text-[#7541F5] hover:bg-purple-50 hover:border-purple-200 transition"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Brand Logo & ADMIN Badge */}
          <Link href="/admin" className="flex items-center space-x-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7541F5] text-white shadow-xs group-hover:bg-[#6332DE] transition">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Ghumakkars
            </span>
            <span className="px-1.5 py-0.5 bg-[#F3EEFF] text-[#7541F5] border border-[#DDD6FE] text-[10px] font-bold rounded uppercase tracking-wider">
              ADMIN
            </span>
          </Link>
        </div>

        {/* Right: Administrator profile and Sign Out */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden sm:flex items-center space-x-2.5 text-sm">
            <div className="text-right">
              <div className="font-semibold text-xs sm:text-sm text-slate-900 leading-tight">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Administrator</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-[#7541F5] font-semibold text-xs shadow-xs">
              {displayInitial || <User className="h-4 w-4 text-[#7541F5]" />}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-slate-200 hover:border-rose-200 text-xs font-semibold"
            aria-label="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
