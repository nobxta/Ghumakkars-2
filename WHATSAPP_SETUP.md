# WhatsApp Notification Setup

This project uses `@whiskeysockets/baileys` to send WhatsApp notifications to users when their bookings are confirmed. Baileys is a modern, lightweight WhatsApp library that doesn't require puppeteer and works with Node.js v22.

## Installation

Installation is straightforward - Baileys works with Node.js v22 without any compatibility issues:

```bash
npm install @whiskeysockets/baileys qrcode pino @hapi/boom
```

That's it! No special flags or workarounds needed.

## Initial Setup

1. **Go to Admin Settings**: Navigate to `/admin/settings` and click the "WhatsApp" tab

2. **Click "Connect WhatsApp"**: This will initialize the WhatsApp client

3. **Scan QR Code**: 
   - The QR code will be displayed in the admin settings page
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed on the page

4. **Session Saved**: After the first scan, the session is saved in `.wwebjs_auth/` directory. You won't need to scan again unless you delete this directory or log out.

## How It Works

### Automatic Notifications

When a booking is confirmed with full payment, WhatsApp notifications are automatically sent to users:

1. **Booking Confirmation Flow**:
   - User completes full payment
   - Booking status changes to `confirmed`
   - Email notification is sent (existing)
   - **WhatsApp notification is sent** (new)

2. **Notification Includes**:
   - Booking confirmation message
   - Trip details (title, destination, dates)
   - Number of participants
   - Booking ID
   - Amount paid
   - **WhatsApp group link** (if configured for the trip)

### Manual Notification

You can also manually send WhatsApp notifications:

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-booking-notification \
  -H "Content-Type: application/json" \
  -d '{"bookingId": "your-booking-id"}'
```

## API Endpoints

### Initialize WhatsApp Client
- **POST** `/api/whatsapp/init` - Initialize client and get QR code if needed
- **GET** `/api/whatsapp/init` - Check if client is ready

### Send Booking Notification
- **POST** `/api/whatsapp/send-booking-notification` - Send notification for a confirmed booking
  - Body: `{ bookingId: string }`

## Phone Number Format

Phone numbers should be in format: `91XXXXXXXXXX` (country code + number, no + or spaces)

The service automatically:
- Removes +, spaces, and dashes
- Adds country code 91 (India) if number is 10 digits
- Formats for WhatsApp: `91XXXXXXXXXX@c.us`

## Integration Points

WhatsApp notifications are automatically sent when bookings are confirmed in:

1. **Razorpay Webhook** (`app/api/webhooks/razorpay/route.ts`)
   - When payment is captured via webhook

2. **Payment Verification** (`app/api/payment/verify-razorpay-payment/route.ts`)
   - When payment is verified on frontend

3. **Booking Notification API** (`app/api/bookings/send-notification/route.ts`)
   - When status is 'confirmed', both email and WhatsApp are sent

4. **Admin Cash Payment Approval** (`app/api/admin/bookings/approve-cash-payment/route.ts`)
   - When admin approves cash payment and booking is confirmed

## Troubleshooting

### Client Not Ready
- Check if WhatsApp client is initialized: `GET /api/whatsapp/init`
- Initialize if needed: `POST /api/whatsapp/init`
- Check server logs for errors

### QR Code Not Displaying
- Ensure `qrcode-terminal` is installed
- Check terminal supports QR code rendering
- QR code string is still available in API response

### Messages Not Sending
- Verify phone number format is correct
- Check if phone number exists in booking or profile
- Ensure booking status is 'confirmed'
- Check server logs for WhatsApp client errors

### Session Issues
- Delete `.wwebjs_auth/` directory to force re-authentication
- Restart the server after deleting session

## Security Notes

- WhatsApp session is stored locally in `.wwebjs_auth/` directory
- Add `.wwebjs_auth/` to `.gitignore` (already included)
- Session is tied to the phone number used for authentication
- Only one WhatsApp session can be active at a time
- Baileys uses a more secure authentication system than whatsapp-web.js

## Production Considerations

- Run WhatsApp client on a dedicated server/container
- Use process manager (PM2) to keep client running
- Monitor client connection status
- Set up alerts for disconnections
- Consider using WhatsApp Business API for production scale



