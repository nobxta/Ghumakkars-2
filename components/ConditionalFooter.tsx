'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

// Routes where the public footer + bottom nav should be hidden
const HIDDEN_FOOTER_ROUTES = [
  '/trips/[id]/book',
  '/admin',
  '/auth',
];

function shouldHide(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/auth')) return true;
  // Match /trips/<anything>/book and similar checkout flows
  if (/^\/trips\/[^/]+\/book(?:\/.*)?$/.test(pathname)) return true;
  if (/^\/bookings\/[^/]+\/(?:pay|payment).*$/.test(pathname)) return true;
  return false;
}

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (shouldHide(pathname)) return null;
  return (
    <>
      <Footer />
      <BottomNav />
    </>
  );
}
