# Ghumakkars - Complete Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Features Implemented](#features-implemented)
6. [API Endpoints](#api-endpoints)
7. [User Flows](#user-flows)
8. [Admin Features](#admin-features)
9. [Authentication System](#authentication-system)
10. [Payment System](#payment-system)
11. [Referral & Wallet System](#referral--wallet-system)
12. [File Structure](#file-structure)

---

## Overview

Ghumakkars is a premium budget travel platform designed exclusively for Indian university students. It's a full-stack Next.js application with comprehensive features for trip management, bookings, payments, referrals, and admin operations.

**Key Highlights:**
- Modern, mobile-responsive UI built with Next.js 14 (App Router)
- Complete authentication system with OTP verification
- Multi-payment gateway support (Razorpay, UPI, Cash)
- Referral system with wallet rewards
- Comprehensive admin dashboard
- Real-time booking management
- Email notifications

---

## Architecture

The application follows a modern serverless architecture:

```
Frontend (Next.js App Router)
  ├── Server Components (data fetching)
  ├── Client Components (interactive UI)
  └── API Routes (serverless functions)

Backend (Supabase)
  ├── PostgreSQL Database
  ├── Authentication
  ├── Row Level Security (RLS)
  └── Storage

External Services
  ├── Razorpay (Payment Gateway)
  ├── Nodemailer (Email via Zoho SMTP)
  └── Cloudinary (Image Upload)
```

**Key Patterns:**
- Server-side rendering for performance
- API routes for backend logic
- Supabase for database and auth
- Row Level Security for data protection
- Middleware for session management

---

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **React Hook Form** - Form handling
- **Swiper** - Carousel/slider components

### Backend
- **Supabase** - PostgreSQL database + Auth + Storage
- **Next.js API Routes** - Serverless API endpoints
- **Razorpay SDK** - Payment processing
- **Nodemailer** - Email sending (Zoho SMTP)

### Development
- **TypeScript** - Static typing
- **ESLint** - Code linting
- **PostCSS** - CSS processing

---

## Database Schema

### Core Tables

#### `profiles`
User profile information extending Supabase auth.users
- `id` (UUID, primary key, references auth.users)
- `first_name`, `last_name`, `email`, `phone`
- `role` ('user' or 'admin')
- `email_verified` (boolean)
- `referral_code` (unique, auto-generated)
- `referred_by` (UUID, references profiles.id)
- `wallet_balance` (DECIMAL, default 0)
- `avatar_url` (TEXT)
- Timestamps: `created_at`, `updated_at`

#### `trips`
Trip/package information
- `id` (UUID, primary key)
- `title`, `description`, `destination`
- `original_price`, `discounted_price`, `discount_percentage`
- `duration_days`, `start_date`, `end_date`
- `max_participants`, `current_participants`
- `image_url`, `included_features` (array), `highlights` (array)
- `is_active` (boolean)
- `seat_lock_price` (optional)
- `whatsapp_group_link` (optional)
- `created_by` (UUID, references auth.users)
- Timestamps

#### `bookings`
User trip bookings
- `id` (UUID, primary key)
- `trip_id` (UUID, references trips)
- `user_id` (UUID, references auth.users)
- `number_of_participants`
- `total_price`, `payment_amount`, `final_amount`
- `booking_status` ('pending', 'confirmed', 'cancelled', 'rejected')
- `payment_status` ('pending', 'paid', 'failed', 'refunded')
- `payment_method` ('full', 'seat_lock')
- `payment_mode` ('manual', 'razorpay', 'cash')
- `wallet_amount_used` (DECIMAL)
- `coupon_code` (TEXT)
- `coupon_discount` (DECIMAL)
- `razorpay_order_id`, `razorpay_payment_id`
- `primary_passenger_name`, `primary_passenger_email`, `primary_passenger_phone`
- `emergency_contact_name`, `emergency_contact_phone`
- `college` (TEXT)
- `passenger_details` (JSONB - array of passenger info)
- `rejection_reason` (TEXT)
- Timestamps

#### `payment_transactions`
Payment transaction records
- `id` (UUID, primary key)
- `booking_id` (UUID, references bookings)
- `transaction_id` (TEXT, unique)
- `amount` (DECIMAL)
- `payment_type` ('full', 'seat_lock', 'remaining')
- `payment_status` ('pending', 'verified', 'failed', 'refunded')
- `payment_mode` ('manual', 'razorpay', 'cash')
- `payment_reviewed_at`, `payment_reviewed_by`
- `payment_review_notes`, `rejection_reason`
- Timestamps

#### `referrals`
Referral tracking
- `id` (UUID, primary key)
- `referrer_id` (UUID, references profiles)
- `referred_user_id` (UUID, references profiles)
- `referral_code` (TEXT)
- `reward_status` ('pending', 'credited', 'cancelled')
- `reward_amount` (DECIMAL, default ₹100)
- `first_booking_id` (UUID, references bookings)
- Timestamps

#### `wallet_transactions`
Wallet transaction history
- `id` (UUID, primary key)
- `user_id` (UUID, references profiles)
- `amount` (DECIMAL, positive for credit, negative for debit)
- `transaction_type` ('credit', 'debit')
- `reference_type` ('referral', 'booking', 'refund', 'admin')
- `reference_id` (UUID, flexible reference)
- `description` (TEXT)
- Timestamps

#### `coupons`
Discount coupons
- `id` (UUID, primary key)
- `code` (TEXT, unique)
- `discount_amount` (DECIMAL)
- `discount_type` ('fixed' or 'percentage')
- `max_uses`, `current_uses`
- `user_id` (UUID, nullable - user-specific coupon)
- `expires_at` (TIMESTAMP, nullable)
- `is_active` (boolean)
- `description` (TEXT)
- Timestamps

#### `payment_settings`
Payment configuration
- `id` (UUID, primary key)
- `payment_mode` ('manual' or 'razorpay')
- `razorpay_key_id` (TEXT)
- `razorpay_key_secret` (TEXT)
- `razorpay_webhook_secret` (TEXT)
- `upi_id` (TEXT)
- `qr_url` (TEXT)
- Timestamps

#### `otp_codes`
OTP storage for authentication
- `id` (UUID, primary key)
- `email` (TEXT)
- `otp` (TEXT)
- `type` ('signup' or 'login')
- `expires_at` (TIMESTAMP)
- `used` (boolean)
- `created_at` (TIMESTAMP)

#### `reset_tokens`
Password reset tokens
- `id` (UUID, primary key)
- `email` (TEXT)
- `token` (TEXT, unique)
- `expires_at` (TIMESTAMP)
- `used` (boolean)
- `created_at` (TIMESTAMP)

### Database Functions & RPCs

1. `generate_referral_code()` - Creates unique referral codes
2. `credit_wallet()` - Credits wallet and creates transaction
3. `debit_wallet()` - Debits wallet with balance validation
4. `process_referral_reward()` - Processes referral rewards on first booking
5. `increment_trip_participants()` - Increments trip participant count
6. `increment_coupon_usage()` - Increments coupon usage count

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can only access their own data
- Admins can access all data
- Public trips are readable by everyone
- Authentication required for mutations

---

## Features Implemented

### 1. User Authentication ✅

**Sign Up Flow:**
- Email-based registration
- OTP verification via email
- Profile creation on successful verification
- Referral code support during signup

**Sign In Flow:**
- Email-based login
- OTP verification via email
- Session management via Supabase

**Password Reset:**
- Email-based password reset
- Token-based verification
- Secure password update

**Pages:**
- `/auth/signup` - Registration page
- `/auth/signin` - Login page
- `/auth/forgot-password` - Password reset request
- `/auth/reset-password` - Password reset form

### 2. User Dashboard ✅

**Profile Management:**
- View profile information
- Edit profile details
- Upload avatar (Cloudinary)
- Change email with verification
- Change password

**Pages:**
- `/profile` - Profile view
- `/profile/edit` - Profile edit

### 3. Trip Browsing ✅

**Features:**
- View all active trips
- Trip filtering and search
- Trip detail pages with full information
- Destination pages

**Pages:**
- `/` - Home page with featured trips
- `/trips` - All trips listing
- `/trips/[id]` - Trip details
- `/destinations/[slug]` - Destination pages

### 4. Booking System ✅

**Booking Flow:**
1. Select trip and number of participants
2. Enter passenger details (primary + additional passengers)
3. Select payment method (Full payment or Seat lock)
4. Apply coupon code (optional)
5. Use wallet balance (optional)
6. Complete payment (Razorpay/UPI/Cash)
7. Receive confirmation email

**Payment Options:**
- **Full Payment** - Pay entire trip amount
- **Seat Lock** - Pay partial amount to reserve seat
  - Remaining payment due 5 days before departure
  - Automatic cancellation if not paid

**Pages:**
- `/trips/[id]/book` - Booking form (multi-step)
- `/bookings` - User's bookings list
- `/bookings/[id]` - Booking details

### 5. Payment System ✅

**Supported Methods:**
1. **Razorpay** - Online payment gateway
   - Credit/Debit cards
   - UPI
   - Net Banking
   - Wallets

2. **Manual/UPI** - Manual verification
   - UPI payment with transaction ID
   - Admin verification required

3. **Cash** - Cash payment
   - Admin approval required

**Features:**
- Payment order creation (Razorpay)
- Payment verification (Razorpay webhook + callback)
- Manual payment submission with transaction ID
- Payment transaction tracking
- Remaining payment handling

**Webhook Support:**
- Razorpay webhook for payment status updates
- HMAC signature verification
- Automatic booking confirmation

### 6. Wallet System ✅

**Features:**
- View wallet balance
- Transaction history (credits/debits)
- Use wallet in bookings
- Referral rewards credited to wallet

**Pages:**
- `/wallet` - Wallet dashboard

**Transaction Types:**
- Credit: Referral rewards, refunds, admin credits
- Debit: Booking payments

### 7. Referral System ✅

**Features:**
- Unique referral code for each user
- Shareable referral links
- ₹100 reward on first confirmed booking of referred user
- Referral tracking and analytics
- Referral history

**Reward Flow:**
1. User A shares referral link/code
2. User B signs up using referral
3. Referral record created (status: 'pending')
4. User B makes first confirmed booking
5. ₹100 credited to User A's wallet automatically
6. Referral status updated to 'credited'

**Pages:**
- `/referral` - Referral dashboard

### 8. Coupon System ✅

**Features:**
- Discount coupons (fixed amount or percentage)
- User-specific coupons
- Usage limits (max uses)
- Expiry dates
- Coupon validation during booking
- Admin coupon management

**Types:**
- Fixed amount discount (e.g., ₹500 off)
- Percentage discount (e.g., 10% off)

### 9. Email Notifications ✅

**Email Types:**
- Login OTP
- Signup OTP verification
- Password reset
- Booking received
- Booking confirmed
- Seat lock confirmed
- Booking rejected
- Payment reminder
- Coupon received

**Configuration:**
- Zoho SMTP server
- HTML email templates
- Configurable from email/name

### 10. Admin Dashboard ✅

**Features:**
- Dashboard overview with stats
- Trip management (CRUD)
- Booking management
- User management
- Referral management
- Coupon management
- Payment settings
- Analytics

**Pages:**
- `/admin` - Dashboard overview
- `/admin/trips` - Trip management
- `/admin/trips/create` - Create trip
- `/admin/trips/edit/[id]` - Edit trip
- `/admin/trips/[id]` - Trip details
- `/admin/bookings` - Booking management
- `/admin/bookings/[id]` - Booking details
- `/admin/users` - User management
- `/admin/users/[id]` - User details
- `/admin/referrals` - Referral management
- `/admin/coupons` - Coupon management
- `/admin/settings` - Settings
- `/admin/analytics` - Analytics

**Admin Actions:**
- Approve/reject bookings
- Review payments
- Generate user coupons
- Process referral rewards
- Send payment reminders
- Update user wallet balances
- Manage trip participants

---

## API Endpoints

### Authentication APIs

#### `POST /api/auth/send-otp`
Send OTP for login
- Body: `{ email: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/auth/verify-otp`
Verify OTP for login
- Body: `{ email: string, otp: string }`
- Response: `{ success: boolean, user?: object, session?: object }`

#### `POST /api/auth/signup`
User registration
- Body: `{ email: string, password: string, firstName: string, lastName: string, phone: string, referralCode?: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/auth/verify-signup-otp`
Verify signup OTP
- Body: `{ email: string, otp: string }`
- Response: `{ success: boolean, user?: object, session?: object }`

#### `POST /api/auth/resend-signup-otp`
Resend signup OTP
- Body: `{ email: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/auth/check-email`
Check if email exists
- Body: `{ email: string }`
- Response: `{ exists: boolean }`

#### `POST /api/auth/send-password-reset`
Send password reset email
- Body: `{ email: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/auth/verify-reset-token`
Verify password reset token
- Body: `{ token: string }`
- Response: `{ valid: boolean }`

#### `POST /api/auth/reset-password`
Reset password
- Body: `{ token: string, password: string }`
- Response: `{ success: boolean, message: string }`

### Payment APIs

#### `POST /api/payment/create-razorpay-order`
Create Razorpay payment order
- Body: `{ amount: number, bookingId?: string, tripId?: string }`
- Response: `{ orderId: string, amount: number, currency: string, keyId: string }`

#### `POST /api/payment/verify-razorpay-payment`
Verify Razorpay payment
- Body: `{ orderId: string, paymentId: string, signature: string, bookingId: string }`
- Response: `{ success: boolean, booking?: object }`

#### `POST /api/payment/validate-coupon`
Validate coupon code
- Body: `{ code: string, amount: number }`
- Response: `{ valid: boolean, discount?: number, coupon?: object, error?: string }`

#### `GET /api/payment/settings`
Get payment settings (public)
- Response: `{ qrUrl?: string, upiId?: string, paymentMode: string }`

### Booking APIs

#### `POST /api/bookings/submit-remaining-payment`
Submit remaining payment transaction ID
- Body: `{ bookingId: string, transactionId: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/bookings/send-notification`
Send booking notification email
- Body: `{ bookingId: string, status: string, tripDetails: object, userEmail: string, userName: string }`
- Response: `{ success: boolean }`

### Profile APIs

#### `POST /api/profile/change-email`
Change user email
- Body: `{ newEmail: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/profile/change-password`
Change user password
- Body: `{ currentPassword: string, newPassword: string }`
- Response: `{ success: boolean, message: string }`

#### `POST /api/profile/upload-avatar`
Upload profile avatar
- Body: FormData with image file
- Response: `{ success: boolean, avatarUrl?: string }`

### Wallet APIs

#### `POST /api/wallet/use`
Use wallet balance for booking
- Body: `{ amount: number }`
- Response: `{ success: boolean, newBalance?: number }`

### Referral APIs

#### `GET /api/referral`
Get user referral data
- Response: `{ referralCode: string, referralLink: string, stats: object, referrals: array }`

#### `GET /api/referral/reward-amount`
Get referral reward amount (public)
- Response: `{ amount: number }`

### Upload APIs

#### `POST /api/upload/cloudinary`
Upload image to Cloudinary
- Body: FormData with image file
- Response: `{ success: boolean, url?: string }`

### Admin APIs

#### Bookings

##### `GET /api/admin/bookings`
Get all bookings (admin only)
- Response: `{ bookings: array }`

##### `POST /api/admin/bookings/review-payment`
Review and approve/reject payment
- Body: `{ bookingId: string, transactionId: string, action: 'approve' | 'reject', notes?: string }`
- Response: `{ success: boolean, message: string }`

##### `POST /api/admin/bookings/approve-cash-payment`
Approve cash payment
- Body: `{ bookingId: string, notes?: string }`
- Response: `{ success: boolean, message: string }`

##### `POST /api/admin/bookings/review-payment-transaction`
Review specific payment transaction
- Body: `{ transactionId: string, action: 'approve' | 'reject', notes?: string }`
- Response: `{ success: boolean, message: string }`

#### Trips

##### `GET /api/admin/trips/[id]`
Get trip details (admin)

##### `POST /api/admin/trips/[id]`
Update trip (admin)

##### `DELETE /api/admin/trips/[id]`
Delete trip (admin)

##### `POST /api/admin/trips/[id]/status`
Update trip status (admin)

##### `POST /api/admin/trips/[id]/send-reminder`
Send trip reminder email (admin)

##### `GET /api/admin/trips/[id]/booking`
Get trip booking stats (admin)

##### `POST /api/admin/increment-trip-participants`
Increment trip participant count (admin)

#### Users

##### `GET /api/admin/users`
Get all users (admin)

##### `GET /api/admin/users/[id]`
Get user details (admin)

##### `POST /api/admin/users/[id]`
Update user (admin)

##### `GET /api/admin/users/[id]/activity`
Get user activity log (admin)

##### `POST /api/admin/users/[id]/wallet`
Update user wallet balance (admin)

##### `POST /api/admin/users/[id]/send-payment-reminder`
Send payment reminder to user (admin)

##### `POST /api/admin/users/[id]/generate-coupon`
Generate coupon for user (admin)

#### Referrals

##### `POST /api/admin/referrals/process-pending`
Process pending referral rewards (admin)

##### `POST /api/admin/referrals/reprocess-all`
Reprocess all referral rewards (admin)

#### Settings

##### `GET /api/admin/settings` (implied)
Get payment settings (admin)

##### `POST /api/admin/settings` (implied)
Update payment settings (admin)

### Webhook APIs

#### `POST /api/webhooks/razorpay`
Razorpay webhook handler
- Verifies HMAC signature
- Handles payment events (payment.captured, payment.failed, etc.)
- Updates booking status automatically

---

## User Flows

### New User Registration

1. User visits `/auth/signup`
2. Enters email, password, name, phone
3. Optionally enters referral code
4. System sends OTP to email
5. User enters OTP on verification page
6. Account created and profile initialized
7. If referral code provided, referral record created (pending)
8. User redirected to home page

### Trip Booking Flow

1. User browses trips on home page or `/trips`
2. Clicks on trip to view details (`/trips/[id]`)
3. Clicks "Book Now" → redirects to `/trips/[id]/book`
4. **Step 1: Passenger Details**
   - Primary passenger info (pre-filled from profile)
   - Additional passengers (if multiple participants)
   - Emergency contact
   - College selection
5. **Step 2: Payment Options**
   - Select payment method (Full or Seat Lock)
   - Optionally apply coupon code
   - Optionally use wallet balance
   - View final amount
6. **Step 3: Payment**
   - If Razorpay: Redirects to Razorpay checkout
   - If Manual/UPI: Shows QR code/UPI ID, user enters transaction ID
   - If Cash: Booking created as pending, admin approval required
7. Payment verified/approved
8. Booking confirmed
9. Email notification sent
10. Trip participant count incremented
11. If first booking and referred, referrer's wallet credited

### Payment Verification Flow (Manual/UPI)

1. User submits transaction ID after payment
2. Booking status set to 'pending'
3. Admin reviews payment in `/admin/bookings/[id]`
4. Admin verifies transaction ID
5. Admin approves/rejects payment
6. If approved:
   - Booking status → 'confirmed'
   - Payment status → 'paid'
   - Trip participants incremented
   - Confirmation email sent
   - Referral reward processed (if applicable)
7. If rejected:
   - Booking status → 'rejected'
   - Rejection reason saved
   - Rejection email sent

### Referral Reward Flow

1. User A shares referral link: `/auth/signup?ref=ABC123`
2. User B signs up using that link
3. Referral record created:
   - `referrer_id`: User A
   - `referred_user_id`: User B
   - `reward_status`: 'pending'
4. User B makes booking
5. When booking confirmed:
   - System checks if it's User B's first confirmed booking
   - If yes, calls `process_referral_reward()` function
   - ₹100 credited to User A's wallet
   - Wallet transaction created
   - Referral status → 'credited'

### Seat Lock Payment Flow

1. User selects "Seat Lock" payment method
2. Pays seat lock amount (partial payment)
3. Booking created with status 'pending'
4. Seat reserved for user
5. Remaining amount calculated
6. Due date set (5 days before trip start)
7. User receives seat lock confirmation email
8. Before due date, user can submit remaining payment
9. If remaining payment not submitted by due date:
   - Booking automatically cancelled
   - Seat lock amount non-refundable
10. If remaining payment submitted and approved:
    - Booking confirmed
    - Confirmation email sent

---

## Admin Features

### Dashboard Overview

**Stats Displayed:**
- Total trips (active/inactive)
- Total bookings (confirmed/pending)
- Total users (verified/pending)
- Total revenue

**Quick Actions:**
- Create new trip
- View recent trips
- View recent bookings

### Trip Management

**Features:**
- Create new trips
- Edit existing trips
- Delete trips
- Activate/deactivate trips
- View trip details
- View booking statistics for trip
- Send trip reminders to booked users

**Trip Fields:**
- Title, description, destination
- Pricing (original, discounted, discount %)
- Dates (start, end, duration)
- Participants (max, current)
- Images
- Features and highlights
- Seat lock price
- WhatsApp group link
- Active status

### Booking Management

**Features:**
- View all bookings
- Filter by status (pending, confirmed, cancelled, rejected)
- Search bookings
- View booking details
- Review payments
- Approve/reject bookings
- Approve cash payments
- Review payment transactions
- Send payment reminders
- Update booking status

**Booking Details Include:**
- User information
- Trip details
- Passenger information
- Payment details
- Payment transaction history
- Booking timeline

### User Management

**Features:**
- View all users
- Search users
- View user profile
- View user bookings
- View user wallet balance
- Update wallet balance (admin credits/debits)
- Generate coupons for user
- Send payment reminders
- View user activity log

### Referral Management

**Features:**
- View all referrals
- Filter by status (pending, credited, cancelled)
- Search by referrer/referred user/code
- Process pending referrals
- Reprocess all referrals
- View referral statistics:
  - Total referrals
  - Total rewards paid
  - Pending rewards
  - Active referrers

### Coupon Management

**Features:**
- Create coupons
- Edit coupons
- Delete coupons
- View coupon usage
- Set usage limits
- Set expiry dates
- Generate user-specific coupons

**Coupon Types:**
- Fixed amount discount
- Percentage discount
- Global or user-specific

### Payment Settings

**Features:**
- Configure payment mode (Manual or Razorpay)
- Set Razorpay credentials (Key ID, Secret, Webhook Secret)
- Set UPI ID and QR code URL
- Test payment configuration

### Analytics

**Features:**
- Booking statistics
- Revenue analytics
- User analytics
- Trip performance
- Referral analytics

---

## Authentication System

### OTP-Based Authentication

**Login Flow:**
1. User enters email on `/auth/signin`
2. System sends 6-digit OTP to email
3. OTP stored in `otp_codes` table with 10-minute expiry
4. User enters OTP
5. System verifies OTP
6. Supabase session created
7. User logged in

**Signup Flow:**
1. User enters details on `/auth/signup`
2. System validates email uniqueness
3. System sends OTP to email
4. User enters OTP on verification page
5. Supabase account created
6. Profile record created
7. Referral code generated
8. If referral code provided, referral record created
9. User logged in

### Session Management

- Sessions managed by Supabase
- Middleware refreshes sessions on each request
- Server-side session validation in API routes
- Client-side session checks in protected pages

### Password Reset

1. User requests reset on `/auth/forgot-password`
2. System generates unique token
3. Token stored in `reset_tokens` table with 1-hour expiry
4. Reset link sent to email
5. User clicks link → `/auth/reset-password?token=xxx`
6. System verifies token
7. User enters new password
8. Password updated
9. Token marked as used

---

## Payment System

### Razorpay Integration

**Order Creation:**
1. Frontend calls `/api/payment/create-razorpay-order`
2. Server creates Razorpay order
3. Returns order details to frontend
4. Frontend opens Razorpay checkout

**Payment Verification:**
1. User completes payment on Razorpay
2. Razorpay redirects to callback URL
3. Frontend calls `/api/payment/verify-razorpay-payment`
4. Server verifies payment signature
5. Booking status updated to 'confirmed'
6. Payment transaction recorded
7. Email confirmation sent

**Webhook Handling:**
1. Razorpay sends webhook on payment events
2. `/api/webhooks/razorpay` receives webhook
3. HMAC signature verified
4. Payment status updated
5. Booking confirmed if payment captured

### Manual/UPI Payment

**Flow:**
1. User selects "Manual/UPI" payment mode
2. System shows QR code or UPI ID from payment settings
3. User makes payment via UPI app
4. User enters transaction ID
5. Booking created with status 'pending'
6. Payment transaction created with status 'pending'
7. Admin reviews payment
8. Admin verifies transaction ID
9. Admin approves/rejects
10. Booking status updated accordingly

### Cash Payment

**Flow:**
1. User selects "Cash" payment mode
2. Booking created with status 'pending'
3. Payment transaction created with status 'pending'
4. Admin receives notification
5. Admin verifies cash payment
6. Admin approves via `/api/admin/bookings/approve-cash-payment`
7. Booking confirmed

---

## Referral & Wallet System

### Referral Code Generation

- Unique 8-character alphanumeric codes
- Generated using database function `generate_referral_code()`
- Assigned to each user on profile creation
- Format: Mixed case letters and numbers

### Wallet Operations

**Credit Operations:**
- Referral rewards
- Refunds
- Admin credits

**Debit Operations:**
- Booking payments

**Transaction Tracking:**
- All operations recorded in `wallet_transactions`
- Links to source (referral, booking, etc.)
- Balance calculated from transaction history

### Referral Reward Processing

**Automatic Processing:**
- Triggered on booking confirmation
- Checks if it's referred user's first confirmed booking
- If yes, credits ₹100 to referrer's wallet
- Creates wallet transaction
- Updates referral status to 'credited'

**Manual Processing:**
- Admin can process pending referrals manually
- Admin can reprocess all referrals (for corrections)

---

## File Structure

```
Ghumakkars 2/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin dashboard pages
│   │   ├── analytics/           # Analytics page
│   │   ├── bookings/            # Booking management
│   │   ├── coupons/             # Coupon management
│   │   ├── referrals/           # Referral management
│   │   ├── settings/            # Settings page
│   │   ├── trips/               # Trip management
│   │   ├── users/               # User management
│   │   ├── layout.tsx           # Admin layout
│   │   └── page.tsx             # Admin dashboard
│   ├── api/                     # API routes
│   │   ├── admin/               # Admin APIs
│   │   ├── auth/                # Authentication APIs
│   │   ├── bookings/            # Booking APIs
│   │   ├── payment/             # Payment APIs
│   │   ├── profile/             # Profile APIs
│   │   ├── referral/            # Referral APIs
│   │   ├── upload/              # Upload APIs
│   │   ├── wallet/              # Wallet APIs
│   │   └── webhooks/            # Webhook handlers
│   ├── auth/                    # Auth pages
│   │   ├── signin/              # Login page
│   │   ├── signup/              # Registration page
│   │   ├── forgot-password/     # Password reset request
│   │   └── reset-password/      # Password reset form
│   ├── bookings/                # Booking pages
│   ├── destinations/            # Destination pages
│   ├── profile/                 # Profile pages
│   ├── referral/                # Referral page
│   ├── trips/                   # Trip pages
│   ├── wallet/                  # Wallet page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── admin/                   # Admin components
│   ├── About.tsx                # About section
│   ├── BottomNav.tsx            # Mobile bottom nav
│   ├── CTA.tsx                  # Call-to-action
│   ├── Destinations.tsx         # Destinations section
│   ├── FAQ.tsx                  # FAQ section
│   ├── Features.tsx             # Features section
│   ├── Footer.tsx               # Footer
│   ├── Hero.tsx                 # Hero section
│   ├── Navbar.tsx               # Navigation bar
│   ├── Newsletter.tsx           # Newsletter signup
│   ├── Packages.tsx             # Packages section
│   ├── ScrollToTop.tsx          # Scroll to top button
│   ├── Stats.tsx                # Statistics section
│   ├── Testimonials.tsx         # Testimonials section
│   └── Trips.tsx                # Trips listing
├── hooks/                        # Custom React hooks
│   └── useScrollAnimation.ts    # Scroll animation hook
├── lib/                          # Utility libraries
│   ├── supabase/                # Supabase clients
│   │   ├── admin.ts             # Admin client
│   │   ├── client.ts            # Browser client
│   │   └── server.ts            # Server client
│   ├── email.ts                 # Email functions
│   ├── otp-store.ts             # OTP storage
│   └── reset-token-store.ts     # Reset token storage
├── database/                     # SQL migration files
│   ├── supabase-schema.sql      # Main schema
│   └── [other migration files]  # Schema updates
├── middleware.ts                 # Next.js middleware
├── next.config.mjs              # Next.js config
├── tailwind.config.ts           # Tailwind config
├── tsconfig.json                # TypeScript config
├── package.json                 # Dependencies
└── README.md                    # Project README
```

---

## Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (Zoho SMTP)
SMTP_HOST=smtp.zoho.in
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_password
FROM_EMAIL=your_email@domain.com
FROM_NAME=Ghumakkars

# Razorpay (optional, if using Razorpay)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Cloudinary (optional, for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Site URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

---

## Security Features

1. **Row Level Security (RLS)**
   - Database-level access control
   - Users can only access their own data
   - Admins have elevated permissions

2. **Authentication**
   - OTP-based secure login
   - Session management via Supabase
   - Password hashing (handled by Supabase)

3. **Payment Security**
   - Razorpay webhook signature verification
   - Secure payment transaction handling
   - Admin approval for manual payments

4. **API Security**
   - Authentication required for protected routes
   - Admin role verification
   - Input validation
   - Error handling

5. **Data Protection**
   - HTTPS required in production
   - Secure token storage
   - OTP expiry (10 minutes)
   - Password reset token expiry (1 hour)

---

## Performance Optimizations

1. **Server-Side Rendering (SSR)**
   - Fast initial page loads
   - SEO-friendly

2. **Image Optimization**
   - Next.js Image component
   - Cloudinary integration

3. **Database Indexing**
   - Indexed foreign keys
   - Indexed email fields
   - Indexed referral codes

4. **Caching**
   - Supabase query caching
   - Static page generation where possible

---

## Deployment Considerations

1. **Database Setup**
   - Run all SQL migrations in order
   - Set up RLS policies
   - Configure database functions

2. **Environment Variables**
   - Set all required variables
   - Use secure secret storage
   - Never commit secrets to version control

3. **Razorpay Webhook**
   - Configure webhook URL in Razorpay dashboard
   - Set webhook secret in admin settings
   - Test webhook delivery

4. **Email Configuration**
   - Configure SMTP credentials
   - Test email delivery
   - Set up SPF/DKIM records for domain

5. **Storage**
   - Configure Supabase storage buckets
   - Set up Cloudinary (if using)

---

## Known Limitations & Future Enhancements

### Current Limitations
- Single currency (INR)
- Limited payment gateway options
- Manual payment verification required
- No automated refund system

### Potential Enhancements
- Multiple payment gateways
- Automated refund processing
- SMS notifications (OTP, reminders)
- WhatsApp integration
- Trip reviews and ratings
- Wishlist functionality
- Group booking discounts
- Loyalty program
- Advanced analytics
- Mobile app

---

## Support & Maintenance

### Regular Maintenance Tasks
1. Monitor payment transactions
2. Review pending bookings
3. Process referral rewards
4. Update trip availability
5. Monitor email delivery
6. Review error logs
7. Update payment settings if needed

### Troubleshooting

**Common Issues:**
1. **OTP not received**
   - Check SMTP configuration
   - Check spam folder
   - Verify email address

2. **Payment not processing**
   - Check Razorpay credentials
   - Verify webhook configuration
   - Check payment settings

3. **Booking not confirming**
   - Verify payment transaction
   - Check admin approval status
   - Review booking status

4. **Referral reward not credited**
   - Check referral status
   - Verify first booking status
   - Manually process if needed

---

This documentation covers all currently implemented features and systems. The codebase is production-ready with comprehensive functionality for a travel booking platform.

