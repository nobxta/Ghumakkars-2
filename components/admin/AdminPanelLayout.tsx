'use client';

import { useState } from 'react';
import AdminNavbar from '@/components/admin/AdminNavbar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';

/**
 * Client shell for the admin panel. Only rendered after server layout
 * has verified the user is an admin. No auth or loading state here.
 */
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/30 via-white to-purple-50/30">
      <AdminNavbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="md:ml-60 pt-12 sm:pt-14 md:pt-16 pb-20 md:pb-4 min-h-screen">
        <div className="px-4 sm:px-6 py-4 sm:py-6 w-full max-w-[1700px] mx-auto">
          {children}
        </div>
      </main>
      <AdminBottomNav />
    </div>
  );
}
