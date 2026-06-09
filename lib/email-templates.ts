/**
 * Ghumakkars email design system.
 *
 * Inline styles only (Gmail strips <style>), table-based layout (Outlook hates flex),
 * 600px max width, mobile-tested, system fonts.
 *
 * Each situation has a theme (color, icon, accent) and a status pill. The
 * `renderEmail()` function returns full HTML you can pass to nodemailer.
 */

const BRAND = {
  name: 'Ghumakkars',
  domain: 'ghumakkars.in',
  url: 'https://ghumakkars.in',
  supportEmail: 'support@ghumakkars.in',
  whatsapp: '+91 96218 86657',
  whatsappLink: 'https://wa.me/919621886657',
  instagram: 'https://instagram.com/ghumakkars.in',
  tagline: 'Group trips across India',
};

export type Theme =
  | 'success'   // confirmed bookings, payments captured
  | 'warning'   // seat locked, payment due
  | 'pending'   // received / under review
  | 'danger'    // rejected, failed, cancelled
  | 'brand'     // welcome, OTP, info
  | 'offer';    // coupons, discounts

const THEMES: Record<Theme, { primary: string; primaryDark: string; soft: string; border: string; emoji: string; statusBg: string; statusText: string }> = {
  success:  { primary: '#16a34a', primaryDark: '#15803d', soft: '#f0fdf4', border: '#bbf7d0', emoji: '✅', statusBg: '#dcfce7', statusText: '#166534' },
  warning:  { primary: '#ea580c', primaryDark: '#c2410c', soft: '#fff7ed', border: '#fed7aa', emoji: '⏳', statusBg: '#ffedd5', statusText: '#9a3412' },
  pending:  { primary: '#7c3aed', primaryDark: '#6d28d9', soft: '#faf5ff', border: '#e9d5ff', emoji: '📩', statusBg: '#f3e8ff', statusText: '#6b21a8' },
  danger:   { primary: '#dc2626', primaryDark: '#b91c1c', soft: '#fef2f2', border: '#fecaca', emoji: '⚠️', statusBg: '#fee2e2', statusText: '#991b1b' },
  brand:    { primary: '#7c3aed', primaryDark: '#6d28d9', soft: '#faf5ff', border: '#e9d5ff', emoji: '🌄', statusBg: '#f3e8ff', statusText: '#6b21a8' },
  offer:    { primary: '#db2777', primaryDark: '#be185d', soft: '#fdf2f8', border: '#fbcfe8', emoji: '🎁', statusBg: '#fce7f3', statusText: '#9d174d' },
};

interface KeyValueRow {
  label: string;
  value: string;
  highlight?: boolean;
}

interface RenderOptions {
  theme: Theme;
  preheader: string;          // hidden text seen in inbox preview
  title: string;              // big headline
  greeting?: string;          // "Hello Vivek,"
  intro?: string;             // 1-2 sentence opening
  statusPill?: string;        // e.g. "CONFIRMED" — uppercase
  /** Booking/trip card details. Renders as a clean table of label→value. */
  details?: KeyValueRow[];
  /** Highlighted box (e.g. "Remaining ₹4,999 due by 15 Jun"). Optional. */
  highlight?: { label?: string; lines: string[]; tone?: Theme };
  /** Big numbered code (OTP, coupon code). */
  code?: { label?: string; value: string; sub?: string };
  /** Primary call-to-action. */
  cta?: { label: string; url: string };
  /** Closing paragraph (after the CTA). */
  outro?: string;
  /** Show WhatsApp + Instagram + support email in footer (default true). */
  showFooter?: boolean;
}

/** Hidden preheader text — shown in inbox previews on Gmail / Apple Mail. */
function preheaderHtml(text: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;">${escape(text)}</div>`;
}

