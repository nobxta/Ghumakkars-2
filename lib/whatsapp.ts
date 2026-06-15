/**
 * WhatsApp client — calls our self-hosted Baileys worker over HTTP.
 *
 * The worker runs on the VPS (e.g. https://api.ghumakkars.in) and holds the
 * WhatsApp session. The website calls it directly; there is no queue/DB in
 * between. Fire-and-forget: a failure never breaks the caller's flow.
 *
 *   WHATSAPP_API_URL=https://api.ghumakkars.in
 *   WHATSAPP_API_SECRET=<shared secret, also set on the worker>
 */
const API_URL = process.env.WHATSAPP_API_URL;
const API_SECRET = process.env.WHATSAPP_API_SECRET;

export interface SendWhatsAppInput {
  to: string;                 // 10-digit or full; country code added if missing
  body: string;
  mediaUrl?: string | null;   // optional public PDF/image URL to attach
  mediaFilename?: string | null;
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<{ ok: boolean; error?: string }> {
  if (!API_URL || !API_SECRET) return { ok: false, error: 'WhatsApp API not configured' };
  const digits = String(input.to || '').replace(/\D/g, '');
  if (!digits || !input.body?.trim()) return { ok: false, error: 'missing to/body' };
  const to = digits.length === 10 ? `91${digits}` : digits;

  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_SECRET },
      body: JSON.stringify({ to, body: input.body.trim(), mediaUrl: input.mediaUrl || undefined, mediaFilename: input.mediaFilename || undefined }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `worker ${res.status} ${t}`.trim() };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'request failed' };
  }
}
