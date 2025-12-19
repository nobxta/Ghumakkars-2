// Load environment variables from .env.local first
try {
  // @ts-ignore - dotenv is CommonJS
  require('dotenv').config({ path: '.env.local' });
  // @ts-ignore
  require('dotenv').config({ path: '.env' });
} catch (e) {
  // dotenv not available, assume env vars are set manually
}

import * as readline from 'readline';
import {
  sendLoginOTPEmail,
  sendSignupOTPEmail,
  sendPasswordResetEmail,
  sendBookingReceivedEmail,
  sendBookingConfirmedEmail,
  sendSeatLockConfirmedEmail,
  sendBookingRejectedEmail,
  sendPaymentReminderEmail,
  sendCouponEmail,
} from '../lib/email.js';

// Note: This script sends REAL emails using test/mock data
// Make sure SMTP credentials are set in .env.local or .env file

// Dummy test data
const TEST_DATA = {
  otp: '123456',
  firstName: 'Test',
  resetLink: 'https://ghumakkars.in/auth/reset-password?token=test-token-12345',
  bookingId: '550e8400-e29b-41d4-a716-446655440000',
  userName: 'Test User',
  tripTitle: 'Test Trip - Goa Adventure',
  destination: 'Goa, India',
  startDate: '2025-02-15',
  endDate: '2025-02-20',
  totalAmount: 5000,
  seatLockAmount: 2000,
  remainingAmount: 3000,
  dueDate: '2025-02-10',
  rejectionReason: 'Payment verification failed. Please check your transaction details and try again.',
  couponCode: 'TEST2025',
  discountAmount: 500,
  couponDescription: 'This is a test coupon for deliverability testing.',
  expiryDate: '2025-12-31',
  whatsappGroupLink: 'https://chat.whatsapp.com/test123',
};

// Email type mapping - uses real email functions with test data
const EMAIL_TYPES = {
  login_otp: {
    name: 'Login OTP',
    send: (email: string) => sendLoginOTPEmail(email, TEST_DATA.otp),
  },
  signup_otp: {
    name: 'Signup OTP',
    send: (email: string) => sendSignupOTPEmail(email, TEST_DATA.otp, TEST_DATA.firstName),
  },
  password_reset: {
    name: 'Password Reset',
    send: (email: string) => sendPasswordResetEmail(email, TEST_DATA.resetLink),
  },
  booking_received: {
    name: 'Booking Received',
    send: (email: string) =>
      sendBookingReceivedEmail(email, TEST_DATA.userName, {
        bookingId: TEST_DATA.bookingId,
        tripTitle: TEST_DATA.tripTitle,
        destination: TEST_DATA.destination,
      }),
  },
  booking_confirmed: {
    name: 'Booking Confirmed',
    send: (email: string) =>
      sendBookingConfirmedEmail(email, TEST_DATA.userName, {
        bookingId: TEST_DATA.bookingId,
        tripTitle: TEST_DATA.tripTitle,
        destination: TEST_DATA.destination,
        startDate: TEST_DATA.startDate,
        endDate: TEST_DATA.endDate,
        totalAmount: TEST_DATA.totalAmount,
        whatsappGroupLink: TEST_DATA.whatsappGroupLink,
      }),
  },
  seat_lock_confirmed: {
    name: 'Seat Lock Confirmed',
    send: (email: string) =>
      sendSeatLockConfirmedEmail(email, TEST_DATA.userName, {
        bookingId: TEST_DATA.bookingId,
        tripTitle: TEST_DATA.tripTitle,
        destination: TEST_DATA.destination,
        startDate: TEST_DATA.startDate,
        endDate: TEST_DATA.endDate,
        seatLockAmount: TEST_DATA.seatLockAmount,
        remainingAmount: TEST_DATA.remainingAmount,
        dueDate: TEST_DATA.dueDate,
        whatsappGroupLink: TEST_DATA.whatsappGroupLink,
      }),
  },
  booking_rejected: {
    name: 'Booking Rejected',
    send: (email: string) =>
      sendBookingRejectedEmail(email, TEST_DATA.userName, {
        bookingId: TEST_DATA.bookingId,
        tripTitle: TEST_DATA.tripTitle,
        destination: TEST_DATA.destination,
        reason: TEST_DATA.rejectionReason,
      }),
  },
  payment_reminder: {
    name: 'Payment Reminder',
    send: (email: string) =>
      sendPaymentReminderEmail(email, TEST_DATA.userName, {
        bookingId: TEST_DATA.bookingId,
        tripTitle: TEST_DATA.tripTitle,
        destination: TEST_DATA.destination,
        startDate: TEST_DATA.startDate,
        remainingAmount: TEST_DATA.remainingAmount,
        dueDate: TEST_DATA.dueDate,
      }),
  },
  coupon: {
    name: 'Coupon',
    send: (email: string) =>
      sendCouponEmail(email, TEST_DATA.userName, {
        couponCode: TEST_DATA.couponCode,
        discountAmount: TEST_DATA.discountAmount,
        expiryDate: TEST_DATA.expiryDate,
        description: TEST_DATA.couponDescription,
      }),
  },
} as const;

