/**
 * Send a WhatsApp message from server code.
 *
 * WhatsApp runs inside this Next.js server (see lib/whatsapp/service.ts), so
 * this is a direct in-process call. Fire-and-forget friendly: it never throws,
 * so a WhatsApp problem can't break the caller's flow.
 */
import type { SendPayload } from './whatsapp/service';

export type SendWhatsAppInput = SendPayload;

/** Sent once, right after a new account is created. (WhatsApp bold = *single* asterisks.) */
export function welcomeMessage(name?: string | null): string {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  return (
    `Hi ${first}! 👋\n\n` +
    `Welcome to *Ghumakkars!*\n\n` +
    `Your account has been created successfully.\n\n` +
    `You can now explore trips, find new places to visit, and plan your next adventure with us.\n\n` +
    `Happy Travelling! 🌍\n\n` +
    `*Team Ghumakkars*`
  );
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  const digits = String(input.to || '').replace(/\D/g, '');
  if (!digits || !input.body?.trim()) return { ok: false, error: 'missing to/body' };
  try {
    const { sendWhatsAppMessage } = await import('./whatsapp/service');
    const res = await sendWhatsAppMessage({ ...input, to: digits.length === 10 ? `91${digits}` : digits });
    return { ok: true, queued: res.queued };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send failed' };
  }
}
