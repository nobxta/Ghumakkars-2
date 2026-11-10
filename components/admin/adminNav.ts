import {
  LayoutDashboard,
  MapPin,
  Calendar,
  Users,
  Settings,
  BarChart3,
  Tag,
  Gift,
  CreditCard,
  Bug,
  BookUser,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra words the quick-search (Ctrl/⌘ K) should match. */
  keywords?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Single source of truth for the admin shell: sidebar, drawer, breadcrumb, quick search. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview stats' },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, keywords: 'reports charts revenue' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/trips', label: 'Trips', icon: MapPin, keywords: 'tours packages departures' },
      { href: '/admin/bookings', label: 'Bookings', icon: Calendar, keywords: 'orders reservations passengers' },
      { href: '/admin/payments', label: 'Payments', icon: CreditCard, keywords: 'transactions refunds upi cash' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, keywords: 'customers accounts registered' },
      { href: '/admin/contacts', label: 'Contacts', icon: BookUser, keywords: 'leads enquiries messages' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/admin/coupons', label: 'Coupons', icon: Tag, keywords: 'discounts promo codes' },
      { href: '/admin/referrals', label: 'Referrals', icon: Gift, keywords: 'rewards wallet invite' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/error-logs', label: 'Error Logs', icon: Bug, keywords: 'bugs errors issues' },
      { href: '/admin/settings', label: 'Settings', icon: Settings, keywords: 'config payment whatsapp smtp' },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

export function isAdminNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Breadcrumb trail for the current admin path, e.g. ["Bookings", "Details"]. */
export function adminBreadcrumb(pathname: string | null): { label: string; href?: string }[] {
  if (!pathname || pathname === '/admin') return [{ label: 'Dashboard' }];
  const item = ADMIN_NAV_ITEMS.filter((i) => i.href !== '/admin').find((i) => isAdminNavActive(pathname, i.href));
  if (!item) return [{ label: 'Admin' }];
  const rest = pathname.slice(item.href.length).split('/').filter(Boolean);
  if (rest.length === 0) return [{ label: item.label }];
  const last = rest[rest.length - 1];
  const leaf = last === 'new' ? 'New' : last === 'edit' ? 'Edit' : 'Details';
  return [{ label: item.label, href: item.href }, { label: leaf }];
}
