import {
  CheckCircle2,
  Clock,
  Lock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Download,
  Compass,
  RefreshCw,
  Headset,
  type LucideIcon,
} from 'lucide-react';
import { CONTACT } from '@/lib/contact';

/** The six booking states this page can render. */
export type StatusKey =
  | 'pending'
  | 'remaining_submitted'
  | 'seat_locked'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

/** How the Compact Payment Summary block renders. */
export type PaymentVariant = 'paid' | 'verifying' | 'awaiting' | 'seat_locked' | 'failed' | 'cancelled';

export interface ActionDef {
  label: string;
  href: string;
  variant: 'primary' | 'ghost';
  icon?: LucideIcon;
  /** Opens in a new tab (downloads, support). */
  external?: boolean;
}

export interface StatusConfig {
  key: StatusKey;
  /** `vibrant` = white text on a saturated gradient. `light` = dark text on a soft tint. */
  surface: 'vibrant' | 'light';
  /** Radial background gradient for the hero. */
  gradient: string;
  /** Status accent hex (badges, icons, amounts). */
  accent: string;
  /** Long-shadow tint for the glass card, harmonised with the background hue. */
  glassShadow: string;
  Icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  paymentVariant: PaymentVariant;
  showNextSteps: boolean;
  confetti: boolean;
  actions: ActionDef[];
  /** Optional muted tertiary link under the actions. */
  tertiary?: { label: string; href: string };
}

interface ConfigContext {
  bookingId: string;
  /** A payment has been submitted but not yet verified. */
  hasSubmitted: boolean;
}

const VIEW = (id: string): ActionDef => ({ label: 'View Booking', href: `/bookings/${id}`, variant: 'primary', icon: ArrowRight });
const MORE_TRIPS: ActionDef = { label: 'More trips', href: '/trips', variant: 'ghost', icon: Compass };
const EXPLORE: ActionDef = { label: 'Explore Trips', href: '/trips', variant: 'primary', icon: Compass };
const SUPPORT: ActionDef = { label: 'Contact Support', href: CONTACT.whatsappLink, variant: 'ghost', icon: Headset, external: true };

/**
 * Single source of truth for the presentation of each booking status.
 * The page stays one layout; only these tokens change.
 */
export function getStatusConfig(status: string, ctx: ConfigContext): StatusConfig {
  const { bookingId, hasSubmitted } = ctx;

  switch (status) {
    case 'confirmed':
      return {
        key: 'confirmed',
        surface: 'vibrant',
        gradient: 'radial-gradient(circle at center, #34d399 0%, #059669 100%)',
        accent: '#059669',
        glassShadow: '0 20px 40px -10px rgba(0,68,41,0.18)',
        Icon: CheckCircle2,
        badge: 'Booking Confirmed',
        title: "You're All Set! 🎉",
        description: 'Your payment has been verified successfully. Your booking is confirmed — we’re excited to travel with you.',
        paymentVariant: 'paid',
        showNextSteps: false,
        confetti: true,
        actions: [VIEW(bookingId), { label: 'Download Ticket', href: `/api/bookings/${bookingId}/ticket`, variant: 'ghost', icon: Download, external: true }],
      };

    case 'seat_locked':
      return {
        key: 'seat_locked',
        surface: 'vibrant',
        gradient: 'radial-gradient(circle at center, #FF8C00 0%, #EA5455 100%)',
        accent: '#E8730A',
        glassShadow: '0 20px 40px -10px rgba(120,53,15,0.22)',
        Icon: Lock,
        badge: 'Seat Locked',
        title: 'Your Seat Is Locked!',
        description: 'Pay the remaining amount before the deadline to confirm your booking.',
        paymentVariant: 'seat_locked',
        showNextSteps: false,
        confetti: false,
        actions: [{ label: 'Pay Remaining', href: `/bookings/${bookingId}`, variant: 'primary', icon: ArrowRight }, MORE_TRIPS],
      };

    case 'remaining_submitted':
      return {
        key: 'remaining_submitted',
        surface: 'vibrant',
        gradient: 'radial-gradient(circle at center, #2f6fd0 0%, #0b4aa2 100%)',
        accent: '#0054b5',
        glassShadow: '0 20px 40px -10px rgba(0,33,82,0.22)',
        Icon: Clock,
        badge: 'Payment Received',
        title: 'Remaining Payment Received!',
        description: "We've received your remaining payment. Our team is verifying it before confirming your booking.",
        paymentVariant: 'verifying',
        showNextSteps: true,
        confetti: false,
        actions: [VIEW(bookingId), EXPLORE],
      };

    case 'rejected':
      return {
        key: 'rejected',
        surface: 'light',
        gradient: 'radial-gradient(circle at center, #ffdad6 0%, #f9f9ff 70%)',
        accent: '#EA5455',
        glassShadow: '0 20px 40px -10px rgba(186,26,26,0.12)',
        Icon: AlertCircle,
        badge: 'Verification Failed',
        title: "We Couldn't Verify Your Payment",
        description: 'Unfortunately we couldn’t verify your payment. If you believe this is incorrect, please contact our support team or retry your payment.',
        paymentVariant: 'failed',
        showNextSteps: false,
        confetti: false,
        actions: [{ label: 'Retry Payment', href: `/bookings/${bookingId}`, variant: 'primary', icon: RefreshCw }, SUPPORT],
        tertiary: { label: 'Back to My Bookings', href: '/bookings' },
      };

    case 'cancelled':
      return {
        key: 'cancelled',
        surface: 'vibrant',
        gradient: 'radial-gradient(circle at top center, #9da4b0 0%, #82868B 100%)',
        accent: '#5d626b',
        glassShadow: '0 20px 40px -10px rgba(40,43,48,0.22)',
        Icon: XCircle,
        badge: 'Booking Cancelled',
        title: 'Booking Cancelled',
        description: 'This booking has been cancelled. If you need assistance, our support team is here to help.',
        paymentVariant: 'cancelled',
        showNextSteps: false,
        confetti: false,
        actions: [EXPLORE, SUPPORT],
      };

    // `pending` and any unknown status fall back to "Booking Received".
    default:
      return {
        key: 'pending',
        surface: 'vibrant',
        gradient: 'radial-gradient(circle at center, #4A90E2 0%, #0054b5 100%)',
        accent: '#0054b5',
        glassShadow: '0 20px 40px -10px rgba(0,33,82,0.22)',
        Icon: Clock,
        badge: hasSubmitted ? 'Verifying' : 'Booking Received',
        title: 'Booking Received!',
        description: hasSubmitted
          ? "We've received your booking and payment details. Our team is verifying your payment — you'll get a confirmation on Email and WhatsApp shortly."
          : 'We’ve received your booking. Our team will contact you shortly to collect payment and confirm your trip.',
        paymentVariant: hasSubmitted ? 'verifying' : 'awaiting',
        showNextSteps: hasSubmitted,
        confetti: false,
        actions: [VIEW(bookingId), MORE_TRIPS],
      };
  }
}
