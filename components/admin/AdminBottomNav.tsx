'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Calendar, Users, Settings, Tag, MoreHorizontal, CreditCard } from 'lucide-react';
import { useState } from 'react';

export default function AdminBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const primaryItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Home' },
    { href: '/admin/trips', icon: MapPin, label: 'Trips' },
    { href: '/admin/bookings', icon: Calendar, label: 'Bookings' },
    { href: '/admin/users', icon: Users, label: 'Users' },
  ];

  const moreItems = [
    { href: '/admin/payments', icon: CreditCard, label: 'Payments' },
    { href: '/admin/coupons', icon: Tag, label: 'Coupons' },
    { href: '/admin/referrals', icon: Users, label: 'Referrals' },
    { href: '/admin/analytics', icon: LayoutDashboard, label: 'Analytics' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname?.startsWith(href);
  };

  const isMoreActive = moreItems.some(item => isActive(item.href));

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-[4.5rem] left-0 right-0 bg-white border-t-2 border-purple-200 rounded-t-2xl shadow-2xl p-3 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center py-3 px-1 rounded-xl transition-all ${
                      active
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-purple-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-purple-200 shadow-[0_-2px_10px_rgba(168,85,247,0.1)]">
        <div className="flex items-center justify-around h-14 px-1 max-w-lg mx-auto">
          {primaryItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full py-1.5 rounded-xl transition-all ${
                  active
                    ? 'text-purple-700'
                    : 'text-gray-500'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${
                  active ? 'bg-purple-100 shadow-sm' : ''
                }`}>
                  <Icon className={`h-5 w-5 ${active ? 'text-purple-600' : ''}`} />
                </div>
                <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-purple-700' : ''}`}>
                  {item.label}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-purple-500 mt-0.5" />}
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center w-full py-1.5 rounded-xl transition-all ${
              showMore || isMoreActive ? 'text-purple-700' : 'text-gray-500'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${
              showMore || isMoreActive ? 'bg-purple-100 shadow-sm' : ''
            }`}>
              <MoreHorizontal className={`h-5 w-5 ${showMore || isMoreActive ? 'text-purple-600' : ''}`} />
            </div>
            <span className={`text-[10px] mt-0.5 font-medium ${showMore || isMoreActive ? 'text-purple-700' : ''}`}>
              More
            </span>
            {isMoreActive && !showMore && <div className="w-1 h-1 rounded-full bg-purple-500 mt-0.5" />}
          </button>
        </div>
      </nav>
    </>
  );
}
