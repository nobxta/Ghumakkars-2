# Referral System Implementation

## Overview
A comprehensive referral system has been implemented with the following features:
- User referral codes and sharing
- Referral tracking and rewards
- Wallet system with ₹100 reward on first booking
- Admin referral management
- Wallet usage in bookings

## Database Schema

### New Tables
1. **referrals** - Tracks referral relationships
   - `referrer_id` - User who referred
   - `referred_user_id` - User who was referred
   - `referral_code` - Code used
   - `reward_status` - pending, credited, cancelled
   - `reward_amount` - Default ₹100
   - `first_booking_id` - First booking that triggered reward

2. **wallet_transactions** - Wallet transaction history
   - Tracks all credits and debits
   - Links to bookings, referrals, etc.

### Updated Tables
1. **profiles** - Added columns:
   - `referral_code` - Unique code for each user
   - `referred_by` - User who referred them
   - `wallet_balance` - Current wallet balance

### Database Functions
- `generate_referral_code()` - Generates unique referral codes
- `credit_wallet()` - Credits wallet and creates transaction
- `debit_wallet()` - Debits wallet with balance check
- `process_referral_reward()` - Processes ₹100 reward when referral makes first booking

## Features Implemented

### 1. Sign Up with Referral Code
- Users can sign up using referral links: `/auth/signup?ref=CODE`
- Referral code can be entered manually during signup
- Referral relationship is automatically created
- Each user gets a unique referral code

### 2. User Referral Page (`/referral`)
- Shows user's referral code
- Displays referral link (shareable)
- Lists all referred users
- Shows stats:
  - Total referrals
  - Rewards earned (₹100 per credited referral)
  - Pending rewards

### 3. Wallet System (`/wallet`)
- Shows current wallet balance
- Displays transaction history
- Shows credits (referral rewards) and debits (booking payments)

### 4. Booking with Wallet
- Users can use wallet balance during booking
- Wallet amount is deducted before payment
- Remaining amount can be paid via UPI/Razorpay/Cash
- Wallet usage is tracked in booking record

### 5. Referral Reward Logic
- When a referred user makes their **first confirmed booking**:
  - ₹100 is automatically credited to referrer's wallet
  - Referral status changes from 'pending' to 'credited'
  - Transaction is recorded in wallet_transactions
- Works for both manual and Razorpay payments

### 6. Admin Referral Management (`/admin/referrals`)
- View all referrals
- Filter by status (pending, credited, cancelled)
- Search by referrer/referred user/code
- View stats:
  - Total referrals
  - Total rewards paid
  - Pending rewards
  - Active referrers

## API Endpoints

### `/api/referral` (GET)
- Returns user's referral data, stats, and list of referrals

### `/api/wallet/use` (POST)
- Deducts wallet amount for booking payment
- Returns updated balance

## Setup Instructions

1. **Run Database Migration**
   ```sql
   -- Execute supabase-referral-system.sql in Supabase SQL Editor
   ```

2. **Generate Referral Codes for Existing Users** (Optional)
   ```sql
   UPDATE profiles
   SET referral_code = generate_referral_code()
   WHERE referral_code IS NULL;
   ```

3. **Test the System**
   - Sign up a new user with a referral code
   - Make a booking as the referred user
   - Verify ₹100 is credited to referrer's wallet
   - Check admin referral page for tracking

## Key Files Modified/Created

### Created Files
- `supabase-referral-system.sql` - Database schema
- `app/api/referral/route.ts` - Referral API
- `app/api/wallet/use/route.ts` - Wallet usage API
- `app/admin/referrals/page.tsx` - Admin referral management

### Modified Files
- `app/auth/signup/page.tsx` - Added referral code input
- `app/api/auth/signup/route.ts` - Handle referral code during signup
- `app/referral/page.tsx` - Show real referral data
- `app/wallet/page.tsx` - Show real wallet balance and transactions
- `app/trips/[id]/book/page.tsx` - Added wallet usage option
- `app/api/admin/bookings/review-payment/route.ts` - Process referral reward
- `app/api/payment/verify-razorpay-payment/route.ts` - Process referral reward
- `components/admin/AdminSidebar.tsx` - Added referrals link

## Reward Flow

1. User A shares referral link: `/auth/signup?ref=ABC123`
2. User B signs up using that link
3. Referral record created with status 'pending'
4. User B makes their first booking
5. When booking is confirmed:
   - System checks if it's User B's first confirmed booking
   - If yes, ₹100 is credited to User A's wallet
   - Referral status changes to 'credited'
   - Transaction recorded in wallet_transactions

## Notes

- Referral rewards are only given on **first confirmed booking**
- Wallet balance can be used for any booking
- Referral codes are unique and auto-generated
- Each user can only be referred once
- Admin can view all referral activity

