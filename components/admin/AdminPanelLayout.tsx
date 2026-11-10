'use client';

import { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';

/**
 * Client shell for the admin panel. Only rendered after server layout
 * has verified the user is an admin.
 */
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans antialiased">
      <AdminNavbar
        onMenuToggle={() => setSidebarOpen(true)}
        onDesktopCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isCollapsed={sidebarCollapsed}
      />
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={`pt-14 pb-16 md:pb-8 min-h-screen transition-[margin] duration-200 ${
          sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-60'
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
