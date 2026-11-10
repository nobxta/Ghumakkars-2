/**
 * Runs once when the Next.js server starts (`next start` / `next dev`).
 * Boots the in-process WhatsApp connection so it's ready before the first
 * booking notification, and reconnects with the saved session after restarts.
 *
 * The import must stay inside the NEXT_RUNTIME check so it is stripped from
 * the edge bundle (Baileys is Node-only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.WHATSAPP_DISABLED === '1') return;
    const { bootWhatsApp } = await import('./lib/whatsapp/service');
    void bootWhatsApp();
  }
}
