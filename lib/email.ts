import nodemailer from 'nodemailer';

// Create transporter - configured for Zoho Mail
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.zoho.in',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'contact@ghumakkars.in';
const FROM_NAME = process.env.FROM_NAME || 'Ghumakkars';

// Send OTP for Login
export async function sendLoginOTPEmail(email: string, otp: string) {
  const plainText = `Login Code

Use this code to complete your login: ${otp}

This code will expire in 10 minutes.

If you did not request this, you can safely ignore this email.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Login Code</h1>
  <p>Use this code to complete your login:</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: 600; font-family: monospace; letter-spacing: 4px;">
    ${otp}
  </div>
  <p>This code will expire in 10 minutes.</p>
  <p style="margin-top: 30px; color: #666; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Login Code',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send email');
  }
}

// Send OTP for Registration/Signup
export async function sendSignupOTPEmail(email: string, otp: string, firstName?: string) {
  const plainText = `Account Verification Code

Use this code to verify your email address and complete your registration: ${otp}

This verification code will expire in 10 minutes.

If you did not request this, you can safely ignore this email.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Account Verification Code</h1>
  <p>Use this code to verify your email address and complete your registration:</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: 600; font-family: monospace; letter-spacing: 4px;">
    ${otp}
  </div>
  <p>This verification code will expire in 10 minutes.</p>
  <p style="margin-top: 30px; color: #666; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Account Verification Code',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending signup OTP email:', error);
    throw new Error('Failed to send email');
  }
}

// Backward compatibility - alias for login OTP
export async function sendOTPEmail(email: string, otp: string) {
  return sendLoginOTPEmail(email, otp);
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const plainText = `Password Reset

Click the link below to reset your password. This link will expire in 1 hour.

${resetLink}

If you did not request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Password Reset</h1>
  <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
  <p style="margin: 30px 0;">
    <a href="${resetLink}" style="display: inline-block; background-color: #4a5568; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px;">Reset Password</a>
  </p>
  <p style="color: #666; font-size: 14px; word-break: break-all;">${resetLink}</p>
  <p style="margin-top: 30px; color: #666; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Password Reset',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send email');
  }
}

// Send booking received email
export async function sendBookingReceivedEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    tripTitle: string;
    destination: string;
  }
) {
  const plainText = `Booking Received

We have received your booking request.

Trip: ${bookingDetails.tripTitle}
Destination: ${bookingDetails.destination}
Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}

Our team is reviewing your booking and payment details. We will contact you with confirmation.

If you have questions, contact our support team.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Booking Received</h1>
  <p>We have received your booking request.</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">${bookingDetails.tripTitle}</p>
    <p style="margin: 5px 0; color: #666;">Destination: ${bookingDetails.destination}</p>
    <p style="margin: 5px 0; color: #666;">Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}</p>
  </div>
  <p>Our team is reviewing your booking and payment details. We will contact you with confirmation.</p>
  <p>If you have questions, contact our support team.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Booking Received',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending booking received email:', error);
    throw new Error('Failed to send email');
  }
}

// Send booking confirmed email
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
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const dateRange = bookingDetails.endDate 
    ? `${formatDate(bookingDetails.startDate)} - ${formatDate(bookingDetails.endDate)}`
    : formatDate(bookingDetails.startDate);

  const whatsappSection = bookingDetails.whatsappGroupLink 
    ? `\n\nWhatsApp Group: ${bookingDetails.whatsappGroupLink}\nJoin the group to connect with other travelers and receive trip updates.`
    : '';

  const plainText = `Booking Confirmed

Your booking has been confirmed.

Trip: ${bookingDetails.tripTitle}
Destination: ${bookingDetails.destination}
Dates: ${dateRange}
Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}
Amount Paid: ₹${bookingDetails.totalAmount.toLocaleString()}${whatsappSection}

You will receive additional trip details before the departure date.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const whatsappHtml = bookingDetails.whatsappGroupLink 
    ? `<p style="margin-top: 20px;"><strong>WhatsApp Group:</strong><br><a href="${bookingDetails.whatsappGroupLink}" style="color: #4a5568; word-break: break-all;">${bookingDetails.whatsappGroupLink}</a><br>Join the group to connect with other travelers and receive trip updates.</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Booking Confirmed</h1>
  <p>Your booking has been confirmed.</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">${bookingDetails.tripTitle}</p>
    <p style="margin: 5px 0; color: #666;">Destination: ${bookingDetails.destination}</p>
    <p style="margin: 5px 0; color: #666;">Dates: ${dateRange}</p>
    <p style="margin: 5px 0; color: #666;">Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}</p>
    <p style="margin: 5px 0; color: #666;">Amount Paid: ₹${bookingDetails.totalAmount.toLocaleString()}</p>
  </div>${whatsappHtml}
  <p>You will receive additional trip details before the departure date.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Booking Confirmed',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending booking confirmed email:', error);
    throw new Error('Failed to send email');
  }
}

