import nodemailer from 'nodemailer';
import { renderEmail, renderPlainText, BRAND } from './email-templates';

const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME = process.env.FROM_NAME || 'Ghumakkars';

// Email aliases — all hosted on Hostinger under ghumakkars.in
const EMAIL_ALIASES = {
  noreply: 'no-reply@ghumakkars.in',
  bookings: 'bookings@ghumakkars.in',
  offers: 'offers@ghumakkars.in',
  support: 'support@ghumakkars.in',
  hello: 'hello@ghumakkars.in',
};
const FROM_EMAIL = process.env.FROM_EMAIL || EMAIL_ALIASES.noreply;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

// ─────────────────────────── Authentication / OTP ───────────────────────────

export async function sendLoginOTPEmail(email: string, otp: string) {
  const opts = {
    theme: 'brand' as const,
    preheader: `Your login code: ${otp}`,
    title: 'Sign-in code',
    intro: 'Use this code to complete your sign-in. It expires in 10 minutes.',
    code: { label: 'Your code', value: otp, sub: 'Expires in 10 minutes' },
    outro: "If you didn't try to sign in, you can ignore this email — your account is safe.",
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.noreply}>`,
    to: email,
    subject: `${otp} is your sign-in code`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendSignupOTPEmail(email: string, otp: string, firstName?: string) {
  const opts = {
    theme: 'brand' as const,
    preheader: `Verify your email with code ${otp}`,
    title: 'Verify your email',
    greeting: firstName ? `Hi ${firstName},` : 'Welcome!',
    intro: 'Use this code to verify your email and finish creating your Ghumakkars account.',
    code: { label: 'Verification code', value: otp, sub: 'Expires in 10 minutes' },
    outro: "If you didn't request this, you can safely ignore the email.",
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.noreply}>`,
    to: email,
    subject: `${otp} — verify your email`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendOTPEmail(email: string, otp: string) {
  return sendLoginOTPEmail(email, otp);
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const opts = {
    theme: 'brand' as const,
    preheader: 'Reset your Ghumakkars password',
    title: 'Reset your password',
    intro: 'Click the button below to set a new password. The link expires in 1 hour.',
    cta: { label: 'Reset password', url: resetLink },
    outro: "If you didn't request a password reset, you can ignore this email.",
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.noreply}>`,
    to: email,
    subject: 'Reset your Ghumakkars password',
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

// ─────────────────────────── Bookings ───────────────────────────

export async function sendBookingReceivedEmail(
  email: string,
  userName: string,
  bookingDetails: { bookingId: string; tripTitle: string; destination: string }
) {
  const opts = {
    theme: 'pending' as const,
    preheader: `Booking received for ${bookingDetails.tripTitle}`,
    title: 'We got your booking',
    statusPill: 'Under review',
    greeting: `Hi ${userName},`,
    intro: 'Thanks for booking with Ghumakkars. Our team is reviewing your booking and payment — we\'ll confirm shortly.',
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Destination', value: bookingDetails.destination },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId), highlight: true },
    ],
    cta: { label: 'View booking', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: 'Most bookings are reviewed within a few hours. Sit tight — we\'ll be in touch.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `We got your booking — ${bookingDetails.tripTitle}`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendBookingConfirmedEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    tripTitle: string;
    destination: string;
    startDate: string;
    endDate?: string;
    totalAmount: number;
    whatsappGroupLink?: string;
  }
) {
  const dateRange = bookingDetails.endDate
    ? `${fmtDate(bookingDetails.startDate)} → ${fmtDate(bookingDetails.endDate)}`
    : fmtDate(bookingDetails.startDate);

  const opts = {
    theme: 'success' as const,
    preheader: `Your booking for ${bookingDetails.tripTitle} is confirmed`,
    title: 'You\'re booked!',
    statusPill: 'Confirmed',
    greeting: `Hi ${userName},`,
    intro: 'Your seat is locked in. Get ready for an unforgettable trip — here are the details.',
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Destination', value: bookingDetails.destination },
      { label: 'Dates', value: dateRange },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
      { label: 'Amount paid', value: fmtINR(bookingDetails.totalAmount), highlight: true },
    ],
    highlight: bookingDetails.whatsappGroupLink
      ? {
          label: 'Join your trip group',
          lines: [
            'Connect with fellow travellers and get live trip updates:',
            `<a href="${bookingDetails.whatsappGroupLink}" style="color:#16a34a;font-weight:600;text-decoration:none;word-break:break-all;">${bookingDetails.whatsappGroupLink}</a>`,
          ],
        }
      : undefined,
    cta: { label: 'View booking', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: 'You\'ll get a detailed pre-trip brief about a week before departure — packing list, pickup point, contact for your trip leader. Until then, start dreaming of the mountains.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `🎉 Booking confirmed — ${bookingDetails.tripTitle}`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendSeatLockConfirmedEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    tripTitle: string;
    destination: string;
    startDate: string;
    endDate?: string;
    seatLockAmount: number;
    remainingAmount: number;
    dueDate: string;
    whatsappGroupLink?: string;
  }
) {
  const dateRange = bookingDetails.endDate
    ? `${fmtDate(bookingDetails.startDate)} → ${fmtDate(bookingDetails.endDate)}`
    : fmtDate(bookingDetails.startDate);

  const opts = {
    theme: 'warning' as const,
    preheader: `Seat locked — ${fmtINR(bookingDetails.remainingAmount)} due by ${fmtDate(bookingDetails.dueDate)}`,
    title: 'Your seat is locked',
    statusPill: 'Seat locked',
    greeting: `Hi ${userName},`,
    intro: 'We\'ve reserved your spot. Pay the remaining amount before the due date to keep it confirmed.',
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Destination', value: bookingDetails.destination },
      { label: 'Dates', value: dateRange },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
      { label: 'Seat lock paid', value: fmtINR(bookingDetails.seatLockAmount) },
    ],
    highlight: {
      label: 'Remaining payment',
      lines: [
        `<strong style="font-size:20px;color:#ea580c;">${fmtINR(bookingDetails.remainingAmount)}</strong> due by <strong>${fmtDate(bookingDetails.dueDate)}</strong>`,
        'If we don\'t receive the balance by then, your seat will be released and the lock amount becomes non-refundable.',
      ],
    },
    cta: { label: 'Pay remaining now', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: bookingDetails.whatsappGroupLink
      ? `Once you complete payment you'll be added to the trip WhatsApp group. Join early: <a href="${bookingDetails.whatsappGroupLink}" style="color:#ea580c;">trip group</a>.`
      : 'You\'ll get payment reminders. Reply to this email or message us on WhatsApp if anything changes.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `🔒 Seat locked — pay ${fmtINR(bookingDetails.remainingAmount)} by ${fmtDate(bookingDetails.dueDate)}`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendBookingRejectedEmail(
  email: string,
  userName: string,
  bookingDetails: { bookingId: string; tripTitle: string; destination: string; reason: string }
) {
  const opts = {
    theme: 'danger' as const,
    preheader: `Your booking couldn't be confirmed`,
    title: 'Booking not confirmed',
    statusPill: 'Cancelled',
    greeting: `Hi ${userName},`,
    intro: `We weren't able to confirm your booking for ${bookingDetails.tripTitle}. Details below.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Destination', value: bookingDetails.destination },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
    ],
    highlight: {
      label: 'Reason',
      lines: [bookingDetails.reason],
      tone: 'danger' as const,
    },
    cta: { label: 'Browse other trips', url: `${SITE_URL}/trips` },
    outro: 'Any amount you paid will be refunded to your original payment method within 5–7 business days. If you think this is a mistake, reply to this email and we\'ll look into it right away.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Booking not confirmed — ${bookingDetails.tripTitle}`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendPaymentReminderEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    tripTitle: string;
    destination: string;
    startDate: string;
    remainingAmount: number;
    dueDate: string;
  }
) {
  const opts = {
    theme: 'warning' as const,
    preheader: `Reminder — ${fmtINR(bookingDetails.remainingAmount)} due by ${fmtDate(bookingDetails.dueDate)}`,
    title: 'Friendly payment reminder',
    statusPill: 'Payment due',
    greeting: `Hi ${userName},`,
    intro: 'A quick reminder — your remaining payment is due soon. Pay now to keep your seat confirmed.',
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Destination', value: bookingDetails.destination },
      { label: 'Departs', value: fmtDate(bookingDetails.startDate) },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
    ],
    highlight: {
      label: 'Amount due',
      lines: [
        `<strong style="font-size:20px;color:#ea580c;">${fmtINR(bookingDetails.remainingAmount)}</strong> by <strong>${fmtDate(bookingDetails.dueDate)}</strong>`,
      ],
    },
    cta: { label: 'Complete payment', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: 'Already paid? You can ignore this — payments take a few minutes to reflect. Questions? Reply to this email or message us on WhatsApp.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Reminder: ${fmtINR(bookingDetails.remainingAmount)} due by ${fmtDate(bookingDetails.dueDate)}`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

// ─────────────────────────── Offers / Coupons ───────────────────────────

export async function sendCouponEmail(
  email: string,
  userName: string,
  couponDetails: {
    couponCode: string;
    discountAmount: number;
    expiryDate: string | null;
    description: string;
  }
) {
  const opts = {
    theme: 'offer' as const,
    preheader: `${couponDetails.couponCode} — save ${fmtINR(couponDetails.discountAmount)} on your next trip`,
    title: `You've got a gift`,
    statusPill: 'Coupon',
    greeting: userName ? `Hi ${userName},` : undefined,
    intro: couponDetails.description || 'Here\'s a discount you can use on your next booking.',
    code: {
      label: 'Your coupon code',
      value: couponDetails.couponCode,
      sub: couponDetails.expiryDate ? `Valid until ${fmtDate(couponDetails.expiryDate)}` : 'No expiry',
    },
    highlight: {
      label: 'How to redeem',
      lines: [
        '1. Pick a trip you love',
        '2. Enter this code at checkout',
        `3. Save <strong>${fmtINR(couponDetails.discountAmount)}</strong> instantly`,
      ],
    },
    cta: { label: 'Browse trips', url: `${SITE_URL}/trips` },
    outro: 'One-time use. Code is non-transferable.',
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.offers}>`,
    to: email,
    subject: `🎁 ${couponDetails.couponCode} — Save ${fmtINR(couponDetails.discountAmount)} on your next trip`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

// ─────────────────────────── Generic / catch-all ───────────────────────────

export async function sendEmail(options: { to: string; subject: string; html: string; text?: string }) {
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.support}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''),
  });
}

// ─────────────────────────── Internal helper ───────────────────────────

async function send(mailOptions: { from: string; to: string; subject: string; html: string; text: string }) {
  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`Error sending email to ${mailOptions.to}:`, error?.message || error);
    throw new Error('Failed to send email');
  }
}
