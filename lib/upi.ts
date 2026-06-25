/**
 * Native UPI deep-link payments — no gateway, no SDK, no API.
 *
 * Money goes straight to our UPI ID. We just build the standard `upi://pay` deep
 * link; the user's installed UPI app (GPay / PhonePe / Paytm / etc.) handles it.
 */

/** Our collecting UPI handle and display name. */
export const UPI_PAYEE_VPA = 'ghumakkars@ybl';
export const UPI_PAYEE_NAME = 'Ghumakkars';

/**
 * Build a UPI deep link:
 *   upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<url-encoded note>
 *
 * The note is URL-encoded. `pa` is left literal (UPI apps expect the raw VPA).
 */
export function generateUpiLink(
  amount: number,
  note: string,
  vpa: string = UPI_PAYEE_VPA,
  name: string = UPI_PAYEE_NAME,
): string {
  const am = Math.max(0, Math.round(Number(amount) || 0)); // whole rupees
  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${am}&cu=INR&tn=${encodeURIComponent(note)}`;
}

/** A unique, human-readable transaction note for a booking payment. */
export function upiNote(kind: 'seat_lock' | 'full' | 'remaining', ref: string): string {
  const label = kind === 'seat_lock' ? 'Seat Lock' : kind === 'remaining' ? 'Remaining Payment' : 'Full Payment';
  return `${label} - ${ref}`;
}

/** Best-effort mobile detection (UPI deep links only work on phones). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

/**
 * Open the UPI app for a deep link. UPI links can't be reliably feature-detected,
 * so we open it and, if the page is still in the foreground shortly after (i.e. no
 * app took over), invoke `onNoApp` to show a fallback message.
 */
export function openUpiApp(link: string, onNoApp?: () => void): void {
  if (typeof window === 'undefined') return;
  let handled = false;
  const markHandled = () => { handled = true; };
  document.addEventListener('visibilitychange', markHandled, { once: true });
  window.addEventListener('blur', markHandled, { once: true });

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markHandled);
    window.removeEventListener('blur', markHandled);
    if (!handled && document.visibilityState === 'visible' && onNoApp) onNoApp();
  }, 1800);

  window.location.href = link;
}
