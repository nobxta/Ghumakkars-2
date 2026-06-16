import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, requireAdmin, isInternalRequest } from '@/lib/auth-helpers';
import { renderTicketBuffer } from '@/lib/ticket-pdf';

export const runtime = 'nodejs';

// GET /api/bookings/:id/ticket → the trip ticket as a PDF.
// Same generator the WhatsApp attachment uses, so they're identical.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const bookingId = params.id;

  // Access: internal call, admin, or the booking's owner.
  if (!isInternalRequest(request)) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const adminAuth = await requireAdmin();
    const isAdmin = !(adminAuth instanceof NextResponse);
    if (!isAdmin) {
      const admin = createAdminClient();
      const { data: b } = await admin.from('bookings').select('user_id').eq('id', bookingId).single();
      if (!b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      if (b.user_id !== auth.user.id) {
        return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
      }
    }
  }

  const out = await renderTicketBuffer(bookingId);
  if (!out) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(out.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
