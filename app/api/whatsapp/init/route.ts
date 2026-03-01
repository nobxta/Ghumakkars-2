import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService } from '@/lib/whatsapp';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Initialize WhatsApp client and get QR code if needed.
 * Only initializes when explicitly requested (POST). Never call this for status polling.
 * POST /api/whatsapp/init
 */
export async function POST(request: NextRequest) {
  try {
    const whatsapp = getWhatsAppService();

    // If already connected, return immediately — do NOT call initialize() (prevents 440 replace loop)
    if (whatsapp.getReady()) {
      return NextResponse.json({
        success: true,
        ready: true,
        message: 'WhatsApp client is already ready',
      });
    }

    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json({
        success: false,
        ready: false,
        error: '@whiskeysockets/baileys is not installed',
        message: 'Please install @whiskeysockets/baileys and dependencies with: npm install @whiskeysockets/baileys qrcode pino @hapi/boom',
      }, { status: 503 });
    }

    await whatsapp.initialize();

    if (whatsapp.getReady()) {
      return NextResponse.json({
        success: true,
        ready: true,
        message: 'WhatsApp client is ready',
      });
    }

    const qrCode = await whatsapp.getQRCode();
    if (qrCode) {
      const qrCodeImage = await whatsapp.getQRCodeImage();
      return NextResponse.json({
        success: true,
        ready: false,
        qrCode: qrCode,
        qrCodeImage: qrCodeImage,
        message: 'Scan QR code with WhatsApp',
      });
    }

    return NextResponse.json({
      success: false,
      ready: false,
      message: 'Initialization in progress - QR code not yet available. Please try again in a few seconds.',
    });
  } catch (error: any) {
    console.error('Error initializing WhatsApp:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
}

/**
 * Get WhatsApp client status (read-only). Use for polling.
 * MUST NOT call initialize(), create socket, or trigger reconnect — only getReady() / getQRCode().
 * GET /api/whatsapp/init
 */
export async function GET(request: NextRequest) {
  try {
    const whatsapp = getWhatsAppService();
    const ready = whatsapp.getReady();

    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json({
        success: false,
        ready: false,
        installed: false,
        message: '@whiskeysockets/baileys is not installed',
      });
    }

    return NextResponse.json({
      success: true,
      ready,
      installed: true,
      message: ready ? 'WhatsApp client is ready' : 'WhatsApp client is not ready',
    });
  } catch (error: any) {
    console.error('Error getting WhatsApp status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get WhatsApp status' },
      { status: 500 }
    );
  }
}