// Send seat lock confirmed email
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
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const dateRange = bookingDetails.endDate 
    ? `${formatDate(bookingDetails.startDate)} - ${formatDate(bookingDetails.endDate)}`
    : formatDate(bookingDetails.startDate);

  const whatsappSection = bookingDetails.whatsappGroupLink 
    ? `\n\nWhatsApp Group: ${bookingDetails.whatsappGroupLink}\nJoin the group to connect with other travelers and receive trip updates.`
    : '';

  const plainText = `Seat Reserved

Your seat has been reserved.

Trip: ${bookingDetails.tripTitle}
Destination: ${bookingDetails.destination}
Dates: ${dateRange}
Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}
Seat Lock Amount Paid: ₹${bookingDetails.seatLockAmount.toLocaleString()}${whatsappSection}

Remaining Payment Due: ₹${bookingDetails.remainingAmount.toLocaleString()}
Due Date: ${formatDate(bookingDetails.dueDate)}

You must pay the remaining amount by the due date (5 days before departure), otherwise your seat will be automatically cancelled. The seat lock amount is non-refundable.

You will receive payment reminders before the due date. For questions, contact our support team.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const whatsappHtml = bookingDetails.whatsappGroupLink 
    ? `<p style="margin-top: 20px;"><strong>WhatsApp Group:</strong><br><a href="${bookingDetails.whatsappGroupLink}" style="color: #4a5568; word-break: break-all;">${bookingDetails.whatsappGroupLink}</a><br>Join the group to connect with other travelers and receive trip updates.</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Seat Reserved</h1>
  <p>Your seat has been reserved.</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">${bookingDetails.tripTitle}</p>
    <p style="margin: 5px 0; color: #666;">Destination: ${bookingDetails.destination}</p>
    <p style="margin: 5px 0; color: #666;">Dates: ${dateRange}</p>
    <p style="margin: 5px 0; color: #666;">Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}</p>
    <p style="margin: 5px 0; color: #666;">Seat Lock Amount Paid: ₹${bookingDetails.seatLockAmount.toLocaleString()}</p>
  </div>${whatsappHtml}
  <div style="background-color: #fff5f5; border: 1px solid #fc8181; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">Remaining Payment Due: ₹${bookingDetails.remainingAmount.toLocaleString()}</p>
    <p style="margin: 5px 0;">Due Date: ${formatDate(bookingDetails.dueDate)}</p>
    <p style="margin: 10px 0 0 0; font-size: 14px;">You must pay the remaining amount by the due date (5 days before departure), otherwise your seat will be automatically cancelled. The seat lock amount is non-refundable.</p>
  </div>
  <p>You will receive payment reminders before the due date. For questions, contact our support team.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Seat Reserved - Payment Due',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending seat lock confirmed email:', error);
    throw new Error('Failed to send email');
  }
}

