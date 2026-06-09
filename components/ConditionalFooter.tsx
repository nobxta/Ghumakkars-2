'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

function isAdminOrAuth(p: string): boolean {
  return p.startsWith('/admin') || p.startsWith('/auth');
}

function isCheckoutFlow(p: string): boolean {
  // Trip booking checkout
  if (/^\/trips\/[^/]+\/book(?:\/.*)?$/.test(p)) return true;
  // Payment / remaining payment flows
  if (/^\/bookings\/[^/]+\/(?:pay|payment).*$/.test(p)) return true;
  return false;
}

/**
 * Footer (big marketing footer) is hidden on:
 * - Admin pages, auth pages
 * - Checkout/booking flows
 * - Logged-in dashboards (profile, wallet, referral, bookings)
 *   because they have their own clean layout
 */
function shouldHideFooter(p: string): boolean {
  if (isAdminOrAuth(p) || isCheckoutFlow(p)) return true;
  if (p.startsWith('/profile')) return true;
  if (p.startsWith('/wallet')) return true;
  if (p.startsWith('/referral')) return true;
  if (p.startsWith('/bookings')) return true;
  if (p.startsWith('/booking-success')) return true;
  return false;
}

/**
 * BottomNav (mobile-only tab bar) is hidden on:
 * - Admin / auth pages
 * - Checkout flows (so the sticky Book bar doesn't compete)
 */
function shouldHideBottomNav(p: string): boolean {
  if (isAdminOrAuth(p)) return true;
  if (isCheckoutFlow(p)) return true;
  // Hide on trip detail too — the sticky Book Now bar already lives there
  if (/^\/trips\/[^/]+\/?$/.test(p)) return true;
  if (p.startsWith('/booking-success')) return true;
  return false;
}

export default function ConditionalFooter() {
  const pathname = usePathname() || '';
  const hideFooter = shouldHideFooter(pathname);
  const hideBottomNav = shouldHideBottomNav(pathname);
  return (
    <>
      {!hideFooter && <Footer />}
      {!hideBottomNav && <BottomNav />}
    </>
  );
}
