'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';

const COLLAPSE_KEY = 'gk_admin_sidebar_collapsed';

/**
 * Client shell for the admin panel. Only rendered after server layout
 * has verified the user is an admin.
 */
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Remember the collapsed state per browser.
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch { /* storage blocked */ }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  }, []);

  // "[" toggles the sidebar (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans antialiased">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <AdminNavbar onMenuToggle={() => setSidebarOpen(true)} isCollapsed={sidebarCollapsed} />
      <main
        className={`pt-14 pb-16 md:pt-16 md:pb-8 min-h-screen transition-[margin] duration-200 ease-out ${
          sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
        }`}
      >
        <div className="px-3 sm:px-6 py-4 sm:py-6 w-full max-w-[1720px] mx-auto">
          {children}
        </div>
      </main>
      <AdminBottomNav />
    </div>
  );
}
