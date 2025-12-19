'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Calendar, Users, Settings, BarChart3, X, Tag, Gift } from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/trips', icon: MapPin, label: 'Trips' },
    { href: '/admin/bookings', icon: Calendar, label: 'Bookings' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/coupons', icon: Tag, label: 'Coupons' },
    { href: '/admin/referrals', icon: Gift, label: 'Referrals' },
    { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-16 md:top-20 left-0 h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] w-64 bg-white/95 backdrop-blur-md border-r-2 border-purple-300 shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ boxShadow: '4px 0 20px rgba(168, 85, 247, 0.15)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-purple-100 md:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-purple-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-full pb-20">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  active
                    ? 'neon-button bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 border-2 border-purple-400 shadow-lg'
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600 border-2 border-transparent hover:border-purple-200'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-purple-600' : ''}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

