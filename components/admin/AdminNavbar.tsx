'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MapPin,
  LogOut,
  Menu,
  Search,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Settings,
  Plus,
  Keyboard,
} from 'lucide-react';
import { adminBreadcrumb } from '@/components/admin/adminNav';
import CommandSearch from '@/components/admin/live/CommandSearch';
import NotificationBell from '@/components/admin/live/NotificationBell';
import { useAdminLive } from '@/components/admin/live/AdminLiveProvider';

interface AdminNavbarProps {
  onMenuToggle: () => void;
  isCollapsed?: boolean;
}

/* ───────────────────────────────── Navbar ───────────────────────────────── */

export default function AdminNavbar({ onMenuToggle, isCollapsed = false }: AdminNavbarProps) {
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { openQuickAdd, openShortcuts, setOverlay } = useAdminLive();

  useEffect(() => setOverlay('search', searchOpen), [searchOpen, setOverlay]);
  useEffect(() => setOverlay('profile', menuOpen), [menuOpen, setOverlay]);

  // Other parts of the admin (e.g. Quick add → Find) can open search.
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener('admin:open-search', open);
    return () => window.removeEventListener('admin:open-search', open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setEmail(user.email || '');
      const { data } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name, email, avatar_url')
        .eq('id', user.id)
        .single();
      if (!cancelled) setProfile(data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  // Ctrl/⌘ K opens quick search from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close profile menu on outside click / Escape / navigation.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const fullName =
    profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Admin';
  const displayEmail = profile?.email || email;
  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join('') || 'A';

  const crumbs = adminBreadcrumb(pathname);

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-30 h-14 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-[left] duration-200 ease-out md:h-16 ${
          isCollapsed ? 'md:left-[72px]' : 'md:left-64'
        }`}
      >
        <div className="flex h-full items-center gap-3 px-3 sm:px-6">
          {/* Mobile: menu + brand */}
          <button
            onClick={onMenuToggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/admin" className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-900">Admin</span>
          </Link>

          {/* Desktop: breadcrumb */}
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
            <Link href="/admin" className="font-medium text-slate-400 transition hover:text-slate-700">
              Admin
            </Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                {c.href ? (
                  <Link href={c.href} className="truncate font-medium text-slate-400 transition hover:text-slate-700">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-slate-900">{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Quick search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-60 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white lg:flex"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search anything…</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                {isMac ? '⌘' : 'Ctrl'} K
              </kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Search pages"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            <NotificationBell />

            <button
              onClick={openQuickAdd}
              className="hidden h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:flex"
              title="Create new (N)"
            >
              <Plus className="h-4 w-4" /> New
              <kbd className="rounded bg-white/20 px-1 text-[10px] font-semibold">N</kbd>
            </button>

            <Link
              href="/"
              target="_blank"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:flex"
              title="View website"
              aria-label="View website"
            >
              <ExternalLink className="h-[18px] w-[18px]" />
            </Link>

            <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

            {/* Profile menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1.5 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#7541F5]/40 sm:pr-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-xs font-bold text-white">
                    {initials}
                  </span>
                )}
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[140px] truncate text-[13px] font-semibold text-slate-900">{fullName}</span>
                  <span className="block text-[11px] font-medium text-slate-500">Administrator</span>
                </span>
                <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-slide-down"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
                    {displayEmail && <p className="truncate text-xs text-slate-500">{displayEmail}</p>}
                  </div>
                  <div className="p-1.5">
                    <Link href="/admin/settings" role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                      <Settings className="h-4 w-4 text-slate-400" /> Settings
                    </Link>
                    <button onClick={() => { setMenuOpen(false); openShortcuts(); }} role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                      <Keyboard className="h-4 w-4 text-slate-400" /> Keyboard shortcuts <kbd className="ml-auto rounded border border-slate-200 px-1.5 text-[10px] text-slate-400">?</kbd>
                    </button>
                    <Link href="/" target="_blank" role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                      <ExternalLink className="h-4 w-4 text-slate-400" /> View website
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 p-1.5">
                    <button
                      onClick={handleSignOut}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
