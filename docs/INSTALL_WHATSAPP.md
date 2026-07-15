# Installing WhatsApp Dependencies

✅ **GOOD NEWS**: WhatsApp integration now uses `@whiskeysockets/baileys` which works perfectly with Node.js v22!

## Installation (Simple - No Issues!)

```bash
npm install @whiskeysockets/baileys qrcode pino @hapi/boom
```

That's it! No special flags, no compatibility issues, no puppeteer problems.

## Why Baileys?

- ✅ Works with Node.js v22 (no compatibility issues)
- ✅ No puppeteer dependency (lighter, faster)
- ✅ More modern and actively maintained
- ✅ Better authentication system
- ✅ Same functionality as whatsapp-web.js

## Setup Steps

1. **Install packages** (already done if you see this):
   ```bash
   npm install @whiskeysockets/baileys qrcode pino @hapi/boom
   ```

2. **Go to Admin Settings**:
   - Navigate to `/admin/settings`
   - Click the "WhatsApp" tab

3. **Connect WhatsApp**:
   - Click "Connect WhatsApp" button
   - QR code will appear on the page

4. **Scan QR Code**:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code from the admin page

5. **Done!** Session is saved automatically. You won't need to scan again.

## Features

- ✅ Automatic notifications when bookings are confirmed
- ✅ Includes booking details and WhatsApp group links
- ✅ Session persists across server restarts
- ✅ QR code displayed in admin UI (no terminal needed)
- ✅ Works with Node.js v22

## Troubleshooting

### Package Already Installed
If packages are already installed, you're good to go! Just go to admin settings and connect.

### QR Code Not Showing
- Make sure you clicked "Connect WhatsApp"
- Wait a few seconds for QR code to generate
- Refresh the page if needed

### Connection Issues
- Delete `.wwebjs_auth/` directory to force re-authentication
- Restart the server
- Try connecting again

## Migration from whatsapp-web.js

If you had whatsapp-web.js installed before:
- Old session data in `.wwebjs_auth/` will be reused
- No need to scan QR code again if session is valid
- If issues occur, delete `.wwebjs_auth/` and reconnect
