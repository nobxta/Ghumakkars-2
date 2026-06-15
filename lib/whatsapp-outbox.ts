import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Drop a WhatsApp message into the outbox queue. A separate Node worker on the
 * VPS polls this table and actually sends the message — the Next.js app never
 * talks to WhatsApp directly (a serverless function can't hold a session).
 *
 * Fire-and-forget: never throw into the caller's flow.
 */
export type WhatsAppKind =
  | 'otp' | 'seat_locked' | 'confirmed' | 'rejected' | 'cancelled' | 'remaining_reminder' | 'custom';

export async function enqueueWhatsApp(job: {
  toPhone: string;
  kind: WhatsAppKind;
  body: string;
  mediaUrl?: string | null;
  mediaFilename?: string | null;
  /** Pass a stable key (e.g. `confirmed:<bookingId>`) to avoid duplicate sends. */
  dedupeKey?: string | null;
}): Promise<void> {
  try {
    const phone = String(job.toPhone || '').replace(/\D/g, '');
    if (!phone || !job.body?.trim()) return;
    // Normalise to E.164 digits with country code (assume India if 10 digits).
    const to = phone.length === 10 ? `91${phone}` : phone;

    const admin = createAdminClient();
    const { error } = await admin.from('whatsapp_outbox').insert({
      to_phone: to,
      kind: job.kind,
      body: job.body.trim(),
      media_url: job.mediaUrl || null,
      media_filename: job.mediaFilename || null,
      dedupe_key: job.dedupeKey || null,
    });
    // 23505 = unique violation on dedupe_key → already queued, that's fine.
    if (error && error.code !== '23505') {
      console.error('enqueueWhatsApp failed:', error.message);
    }
  } catch (e) {
    console.error('enqueueWhatsApp error:', e);
  }
}
