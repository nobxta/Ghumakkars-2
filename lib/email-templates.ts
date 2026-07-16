/**
 * Ghumakkars email design system.
 *
 * Inline-first, table-based HTML for strong Gmail, Apple Mail, mobile, and
 * Outlook compatibility. The small CSS block is limited to responsive fixes.
 */

const BRAND = {
  name: 'Ghumakkars',
  domain: 'ghumakkars.in',
  url: 'https://www.ghumakkars.in',
  supportEmail: 'support@ghumakkars.in',
  whatsapp: '+91 82180 20972',
  whatsappLink: 'https://wa.me/918218020972',
  instagram: 'https://instagram.com/ghumakkars.in',
  tagline: 'Group trips across India',
};

export type Theme =
  | 'success'
  | 'warning'
  | 'pending'
  | 'danger'
  | 'brand'
  | 'offer';

const THEMES: Record<Theme, { primary: string; primaryDark: string; soft: string; border: string; statusBg: string; statusText: string }> = {
  success: { primary: '#16a34a', primaryDark: '#15803d', soft: '#f0fdf4', border: '#bbf7d0', statusBg: '#dcfce7', statusText: '#166534' },
  warning: { primary: '#ea580c', primaryDark: '#c2410c', soft: '#fff7ed', border: '#fed7aa', statusBg: '#ffedd5', statusText: '#9a3412' },
  pending: { primary: '#8758f6', primaryDark: '#6d28d9', soft: '#f5f1ff', border: '#ddd6fe', statusBg: '#ede9fe', statusText: '#5b21b6' },
  danger: { primary: '#dc2626', primaryDark: '#b91c1c', soft: '#fef2f2', border: '#fecaca', statusBg: '#fee2e2', statusText: '#991b1b' },
  brand: { primary: '#8758f6', primaryDark: '#6d28d9', soft: '#f5f1ff', border: '#ddd6fe', statusBg: '#ede9fe', statusText: '#5b21b6' },
  offer: { primary: '#db2777', primaryDark: '#be185d', soft: '#fdf2f8', border: '#fbcfe8', statusBg: '#fce7f3', statusText: '#9d174d' },
};

interface KeyValueRow {
  label: string;
  value: string;
  highlight?: boolean;
}

interface RenderOptions {
  theme: Theme;
  preheader: string;
  title: string;
  greeting?: string;
  intro?: string;
  bodyHtml?: string;
  statusPill?: string;
  details?: KeyValueRow[];
  highlight?: { label?: string; lines: string[]; tone?: Theme };
  code?: { label?: string; value: string; sub?: string };
  cta?: { label: string; url: string };
  outro?: string;
  showFooter?: boolean;
}

