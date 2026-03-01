import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService } from '@/lib/whatsapp';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Send test WhatsApp notification with mock booking details
 * POST /api/whatsapp/test-notification
 * Body: { phoneNumber: string, userName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, userName } = await request.json();

    if (!phoneNumber || !userName) {
      return NextResponse.json(
        { error: 'Phone number and user name are required' },
        { status: 400 }
      );
    }

    // Initialize WhatsApp service
    const whatsapp = getWhatsAppService();
    
    // Check if package is installed
    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json(
        { error: '@whiskeysockets/baileys is not installed. Please install it to enable WhatsApp notifications.' },
        { status: 503 }
      );
    }
    
    // Ensure client is ready
    if (!whatsapp.getReady()) {
      return NextResponse.json(
        { error: 'WhatsApp client is not ready. Please connect WhatsApp first.' },
        { status: 503 }
      );
    }

    // Generate mock booking details
    const mockBookingId = `TEST-${Date.now().toString(36).toUpperCase()}`;
    const mockTripTitle = 'Test Trip - Manali Adventure';
    const mockDestination = 'Manali, Himachal Pradesh';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3);
    const mockAmount = 5000;
    const mockParticipants = 2;
    const mockGroupLink = 'https://chat.whatsapp.com/TestGroupLink123';

    // Send test booking confirmation message
    await whatsapp.sendBookingConfirmation(phoneNumber, {
      bookingId: mockBookingId,
      userName: userName,
      tripTitle: mockTripTitle,
      destination: mockDestination,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalAmount: mockAmount,
      numberOfParticipants: mockParticipants,
      whatsappGroupLink: mockGroupLink,
    });

    return NextResponse.json({
      success: true,
      message: 'Test WhatsApp notification sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending test WhatsApp notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test WhatsApp notification' },
      { status: 500 }
    );
  }
}

