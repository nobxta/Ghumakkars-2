/**
 * WhatsApp service — Green-API based.
 *
 * Replaces the old Baileys implementation which doesn't work on Vercel
 * (serverless functions can't hold long-lived WebSockets or write session files).
 *
 * Green-API hosts the WhatsApp connection on their servers. You log in once by
 * scanning a QR code in their dashboard, then send messages via simple HTTP POST.
 *
 * Setup:
 *   1. Sign up at https://console.green-api.com/
 *   2. Create an instance → it shows a QR. Scan it from the WhatsApp account
 *      you want to use (USE A SECONDARY NUMBER — automation on your personal
 *      number can get it banned by WhatsApp).
 *   3. Copy the credentials and add to .env.local + Vercel env vars:
 *        GREEN_API_INSTANCE_ID=1101234567
 *        GREEN_API_TOKEN=abc123def456...
 *        GREEN_API_HOST=https://api.green-api.com   (optional; default fine)
 */

const HOST = process.env.GREEN_API_HOST || 'https://api.green-api.com';
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const TOKEN = process.env.GREEN_API_TOKEN;

/** Normalize an Indian phone number to chatId format (E.164 without +) */
function toChatId(phoneNumber: string): string {
  const cleaned = String(phoneNumber).replace(/[+\s\-()]/g, '');
  let finalNumber = cleaned;
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    finalNumber = `91${cleaned}`;
  }
  return `${finalNumber}@c.us`;
}

interface GreenApiResponse {
  idMessage?: string;
  message?: string;
  [key: string]: any;
}

async function greenApiPost(method: string, body: Record<string, any>): Promise<GreenApiResponse> {
  if (!INSTANCE_ID || !TOKEN) {
    throw new Error(
      'WhatsApp not configured. Set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in environment variables.'
    );
  }
  const url = `${HOST}/waInstance${INSTANCE_ID}/${method}/${TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: GreenApiResponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Green-API ${method} failed (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function greenApiGet(method: string): Promise<any> {
  if (!INSTANCE_ID || !TOKEN) {
    throw new Error(
      'WhatsApp not configured. Set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in environment variables.'
    );
  }
  const url = `${HOST}/waInstance${INSTANCE_ID}/${method}/${TOKEN}`;
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Green-API ${method} failed (${res.status}): ${(data as any).message || JSON.stringify(data)}`);
  }
  return data;
}

class WhatsAppService {
  /** Send a plain-text message to a phone number */
  async sendMessage(phoneNumber: string, message: string): Promise<GreenApiResponse> {
    const chatId = toChatId(phoneNumber);
    return greenApiPost('sendMessage', { chatId, message });
  }

  /** Send a richly-formatted booking confirmation */
  async sendBookingConfirmation(
    phoneNumber: string,
    bookingDetails: {
      bookingId: string;
      userName: string;
      tripTitle: string;
      destination: string;
      startDate: string;
      endDate?: string;
      totalAmount: number;
      numberOfParticipants: number;
      whatsappGroupLink?: string;
    }
  ): Promise<GreenApiResponse> {
    const formatDate = (d: string) =>
      new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const dateRange = bookingDetails.endDate
      ? `${formatDate(bookingDetails.startDate)} - ${formatDate(bookingDetails.endDate)}`
      : formatDate(bookingDetails.startDate);

    let message = `🎉 *Booking Confirmed!*\n\n`;
    message += `Hello ${bookingDetails.userName},\n\n`;
    message += `Your booking has been confirmed!\n\n`;
    message += `📋 *Booking Details:*\n`;
    message += `• Trip: ${bookingDetails.tripTitle}\n`;
    message += `• Destination: ${bookingDetails.destination}\n`;
    message += `• Dates: ${dateRange}\n`;
    message += `• Participants: ${bookingDetails.numberOfParticipants}\n`;
    message += `• Booking ID: ${bookingDetails.bookingId.slice(0, 8).toUpperCase()}\n`;
    message += `• Amount Paid: ₹${bookingDetails.totalAmount.toLocaleString('en-IN')}\n\n`;

    if (bookingDetails.whatsappGroupLink) {
      message += `👥 *Join Your Trip Group:*\n${bookingDetails.whatsappGroupLink}\n\n`;
      message += `Join the group to connect with other travelers and receive trip updates.\n\n`;
    }

    message += `You will receive additional trip details before the departure date.\n\n`;
    message += `Happy Traveling! 🌍✈️\n\n`;
    message += `_Ghumakkars Team_`;

    return this.sendMessage(phoneNumber, message);
  }

