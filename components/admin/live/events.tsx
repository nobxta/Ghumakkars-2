'use client';

import { UserPlus, Ticket, Receipt, Wallet, XCircle, Ban } from 'lucide-react';

export type ActivityType = 'signup' | 'booking' | 'payment_pending' | 'payment_received' | 'payment_rejected' | 'cancelled';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  at: string;
  title: string;
  meta: string;
  href: string;
  amount?: number;
  approval?: any;
}

export const EVENT_STYLE: Record<ActivityType, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  signup: { icon: UserPlus, tone: 'bg-violet-50 text-violet-600' },
  booking: { icon: Ticket, tone: 'bg-sky-50 text-sky-600' },
  payment_pending: { icon: Receipt, tone: 'bg-amber-50 text-amber-600' },
  payment_received: { icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
  payment_rejected: { icon: XCircle, tone: 'bg-rose-50 text-rose-600' },
  cancelled: { icon: Ban, tone: 'bg-slate-100 text-slate-500' },
};

export function EventIcon({ type, size = 'h-8 w-8' }: { type: ActivityType; size?: string }) {
  const s = EVENT_STYLE[type] || EVENT_STYLE.booking;
  const Icon = s.icon;
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-lg ${s.tone}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** True when the keyboard focus is in a text field — shortcuts must stay out of the way. */
export function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
