# Razorpay Webhook Setup Guide

## Overview
This application uses Razorpay webhooks to receive real-time payment notifications. Webhooks ensure reliable payment status updates even if the frontend callback fails.

## Setup Instructions

### 1. Get Webhook Secret from Razorpay Dashboard

1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings** → **Webhooks**
3. Click **+ New Webhook** (if you don't have one) or edit existing webhook
4. Enter the following webhook URL:
   ```
   https://your-domain.com/api/webhooks/razorpay
   ```
   For local development (using ngrok or similar):
   ```
   https://your-ngrok-url.ngrok.io/api/webhooks/razorpay
   ```
5. Select the following events:
   - `payment.captured`
   - `payment.failed`
   - `payment.authorized`
   - `order.paid` (optional)
6. Save the webhook
7. Copy the **Webhook Secret** (starts with `whsec_...`)

### 2. Configure Webhook Secret in Admin Panel

1. Go to **Admin Panel** → **Settings** → **Payment Settings**
2. Select **Razorpay Payment Gateway** as payment mode
3. Enter your Razorpay credentials:
   - **Razorpay Key ID**: Your Key ID (starts with `rzp_...`)
   - **Razorpay Key Secret**: Your Key Secret
   - **Razorpay Webhook Secret**: The webhook secret you copied (starts with `whsec_...`)
4. Click **Save Payment Settings**

### 3. Webhook URL Format

Production:
```
https://your-domain.com/api/webhooks/razorpay
```

Development (using ngrok):
```
https://abc123.ngrok.io/api/webhooks/razorpay
```

### 4. Testing Webhooks Locally

For local development, use a service like [ngrok](https://ngrok.com):

1. Install ngrok:
   ```bash
   npm install -g ngrok
   # or download from https://ngrok.com/download
   ```

2. Start your Next.js development server:
   ```bash
   npm run dev
   ```

3. Expose your local server:
   ```bash
   ngrok http 3000
   ```

4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

5. Configure webhook in Razorpay Dashboard:
   ```
   https://abc123.ngrok.io/api/webhooks/razorpay
   ```

6. Use the webhook secret from Razorpay in your admin settings

### 5. Webhook Events Handled

The webhook endpoint handles the following events:

- **`payment.captured`**: Payment successfully captured
  - Updates booking status to `confirmed`
  - Creates payment transaction record
  - Increments trip participants
  - Sends confirmation email

- **`payment.authorized`**: Payment authorized (for two-step payments)
  - Same handling as `payment.captured`

- **`payment.failed`**: Payment failed
  - Updates payment status to `failed`
  - Does not change booking status (user can retry)

- **`order.paid`**: All payments for an order completed
  - Logged for reference

### 6. Security

- All webhook requests are verified using HMAC SHA256 signature
- Invalid signatures are rejected with 401 status
- Webhook secret is stored securely in the database
- Only admin can configure webhook settings

### 7. Troubleshooting

**Webhook not receiving events:**
- Verify webhook URL is correct and accessible
- Check Razorpay Dashboard → Webhooks → Recent Deliveries
- Ensure webhook secret matches the one in Razorpay dashboard
- Check server logs for webhook processing errors

**Invalid signature error:**
- Ensure webhook secret is correctly entered (no extra spaces)
- Verify the secret matches the one in Razorpay dashboard
- Check if webhook URL is correct

**Payment not updating:**
- Check server logs for errors
- Verify booking exists with matching `razorpay_order_id` or `razorpay_payment_id`
- Ensure webhook events are enabled in Razorpay dashboard

### 8. Manual Testing

You can test webhook manually using Razorpay's webhook testing tool:

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Click on your webhook
3. Use the "Test" button to send test events
4. Check your server logs to verify receipt

## Important Notes

- Webhooks are more reliable than frontend callbacks
- Always verify webhook signatures to prevent fraud
- Keep webhook secret secure and never commit to version control
- Webhook endpoint must be accessible via HTTPS (HTTP for local with ngrok)

