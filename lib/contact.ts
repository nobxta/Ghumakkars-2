/**
 * Single source of truth for Ghumakkars business contact details.
 *
 * Change the number ONCE here and it updates everywhere: footer, contact page,
 * booking pages, emails, WhatsApp links, JSON-LD, etc.
 */

// Raw digits with country code, no symbols. Used to build links.
const PHONE_DIGITS = '918218020972';

export const CONTACT = {
  /** Digits only, with country code: 918218020972 */
  phoneDigits: PHONE_DIGITS,
  /** Human-readable display: +91 82180 20972 */
  phoneDisplay: '+91 82180 20972',
  /** tel: link */
  phoneLink: `tel:+${PHONE_DIGITS}`,
  /** WhatsApp chat link */
  whatsappLink: `https://wa.me/${PHONE_DIGITS}`,
  /** Emails */
  supportEmail: 'support@ghumakkars.in',
  contactEmail: 'Contact@ghumakkars.in',
  bookingsEmail: 'bookings@ghumakkars.in',
  /** Social */
  instagram: 'https://instagram.com/ghumakkars.in',
  /** Location */
  address: 'Mathura, Uttar Pradesh, India',
  /** Brand */
  brandName: 'Ghumakkars',
  domain: 'ghumakkars.in',
  siteUrl: 'https://www.ghumakkars.in',
} as const;
