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
    preheader: `Your code is ${otp}. Don't share it with anyone.`,
    title: 'Your sign-in code',
    intro: 'Enter this code to log in. Don\'t share it with anyone, not even our team.',
    code: { label: 'Code', value: otp, sub: 'Valid for 10 minutes' },
    outro: "Didn't try to log in? Just ignore this email, your account is safe.",
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.noreply}>`,
    to: email,
    subject: `${otp} is your Ghumakkars code`,
    html: renderEmail(opts),
    text: renderPlainText(opts),
  });
}

export async function sendSignupOTPEmail(email: string, otp: string, firstName?: string) {
  const opts = {
    theme: 'brand' as const,
    preheader: `Your verification code is ${otp}.`,
    title: 'Verify your email',
    greeting: firstName ? `Hey ${firstName},` : 'Hey there,',
    intro: 'Almost done. Enter this code on the signup page to finish creating your account.',
    code: { label: 'Code', value: otp, sub: 'Valid for 10 minutes' },
    outro: "Didn't sign up? You can ignore this email.",
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.noreply}>`,
    to: email,
    subject: `${otp} is your verification code`,
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
    preheader: 'Tap the link to set a new password.',
    title: 'Reset your password',
    intro: 'Got a request to reset your password. Tap the button below to set a new one. Link works for 1 hour.',
    cta: { label: 'Set new password', url: resetLink },
    outro: "Didn't ask for this? Just ignore the email and your password stays the same.",
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
    preheader: `We're checking your payment. You'll hear from us shortly.`,
    title: 'Got your booking',
    statusPill: 'Under review',
    greeting: `Hey ${userName},`,
    intro: `Thanks for booking ${bookingDetails.tripTitle}. We're verifying your payment now. You'll get a confirmation email once it's done, usually within a few hours.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Going to', value: bookingDetails.destination },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId), highlight: true },
    ],
    cta: { label: 'See your booking', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: `Save this booking ID. You'll need it if you contact us about this trip.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Got your booking for ${bookingDetails.tripTitle}`,
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
    ? `${fmtDate(bookingDetails.startDate)} to ${fmtDate(bookingDetails.endDate)}`
    : fmtDate(bookingDetails.startDate);

  const opts = {
    theme: 'success' as const,
    preheader: `Your seat is confirmed. See you on the trip.`,
    title: 'You\'re in!',
    statusPill: 'Confirmed',
    greeting: `Hey ${userName},`,
    intro: `Your seat for ${bookingDetails.tripTitle} is confirmed. We've added you to the list. Save this email, you'll need it for reference.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Going to', value: bookingDetails.destination },
      { label: 'Dates', value: dateRange },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
      { label: 'Amount paid', value: fmtINR(bookingDetails.totalAmount), highlight: true },
    ],
    highlight: bookingDetails.whatsappGroupLink
      ? {
          label: 'Join the trip WhatsApp group',
          lines: [
            'Meet your fellow travellers and get trip updates here:',
            `<a href="${bookingDetails.whatsappGroupLink}" style="color:#16a34a;font-weight:600;text-decoration:none;word-break:break-all;">${bookingDetails.whatsappGroupLink}</a>`,
          ],
        }
      : undefined,
    cta: { label: 'See your booking', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: `About a week before the trip, we'll send you the full plan: pickup point, what to pack, and your trip leader's number. Reach out anytime till then if you need anything.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Booking confirmed for ${bookingDetails.tripTitle}`,
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
    ? `${fmtDate(bookingDetails.startDate)} to ${fmtDate(bookingDetails.endDate)}`
    : fmtDate(bookingDetails.startDate);

  const opts = {
    theme: 'warning' as const,
    preheader: `Pay ${fmtINR(bookingDetails.remainingAmount)} by ${fmtDate(bookingDetails.dueDate)} to keep your seat.`,
    title: 'Seat locked for you',
    statusPill: 'Pay balance',
    greeting: `Hey ${userName},`,
    intro: `We've held your seat for ${bookingDetails.tripTitle}. Pay the remaining amount by the due date to confirm your booking.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Going to', value: bookingDetails.destination },
      { label: 'Dates', value: dateRange },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
      { label: 'Paid so far', value: fmtINR(bookingDetails.seatLockAmount) },
    ],
    highlight: {
      label: 'Pay this to confirm',
      lines: [
        `<strong style="font-size:20px;color:#ea580c;">${fmtINR(bookingDetails.remainingAmount)}</strong> by <strong>${fmtDate(bookingDetails.dueDate)}</strong>`,
        `If we don't get the balance by then, your seat will be released. The lock amount can't be refunded after that.`,
      ],
    },
    cta: { label: 'Pay now', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: bookingDetails.whatsappGroupLink
      ? `Once you pay, we'll add you to the trip WhatsApp group: <a href="${bookingDetails.whatsappGroupLink}" style="color:#ea580c;">join here</a>.`
      : `Already paid? Ignore this. Need more time or want to switch dates? Reply to this email or ping us on WhatsApp.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Seat held. Pay ${fmtINR(bookingDetails.remainingAmount)} by ${fmtDate(bookingDetails.dueDate)}`,
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
    preheader: `Sorry, we couldn't confirm your booking. Refund is on the way.`,
    title: 'Couldn\'t confirm your booking',
    statusPill: 'Not confirmed',
    greeting: `Hey ${userName},`,
    intro: `Sorry about this. We weren't able to confirm your booking for ${bookingDetails.tripTitle}.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Going to', value: bookingDetails.destination },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
    ],
    highlight: {
      label: 'What happened',
      lines: [bookingDetails.reason],
      tone: 'danger' as const,
    },
    cta: { label: 'See other trips', url: `${SITE_URL}/trips` },
    outro: `Any amount you paid will come back to your original payment method in 5 to 7 working days. Think this is a mistake? Just reply to this email and we'll look into it.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `About your ${bookingDetails.tripTitle} booking`,
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
    preheader: `${fmtINR(bookingDetails.remainingAmount)} pending. Pay by ${fmtDate(bookingDetails.dueDate)}.`,
    title: 'Quick reminder about your payment',
    statusPill: 'Payment pending',
    greeting: `Hey ${userName},`,
    intro: `Just a heads up. Your balance for ${bookingDetails.tripTitle} is still pending. Pay before the due date to keep your seat.`,
    details: [
      { label: 'Trip', value: bookingDetails.tripTitle },
      { label: 'Going to', value: bookingDetails.destination },
      { label: 'Departure', value: fmtDate(bookingDetails.startDate) },
      { label: 'Booking ID', value: shortId(bookingDetails.bookingId) },
    ],
    highlight: {
      label: 'Pending',
      lines: [
        `<strong style="font-size:20px;color:#ea580c;">${fmtINR(bookingDetails.remainingAmount)}</strong> by <strong>${fmtDate(bookingDetails.dueDate)}</strong>`,
      ],
    },
    cta: { label: 'Pay now', url: `${SITE_URL}/bookings/${bookingDetails.bookingId}` },
    outro: `Already paid? Give it a few minutes to show up, then you can ignore this. Anything else, just reply to this email or message us on WhatsApp.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.bookings}>`,
    to: email,
    subject: `Pending: ${fmtINR(bookingDetails.remainingAmount)} for your trip`,
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
    preheader: `Use ${couponDetails.couponCode} to save ${fmtINR(couponDetails.discountAmount)} on your next trip.`,
    title: `Here's ${fmtINR(couponDetails.discountAmount)} off`,
    statusPill: 'Coupon',
    greeting: userName ? `Hey ${userName},` : undefined,
    intro: couponDetails.description || `Use this code on your next booking and save ${fmtINR(couponDetails.discountAmount)}.`,
    code: {
      label: 'Your code',
      value: couponDetails.couponCode,
      sub: couponDetails.expiryDate ? `Use before ${fmtDate(couponDetails.expiryDate)}` : 'No expiry',
    },
    highlight: {
      label: 'How to use it',
      lines: [
        '1. Pick any trip you like',
        '2. Paste the code at checkout',
        `3. Save <strong>${fmtINR(couponDetails.discountAmount)}</strong> right away`,
      ],
    },
    cta: { label: 'See all trips', url: `${SITE_URL}/trips` },
    outro: `One-time use. Can't be combined with other offers.`,
  };
  return send({
    from: `"${FROM_NAME}" <${EMAIL_ALIASES.offers}>`,
    to: email,
    subject: `${fmtINR(couponDetails.discountAmount)} off with code ${couponDetails.couponCode}`,
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