type EmailType = keyof typeof EMAIL_TYPES;

async function sendTestEmail(recipient: string, emailType: EmailType) {
  const emailConfig = EMAIL_TYPES[emailType];

  if (!emailConfig) {
    console.error(`\nError: Invalid email type "${emailType}"`);
    console.log('\nAvailable email types:');
    Object.keys(EMAIL_TYPES).forEach((type) => {
      console.log(`  - ${type}`);
    });
    process.exit(1);
  }

  console.log(`\nEmail Type: ${emailConfig.name}`);
  console.log('Sending email...\n');

  try {
    const result = await emailConfig.send(recipient);
    console.log('✓ Email sent successfully');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`\nRecipient: ${recipient}`);
    console.log(`Type: ${emailConfig.name}`);
    console.log('Status: SUCCESS\n');
  } catch (error: any) {
    console.error('✗ Failed to send email');
    console.error(`Error: ${error.message}`);
    console.log(`\nRecipient: ${recipient}`);
    console.log(`Type: ${emailConfig.name}`);
    console.log('Status: ERROR\n');
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n=== Test Email Sender ===');
  console.log('⚠️  Using test data - REAL emails will be sent\n');

  // Check for required SMTP credentials
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Error: SMTP credentials not found!');
    console.error('\nPlease set the following environment variables in .env.local:');
    console.error('  SMTP_USER=your-email@example.com');
    console.error('  SMTP_PASS=your-password');
    console.error('  SMTP_HOST=smtp.zoho.in (optional)');
    console.error('  SMTP_PORT=587 (optional)');
    console.error('  FROM_EMAIL=your-email@example.com (optional)\n');
    process.exit(1);
  }

  // Get recipient email
  const recipient = await question('Enter recipient email: ');
  
  if (!recipient || !recipient.includes('@')) {
    console.error('\nError: Invalid email address\n');
    rl.close();
    process.exit(1);
  }

  // Show email types menu
  console.log('\nAvailable email types:');
  const emailTypeKeys = Object.keys(EMAIL_TYPES);
  emailTypeKeys.forEach((key, index) => {
    const typeInfo = EMAIL_TYPES[key as EmailType];
    console.log(`  ${index + 1}. ${key.padEnd(25)} - ${typeInfo.name}`);
  });

  // Get email type selection
  const selection = await question('\nEnter number or type name: ');
  
  let emailType: EmailType | null = null;
  
  // Check if it's a number
  const numSelection = parseInt(selection);
  if (!isNaN(numSelection) && numSelection > 0 && numSelection <= emailTypeKeys.length) {
    emailType = emailTypeKeys[numSelection - 1] as EmailType;
  } else if (EMAIL_TYPES[selection as EmailType]) {
    emailType = selection as EmailType;
  }

  if (!emailType) {
    console.error('\nError: Invalid selection\n');
    rl.close();
    process.exit(1);
  }

  rl.close();

  // Send email
  await sendTestEmail(recipient, emailType);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

