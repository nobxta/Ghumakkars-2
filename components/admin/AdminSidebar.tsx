'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Calendar,
  Users,
  Settings,
  BarChart3,
  X,
  Tag,
  Gift,
  CreditCard,
  Bug,
  BookUser,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AdminSidebar({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [openErrors, setOpenErrors] = useState(0);

  // Badge: unresolved errors in the last 24h. Re-checked on navigation.
  useEffect(() => {
    fetch('/api/admin/error-logs?summary=1', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOpenErrors(data?.unresolved || 0))
      .catch(() => {});
  }, [pathname]);

  const menuItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/trips', icon: MapPin, label: 'Trips' },
    { href: '/admin/bookings', icon: Calendar, label: 'Bookings' },
    { href: '/admin/payments', icon: CreditCard, label: 'Payments' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/contacts', icon: BookUser, label: 'Contacts' },
    { href: '/admin/coupons', icon: Tag, label: 'Coupons' },
    { href: '/admin/referrals', icon: Gift, label: 'Referrals' },
    { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/admin/error-logs', icon: Bug, label: 'Error Logs', badge: openErrors },
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
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7541F5] text-white">
              <MapPin className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Ghumakkars</span>
            <span className="px-1.5 py-0.5 bg-[#F3EEFF] text-[#7541F5] border border-[#DDD6FE] text-[9px] font-bold rounded uppercase">
              ADMIN
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#F3EEFF] text-[#7541F5] font-semibold border-l-4 border-[#7541F5]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4 w-4 ${active ? 'text-[#7541F5]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {!!item.badge && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden md:flex md:flex-col fixed top-14 left-0 bottom-0 bg-white border-r border-slate-200/80 z-30 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center rounded-lg text-sm transition-colors ${
                  isCollapsed ? 'justify-center h-10 px-0' : 'px-3 py-2 justify-between'
                } ${
                  active
                    ? 'bg-[#F3EEFF] text-[#7541F5] font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'}`}>
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active ? 'text-[#7541F5]' : 'text-slate-500 group-hover:text-slate-700'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {/* Badge */}
                {!!item.badge && (
                  isCollapsed ? (
                    <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />
                  ) : (
                    <span className="ml-auto inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Collapse / Expand Toggle at Bottom */}
        {onToggleCollapse && (
          <div className="p-2 border-t border-slate-100">
            <button
              onClick={onToggleCollapse}
              className={`flex items-center w-full rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 p-2 transition ${
                isCollapsed ? 'justify-center' : 'justify-between'
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {!isCollapsed && <span>Collapse Sidebar</span>}
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
