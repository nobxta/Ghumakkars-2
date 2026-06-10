import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService } from '@/lib/whatsapp';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get the current WhatsApp connection status + a QR code if not yet linked.
 *
 * Green-API hosts the connection. There is no "initialize" step here — the
 * Green-API instance runs on their servers; we just ask for its status.
 *
 * POST /api/whatsapp/init  → returns { ready, qrCode?, state, message }
 * GET  /api/whatsapp/init  → same (read-only)
 */
async function handler() {
  try {
    // Admin-only: the QR code in the response would let anyone hijack
    // the WhatsApp session by scanning it first.
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const whatsapp = getWhatsAppService();

    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json(
        {
          success: false,
          ready: false,
          installed: false,
          message:
            'GREEN_API_INSTANCE_ID / GREEN_API_TOKEN not set. Sign up at https://console.green-api.com and add credentials to environment variables.',
        },
        { status: 503 }
      );
    }

    const status = await whatsapp.getStatus();
    if (status.isAuthorized) {
      return NextResponse.json({
        success: true,
        ready: true,
        installed: true,
        state: status.state,
        wid: status.wid,
        message: 'WhatsApp is connected',
      });
    }

    const qrResult = await whatsapp.getQRCode();
    return NextResponse.json({
      success: true,
      ready: false,
      installed: true,
      state: status.state,
      qrCode: qrResult.qr,
      qrCodeImage: qrResult.qr, // alias for backward compat
      message:
        qrResult.type === 'qrCode'
          ? 'Scan this QR code with the WhatsApp account you want to use for notifications'
          : qrResult.message || 'Waiting for Green-API to issue a QR code…',
    });
  } catch (error: any) {
    console.error('Error querying WhatsApp:', error);
    return NextResponse.json({ error: error.message || 'Failed to query WhatsApp' }, { status: 500 });
  }
}

export const POST = handler;
export const GET = handler;