// Send booking rejected email
export async function sendBookingRejectedEmail(
  email: string,
  userName: string,
  bookingDetails: {
    bookingId: string;
    tripTitle: string;
    destination: string;
    reason: string;
  }
) {
  const plainText = `Booking Not Confirmed

We are unable to confirm your booking.

Trip: ${bookingDetails.tripTitle}
Destination: ${bookingDetails.destination}
Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}

Reason: ${bookingDetails.reason}

If you believe this is an error or have questions, contact our support team.

You can view other available trips on our website.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Booking Not Confirmed</h1>
  <p>We are unable to confirm your booking.</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">${bookingDetails.tripTitle}</p>
    <p style="margin: 5px 0; color: #666;">Destination: ${bookingDetails.destination}</p>
    <p style="margin: 5px 0; color: #666;">Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}</p>
  </div>
  <div style="background-color: #fff5f5; border-left: 3px solid #fc8181; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 5px 0; font-weight: 600;">Reason:</p>
    <p style="margin: 0;">${bookingDetails.reason}</p>
  </div>
  <p>If you believe this is an error or have questions, contact our support team.</p>
  <p>You can view other available trips on our website.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Booking Not Confirmed',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending booking rejected email:', error);
    throw new Error('Failed to send email');
  }
}

// Send payment reminder email
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
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in'}/bookings/${bookingDetails.bookingId}`;

  const plainText = `Payment Reminder

You have a pending payment for the following booking.

Trip: ${bookingDetails.tripTitle}
Destination: ${bookingDetails.destination}
Start Date: ${formatDate(bookingDetails.startDate)}
Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}

Remaining Amount: ₹${bookingDetails.remainingAmount.toLocaleString()}
Due Date: ${formatDate(bookingDetails.dueDate)}

Complete your payment: ${bookingUrl}

If you have already made the payment, you can ignore this reminder. For assistance, contact our support team.

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Payment Reminder</h1>
  <p>You have a pending payment for the following booking.</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">${bookingDetails.tripTitle}</p>
    <p style="margin: 5px 0; color: #666;">Destination: ${bookingDetails.destination}</p>
    <p style="margin: 5px 0; color: #666;">Start Date: ${formatDate(bookingDetails.startDate)}</p>
    <p style="margin: 5px 0; color: #666;">Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}</p>
  </div>
  <div style="background-color: #fff5f5; border: 1px solid #fc8181; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">Remaining Amount: ₹${bookingDetails.remainingAmount.toLocaleString()}</p>
    <p style="margin: 5px 0;">Due Date: ${formatDate(bookingDetails.dueDate)}</p>
  </div>
  <p style="margin: 30px 0;">
    <a href="${bookingUrl}" style="display: inline-block; background-color: #4a5568; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px;">Complete Payment</a>
  </p>
  <p>If you have already made the payment, you can ignore this reminder. For assistance, contact our support team.</p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Payment Reminder',
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending payment reminder email:', error);
    throw new Error('Failed to send email');
  }
}

// Send coupon email
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
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const expiryText = couponDetails.expiryDate 
    ? `\nValid until: ${formatDate(couponDetails.expiryDate)}`
    : '';

  const tripsUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ghumakkars.in'}/trips`;

  const plainText = `Discount Coupon

${couponDetails.description}

Coupon Code: ${couponDetails.couponCode}
Discount Amount: ₹${couponDetails.discountAmount.toLocaleString()}${expiryText}

To use this coupon:
1. Select a trip and proceed to booking
2. Enter the coupon code at checkout
3. The discount will be applied automatically

This coupon is valid for one-time use only.

View trips: ${tripsUrl}

© ${new Date().getFullYear()} Ghumakkars. All rights reserved.`;

  const expiryHtml = couponDetails.expiryDate 
    ? `<p style="margin: 10px 0 0 0; color: #666;">Valid until: ${formatDate(couponDetails.expiryDate)}</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto;">
  <h1 style="font-size: 20px; margin: 0 0 20px 0;">Discount Coupon</h1>
  <p>${couponDetails.description}</p>
  <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0; text-align: center;">
    <p style="margin: 0 0 10px 0; font-weight: 600;">Coupon Code</p>
    <p style="margin: 0; font-size: 24px; font-weight: 600; font-family: monospace; letter-spacing: 2px;">${couponDetails.couponCode}</p>
    <p style="margin: 10px 0 0 0; color: #666;">Discount: ₹${couponDetails.discountAmount.toLocaleString()}</p>
    ${expiryHtml}
  </div>
  <p><strong>To use this coupon:</strong></p>
  <ol style="margin: 10px 0; padding-left: 25px;">
    <li>Select a trip and proceed to booking</li>
    <li>Enter the coupon code at checkout</li>
    <li>The discount will be applied automatically</li>
  </ol>
  <p>This coupon is valid for one-time use only.</p>
  <p style="margin: 20px 0;">
    <a href="${tripsUrl}" style="color: #4a5568; text-decoration: underline;">View trips</a>
  </p>
  <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">© ${new Date().getFullYear()} Ghumakkars. All rights reserved.</p>
</div>
</body>
</html>`;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: `Discount Coupon - ₹${couponDetails.discountAmount} Off`,
    text: plainText,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending coupon email:', error);
    throw new Error('Failed to send email');
  }
}
