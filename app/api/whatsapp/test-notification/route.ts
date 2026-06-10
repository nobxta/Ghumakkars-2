import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppService } from '@/lib/whatsapp';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * Send test WhatsApp notification with mock booking details
 * POST /api/whatsapp/test-notification
 * Body: { phoneNumber: string, userName: string }
 *
 * Admin-only: prevents anyone using our WhatsApp account to message
 * arbitrary phone numbers.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { phoneNumber, userName } = await request.json();

    if (!phoneNumber || !userName) {
      return NextResponse.json(
        { error: 'Phone number and user name are required' },
        { status: 400 }
      );
    }

    const whatsapp = getWhatsAppService();

    if (!whatsapp.isPackageInstalled()) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Set GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in environment variables.' },
        { status: 503 }
      );
    }

    const status = await whatsapp.getStatus();
    if (!status.isAuthorized) {
      return NextResponse.json(
        { error: `WhatsApp not connected (state: ${status.state}). Connect in admin settings first.` },
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