  /** Send a trip reminder message */
  async sendTripReminder(
    phoneNumber: string,
    details: { userName: string; tripTitle: string; startDate: string; pickupLocation?: string; whatsappGroupLink?: string }
  ): Promise<GreenApiResponse> {
    const startDate = new Date(details.startDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let message = `🌄 *Trip Reminder*\n\n`;
    message += `Hello ${details.userName},\n\n`;
    message += `Your trip *${details.tripTitle}* starts on *${startDate}*.\n\n`;
    if (details.pickupLocation) message += `📍 Pickup: ${details.pickupLocation}\n\n`;
    if (details.whatsappGroupLink) message += `👥 Group: ${details.whatsappGroupLink}\n\n`;
    message += `Pack light, charge your phone, and get ready for the adventure!\n\n`;
    message += `_Ghumakkars Team_`;

    return this.sendMessage(phoneNumber, message);
  }

  /**
   * Get current connection status.
   * Returns one of: 'authorized' | 'notAuthorized' | 'starting' | 'blocked' | 'sleepMode' | 'unknown'
   */
  async getStatus(): Promise<{
    state: string;
    isAuthorized: boolean;
    wid?: string;
    deviceInfo?: any;
  }> {
    if (!INSTANCE_ID || !TOKEN) {
      return { state: 'not_configured', isAuthorized: false };
    }
    try {
      const stateRes = await greenApiGet('getStateInstance');
      const state = (stateRes as any).stateInstance || 'unknown';
      const isAuthorized = state === 'authorized';

      let wid: string | undefined;
      let deviceInfo: any;
      if (isAuthorized) {
        try {
          const settings = await greenApiGet('getSettings');
          wid = (settings as any).wid;
        } catch {}
        try {
          deviceInfo = await greenApiGet('getWaSettings');
        } catch {}
      }
      return { state, isAuthorized, wid, deviceInfo };
    } catch (e: any) {
      return { state: 'error', isAuthorized: false };
    }
  }

  /** Get a QR code (data URL) for linking the WhatsApp account. */
  async getQRCode(): Promise<{ qr: string | null; type: 'qrCode' | 'alreadyLogged' | 'error'; message?: string }> {
    if (!INSTANCE_ID || !TOKEN) {
      return { qr: null, type: 'error', message: 'GREEN_API_INSTANCE_ID / GREEN_API_TOKEN not set' };
    }
    try {
      const res = await greenApiGet('qr');
      // res = { type: 'qrCode' | 'alreadyLogged' | 'error', message: '<base64 image without prefix>' | '...' }
      if ((res as any).type === 'qrCode' && (res as any).message) {
        return { qr: `data:image/png;base64,${(res as any).message}`, type: 'qrCode' };
      }
      if ((res as any).type === 'alreadyLogged') {
        return { qr: null, type: 'alreadyLogged' };
      }
      return { qr: null, type: 'error', message: (res as any).message };
    } catch (e: any) {
      return { qr: null, type: 'error', message: e.message };
    }
  }

  /** Log out the WhatsApp session (disconnects on Green-API side) */
  async logout(): Promise<void> {
    try {
      await greenApiGet('logout');
    } catch {
      // Ignore — logout is best-effort
    }
  }

  /** Convenience for callers used to the old API */
  getReady(): Promise<boolean> {
    return this.getStatus().then((s) => s.isAuthorized);
  }

  isPackageInstalled(): boolean {
    return Boolean(INSTANCE_ID && TOKEN);
  }
}

// Singleton instance
declare global {
  // eslint-disable-next-line no-var
  var __whatsappService__: WhatsAppService | undefined;
}

export function getWhatsAppService(): WhatsAppService {
  if (!global.__whatsappService__) {
    global.__whatsappService__ = new WhatsAppService();
  }
  return global.__whatsappService__;
}

export default getWhatsAppService;