function escape(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function stripHtml(s: string): string {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim();
}

function preheaderHtml(text: string) {
  const hiddenFiller = '&zwnj;&nbsp;'.repeat(32);
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;">${escape(text)} ${hiddenFiller}</div>`;
}

export function renderEmail(o: RenderOptions): string {
  const t = THEMES[o.theme];
  const year = new Date().getFullYear();

  const statusPillHtml = o.statusPill
    ? `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${t.statusBg};color:${t.statusText};font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;">${escape(o.statusPill)}</span>`
    : '';

  const detailsRows = (o.details || [])
    .map((d) => `<tr>
      <td class="details-label" style="padding:9px 0;font-size:13px;line-height:1.45;color:#64748b;vertical-align:top;width:42%;">${escape(d.label)}</td>
      <td class="details-value" style="padding:9px 0;font-size:14px;line-height:1.45;font-weight:${d.highlight ? '800' : '700'};color:${d.highlight ? t.primary : '#111827'};text-align:right;vertical-align:top;">${escape(d.value)}</td>
    </tr>`)
    .join('');

  const detailsHtml = detailsRows
    ? `<tr><td class="content-pad" style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:13px 18px;">
          ${detailsRows}
        </table>
      </td></tr>`
    : '';

  const highlightTheme = o.highlight?.tone ? THEMES[o.highlight.tone] : t;
  const highlightHtml = o.highlight
    ? `<tr><td class="content-pad" style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
          <tr><td style="background:${highlightTheme.soft};border:1px solid ${highlightTheme.border};border-radius:14px;padding:16px 18px;">
            ${o.highlight.label ? `<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${highlightTheme.statusText};">${escape(o.highlight.label)}</p>` : ''}
            ${o.highlight.lines.map((line) => `<p style="margin:5px 0;font-size:15px;line-height:1.6;color:#111827;">${line}</p>`).join('')}
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const codeHtml = o.code
    ? `<tr><td class="content-pad" style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
          <tr><td style="text-align:center;">
            ${o.code.label ? `<p style="margin:0 0 9px;font-size:12px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:#64748b;">${escape(o.code.label)}</p>` : ''}
            <div style="display:inline-block;padding:18px 28px;border:2px dashed ${t.border};border-radius:16px;background:${t.soft};">
              <span class="code-value" style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:800;letter-spacing:8px;color:${t.primaryDark};">${escape(o.code.value)}</span>
            </div>
            ${o.code.sub ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${escape(o.code.sub)}</p>` : ''}
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const ctaHtml = o.cta
    ? `<tr><td class="content-pad" style="padding:0 32px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
          <tr><td style="border-radius:12px;background:${t.primary};box-shadow:0 8px 18px rgba(135,88,246,.20);">
            <a href="${escape(o.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;">${escape(o.cta.label)}</a>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  const footerHtml = (o.showFooter ?? true)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
        <tr><td class="footer-pad" style="padding:24px 32px 8px;text-align:center;border-top:1px solid #e5e7eb;background:#fbfbfd;">
          <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#64748b;">Need help with your trip?</p>
          <p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#334155;">
            <a href="mailto:${BRAND.supportEmail}" style="color:${t.primary};text-decoration:none;font-weight:800;">${BRAND.supportEmail}</a>
            <span class="link-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
            <a href="${BRAND.whatsappLink}" style="color:${t.primary};text-decoration:none;font-weight:800;">WhatsApp</a>
            <span class="link-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>
            <a href="${BRAND.instagram}" style="color:${t.primary};text-decoration:none;font-weight:800;">Instagram</a>
          </p>
        </td></tr>
        <tr><td class="footer-pad" style="padding:0 32px 28px;text-align:center;background:#fbfbfd;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#94a3b8;">
            &copy; ${year} ${BRAND.name}<br>
            You got this email because you booked or signed up at ${BRAND.domain}.
          </p>
        </td></tr>
      </table>`
    : '';

  const introHtml = o.greeting || o.intro
    ? `<tr><td class="content-pad" style="padding:16px 32px 0;">
        ${o.greeting ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#0f172a;">${escape(o.greeting)}</p>` : ''}
        ${o.intro ? `<p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${o.intro}</p>` : ''}
      </td></tr>`
    : '';

  const bodyHtml = o.bodyHtml
    ? `<tr><td class="content-pad" style="padding:16px 32px 0;">${o.bodyHtml}</td></tr>`
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
<style>
  body, table, td, p, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  a { color:${t.primary}; }
  @media only screen and (max-width: 620px) {
    .outer-pad { padding:0 !important; }
    .email-card { width:100% !important; max-width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .content-pad { padding-left:20px !important; padding-right:20px !important; }
    .footer-pad { padding-left:20px !important; padding-right:20px !important; }
    .brand-cell, .pill-cell { display:block !important; width:100% !important; text-align:left !important; }
    .pill-cell { padding-top:10px !important; }
    .email-title { font-size:22px !important; line-height:1.25 !important; }
    .details-label, .details-value { display:block !important; width:100% !important; text-align:left !important; padding:5px 0 !important; }
    .code-value { font-size:24px !important; letter-spacing:5px !important; }
    .link-sep { display:none !important; }
    .footer-pad a { display:inline-block !important; margin:4px 8px !important; }
  }
</style>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;">
${preheaderHtml(o.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fb;">
  <tr><td class="outer-pad" align="center" style="padding:28px 12px;">
    <table class="email-card" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e8ef;border-radius:20px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,0.07);">
      <tr><td style="background:${t.primary};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
      <tr>
        <td class="content-pad" style="padding:28px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="brand-cell" style="font-size:18px;font-weight:800;color:#111827;letter-spacing:-.2px;">
                <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:9px;background:${t.soft};color:${t.primary};font-weight:900;margin-right:8px;vertical-align:middle;">G</span>
                <span style="vertical-align:middle;">${BRAND.name}</span>
              </td>
              <td class="pill-cell" style="text-align:right;">${statusPillHtml}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="content-pad" style="padding:12px 32px 4px;">
          <h1 class="email-title" style="margin:0;font-size:25px;line-height:1.28;font-weight:800;color:#0f172a;letter-spacing:-.4px;">${escape(o.title)}</h1>
        </td>
      </tr>
      ${introHtml}
      ${bodyHtml}
      ${codeHtml}
      ${detailsHtml}
      ${highlightHtml}
      ${ctaHtml}
      ${o.outro ? `<tr><td class="content-pad" style="padding:8px 32px 24px;"><p style="margin:0;font-size:14px;line-height:1.65;color:#64748b;">${o.outro}</p></td></tr>` : ''}
      ${footerHtml}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function renderPlainText(o: RenderOptions): string {
  const lines: string[] = [];
  lines.push(o.title);
  lines.push('='.repeat(o.title.length));
  lines.push('');
  if (o.greeting) lines.push(o.greeting);
  if (o.intro) lines.push(stripHtml(o.intro));
  if (o.bodyHtml) lines.push(stripHtml(o.bodyHtml));
  if (o.code) lines.push(`${o.code.label || 'Code'}: ${o.code.value}${o.code.sub ? ` (${o.code.sub})` : ''}`);
  if ((o.details || []).length > 0) {
    lines.push('');
    o.details!.forEach((d) => lines.push(`${d.label}: ${d.value}`));
  }
  if (o.highlight) {
    lines.push('');
    if (o.highlight.label) lines.push(o.highlight.label);
    o.highlight.lines.forEach((line) => lines.push(stripHtml(line)));
  }
  if (o.cta) {
    lines.push('');
    lines.push(`${o.cta.label}: ${o.cta.url}`);
  }
  if (o.outro) {
    lines.push('');
    lines.push(stripHtml(o.outro));
  }
  lines.push('');
  lines.push('--');
  lines.push(BRAND.name);
  lines.push(`Support: ${BRAND.supportEmail} | WhatsApp: ${BRAND.whatsapp}`);
  lines.push(`(c) ${new Date().getFullYear()} ${BRAND.name}`);
  return lines.filter((line, index, arr) => line || arr[index - 1]).join('\n');
}

export { BRAND };