function escape(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function renderEmail(o: RenderOptions): string {
  const t = THEMES[o.theme];
  const year = new Date().getFullYear();

  const detailsRows = (o.details || [])
    .map((d) => `<tr>
      <td style="padding:8px 0;font-size:14px;color:#6b7280;vertical-align:top;width:42%;">${escape(d.label)}</td>
      <td style="padding:8px 0;font-size:14px;font-weight:${d.highlight ? '700' : '600'};color:${d.highlight ? t.primary : '#0f172a'};text-align:right;vertical-align:top;">${escape(d.value)}</td>
    </tr>`)
    .join('');

  const highlightTheme = o.highlight?.tone ? THEMES[o.highlight.tone] : t;
  const highlightHtml = o.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
         <tr><td style="background:${highlightTheme.soft};border:1px solid ${highlightTheme.border};border-radius:12px;padding:16px 18px;">
           ${o.highlight.label ? `<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${highlightTheme.statusText};">${escape(o.highlight.label)}</p>` : ''}
           ${o.highlight.lines.map((l) => `<p style="margin:4px 0;font-size:15px;line-height:1.5;color:#0f172a;">${l}</p>`).join('')}
         </td></tr>
       </table>`
    : '';

  const codeHtml = o.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
         <tr><td style="text-align:center;">
           ${o.code.label ? `<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">${escape(o.code.label)}</p>` : ''}
           <div style="display:inline-block;padding:18px 28px;border:2px dashed ${t.border};border-radius:14px;background:${t.soft};">
             <span style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${t.primaryDark};">${escape(o.code.value)}</span>
           </div>
           ${o.code.sub ? `<p style="margin:10px 0 0 0;font-size:13px;color:#6b7280;">${escape(o.code.sub)}</p>` : ''}
         </td></tr>
       </table>`
    : '';

  const ctaHtml = o.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
         <tr><td style="border-radius:10px;background:${t.primary};">
           <a href="${escape(o.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escape(o.cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  const statusPillHtml = o.statusPill
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${t.statusBg};color:${t.statusText};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${escape(o.statusPill)}</span>`
    : '';

  const footerHtml = (o.showFooter ?? true)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
         <tr><td style="padding:24px 32px 8px;text-align:center;border-top:1px solid #e5e7eb;">
           <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Need help?</p>
           <p style="margin:0 0 14px 0;font-size:13px;color:#374151;">
             <a href="mailto:${BRAND.supportEmail}" style="color:${t.primary};text-decoration:none;font-weight:600;">${BRAND.supportEmail}</a>
             &nbsp;·&nbsp;
             <a href="${BRAND.whatsappLink}" style="color:${t.primary};text-decoration:none;font-weight:600;">WhatsApp</a>
             &nbsp;·&nbsp;
             <a href="${BRAND.instagram}" style="color:${t.primary};text-decoration:none;font-weight:600;">Instagram</a>
           </p>
         </td></tr>
         <tr><td style="padding:0 32px 28px;text-align:center;">
           <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
             © ${year} ${BRAND.name}. ${BRAND.tagline}.<br>
             You received this because you booked or signed up at ${BRAND.domain}.
           </p>
         </td></tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(o.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;">
${preheaderHtml(o.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">

      <!-- Brand strip with theme color -->
      <tr>
        <td style="background:${t.primary};height:6px;line-height:6px;font-size:6px;">&nbsp;</td>
      </tr>

      <!-- Logo + brand -->
      <tr>
        <td style="padding:28px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:18px;font-weight:700;color:${t.primaryDark};letter-spacing:-0.2px;">
                ${BRAND.name}
              </td>
              <td style="text-align:right;">${statusPillHtml}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Hero icon + title -->
      <tr>
        <td style="padding:8px 32px 4px;">
          <div style="font-size:32px;line-height:1;">${t.emoji}</div>
          <h1 style="margin:12px 0 0 0;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;letter-spacing:-0.4px;">${escape(o.title)}</h1>
        </td>
      </tr>

      <!-- Greeting + intro -->
      <tr>
        <td style="padding:16px 32px 0;">
          ${o.greeting ? `<p style="margin:0 0 8px 0;font-size:15px;color:#0f172a;">${escape(o.greeting)}</p>` : ''}
          ${o.intro ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${o.intro}</p>` : ''}
        </td>
      </tr>

      <!-- Code (OTP, coupon) -->
      ${o.code ? `<tr><td style="padding:0 32px;">${codeHtml}</td></tr>` : ''}

      <!-- Details table -->
      ${detailsRows ? `<tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;">
          ${detailsRows}
        </table>
      </td></tr>` : ''}

      <!-- Highlight box -->
      ${o.highlight ? `<tr><td style="padding:0 32px;">${highlightHtml}</td></tr>` : ''}

      <!-- CTA -->
      ${o.cta ? `<tr><td style="padding:0 32px;text-align:center;">${ctaHtml}</td></tr>` : ''}

      <!-- Outro -->
      ${o.outro ? `<tr><td style="padding:8px 32px 24px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">${o.outro}</p>
      </td></tr>` : ''}

      <!-- Footer -->
      ${footerHtml}

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Plain-text equivalent generator — for the multi-part fallback. */
export function renderPlainText(o: RenderOptions): string {
  const lines: string[] = [];
  lines.push(o.title);
  lines.push('='.repeat(o.title.length));
  lines.push('');
  if (o.greeting) lines.push(o.greeting);
  if (o.intro) lines.push(o.intro.replace(/<[^>]+>/g, ''));
  lines.push('');
  if (o.code) lines.push(`${o.code.label || 'Code'}: ${o.code.value}${o.code.sub ? ` (${o.code.sub})` : ''}`);
  if ((o.details || []).length > 0) {
    lines.push('');
    o.details!.forEach((d) => lines.push(`${d.label}: ${d.value}`));
  }
  if (o.highlight) {
    lines.push('');
    if (o.highlight.label) lines.push(o.highlight.label);
    o.highlight.lines.forEach((l) => lines.push(l.replace(/<[^>]+>/g, '')));
  }
  if (o.cta) {
    lines.push('');
    lines.push(`${o.cta.label}: ${o.cta.url}`);
  }
  if (o.outro) {
    lines.push('');
    lines.push(o.outro.replace(/<[^>]+>/g, ''));
  }
  lines.push('');
  lines.push('—');
  lines.push(`${BRAND.name} · ${BRAND.tagline}`);
  lines.push(`Support: ${BRAND.supportEmail} · WhatsApp: ${BRAND.whatsapp}`);
  lines.push(`© ${new Date().getFullYear()} ${BRAND.name}`);
  return lines.join('\n');
}

export { BRAND };
