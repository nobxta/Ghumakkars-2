/**
 * Turns raw error_logs rows into plain English for the admin Logs page.
 * Shared by the page (client) and the summary/dashboard counts (server), so
 * "needs attention" means the same thing everywhere.
 *
 *  problem  → something on our side broke. Someone should look at it.
 *  customer → the customer's bank, network or browser failed. Nothing to fix on the site.
 *  routine  → normal activity: typos, wrong OTPs, incomplete forms, double clicks.
 */

export type LogKind = 'problem' | 'customer' | 'routine';

export interface LogLike {
  level: 'error' | 'warning';
  category: string;
  process: string;
  message: string;
  code: string | null;
  status: number | null;
  user_email?: string | null;
  details?: Record<string, any> | null;
}

export interface LogExplanation {
  kind: LogKind;
  /** Short headline, e.g. "Login tried with an unregistered email". */
  title: string;
  /** One or two sentences: what happened, without jargon. */
  summary: string;
  /** What the admin should do about it. */
  action: string;
}

interface Rule {
  when: (l: LogLike, p: string, m: string) => boolean;
  explain: (l: LogLike) => Omit<LogExplanation, 'summary'> & { summary?: string };
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

const RULES: Rule[] = [
  // ---------- Payments ----------
  {
    when: (_, p) => has(p, 'record successful payment'),
    explain: () => ({
      kind: 'problem',
      title: 'Payment received but not saved on the booking',
      summary: 'Razorpay took the money, but the website could not update the booking. The customer may think their booking failed.',
      action: 'Open Payments, find this payment and press Sync. Then check the booking shows as paid.',
    }),
  },
  {
    when: (_, p) => has(p, 'record failed payment'),
    explain: () => ({
      kind: 'problem',
      title: 'Could not record a failed payment',
      summary: 'Razorpay told us a payment failed, but the website could not save that update.',
      action: 'Usually harmless. If the booking looks stuck, open it and check its payment status.',
    }),
  },
  {
    when: (_, p) => has(p, 'refund failed'),
    explain: () => ({
      kind: 'problem',
      title: 'A refund did not go through',
      action: 'Open the payment in Razorpay and retry the refund, or refund the customer another way.',
    }),
  },
  {
    when: (_, p) => has(p, 'load razorpay checkout'),
    explain: () => ({
      kind: 'customer',
      title: "Payment window didn't open for a customer",
      summary: "The Razorpay payment screen couldn't load on the customer's device, usually because of a weak network, an ad blocker or an office firewall.",
      action: 'Nothing to fix on the website. If they still want to book, ask them to try mobile data or another browser.',
    }),
  },
  {
    when: (l, p) => has(p, 'razorpay checkout', 'razorpay payment failed') || l.code === 'GATEWAY_ERROR' || l.code === 'BAD_REQUEST_ERROR',
    explain: () => ({
      kind: 'customer',
      title: "Customer's payment was declined",
      action: 'Nothing to fix on the website. If the booking matters, contact the customer and suggest UPI or a different card.',
    }),
  },
  {
    when: (_, p, m) => has(p, 'validate coupon') || (has(p, 'coupon') && has(m, 'coupon')),
    explain: () => ({
      kind: 'routine',
      title: 'Coupon code was rejected',
      action: 'Nothing to do, unless a customer says a coupon you gave them is not working.',
    }),
  },
  {
    when: (_, p) => has(p, 'use wallet'),
    explain: (l) => ({
      kind: (l.status ?? 500) >= 500 ? 'problem' : 'routine',
      title: (l.status ?? 500) >= 500 ? 'Wallet payment failed' : 'Wallet could not be used',
      action: (l.status ?? 500) >= 500 ? 'Check the customer wallet balance and the booking.' : 'Nothing to do. Usually not enough wallet balance.',
    }),
  },

  // ---------- Login / OTP ----------
  {
    when: (_, p, m) => has(p, 'otp', 'login') && has(m, 'no account', 'not found', 'not registered'),
    explain: () => ({
      kind: 'routine',
      title: 'Login tried with an email that has no account',
      summary: "Someone tried to log in with an email that isn't registered. Usually a typo, or a person who hasn't signed up yet.",
      action: 'Nothing to do. If the same person keeps trying, they may need help signing up.',
    }),
  },
  {
    when: (_, p, m) => has(p, 'otp') && has(m, 'invalid', 'incorrect', 'wrong', 'expired', 'mismatch'),
    explain: () => ({
      kind: 'routine',
      title: 'Wrong or expired OTP entered',
      summary: 'Someone typed an OTP that was wrong or too old. They can request a new one.',
      action: 'Nothing to do, unless one customer keeps failing. Then check they are getting the emails.',
    }),
  },
  {
    when: (_, p, m) => has(p, 'sign up') && has(m, 'already', 'exists', 'registered'),
    explain: () => ({
      kind: 'routine',
      title: 'Sign-up tried with an email that already has an account',
      action: 'Nothing to do. The person should log in instead.',
    }),
  },
  {
    when: (_, p) => has(p, 'change password', 'reset password', 'password reset', 'reset link'),
    explain: (l) => ({
      kind: (l.status ?? 500) >= 500 ? 'problem' : 'routine',
      title: (l.status ?? 500) >= 500 ? 'Password change failed' : 'Password change was refused',
      action: (l.status ?? 500) >= 500 ? 'If customers report it, check the email settings and Supabase Auth.' : 'Nothing to do. Usually a wrong current password or an old reset link.',
    }),
  },

  // ---------- Email ----------
  {
    when: (l) => l.category === 'email',
    explain: (l) => ({
      kind: 'problem',
      title: `Email not sent: ${l.process.replace(/^Email:\s*/i, '')}`,
      action: /auth|535|credential|login/i.test(l.message)
        ? 'The email login (SMTP password) seems wrong or expired. Update it in the server settings.'
        : /quota|limit|421|450|452/i.test(l.message)
          ? 'The email provider is limiting how many emails we send. Wait a bit, or upgrade the email plan.'
          : 'Check the email settings. If the customer needed this email, send the information by hand.',
    }),
  },

  // ---------- Instagram / webhooks ----------
  {
    when: (_, __, m) => has(m, 'instagram_app_secret'),
    explain: () => ({
      kind: 'problem',
      title: 'Instagram auto-replies are switched off',
      summary: 'Instagram sent us a new message or comment, but the website ignored it because a required setting is missing.',
      action: 'Add INSTAGRAM_APP_SECRET in the Vercel environment variables, then redeploy.',
    }),
  },
  {
    when: (_, __, m) => has(m, 'already running'),
    explain: () => ({
      kind: 'routine',
      title: 'Sync was already running',
      summary: 'The sync button was pressed while a sync was still in progress, so the second one was skipped.',
      action: 'Nothing to do.',
    }),
  },
  {
    when: (l) => l.category === 'webhook',
    explain: (l) => ({
      kind: 'problem',
      title: `${l.process.replace(/webhook/i, '').trim() || 'Webhook'} update was not processed`,
      summary: 'An outside service (Razorpay, Instagram or Telegram) sent the website an update and it could not be handled.',
      action: 'If payments or messages look out of date, use the Sync buttons on that page.',
    }),
  },

  // ---------- Bookings ----------
  {
    when: (_, p, m) => has(p, 'cancel unpaid booking') && has(m, 'not found'),
    explain: () => ({
      kind: 'routine',
      title: 'Unpaid booking was already gone',
      summary: 'A customer closed the payment screen, but their unpaid booking had already been removed.',
      action: 'Nothing to do.',
    }),
  },
  {
    when: (_, p) => has(p, 'notification'),
    explain: () => ({
      kind: 'problem',
      title: 'Booking confirmation message not sent',
      summary: 'The booking went through, but the confirmation email/message to the customer failed.',
      action: 'Open the booking and resend the confirmation, or message the customer yourself.',
    }),
  },
];

/** Plain-English versions of common technical messages. */
const MESSAGE_TRANSLATIONS: [RegExp, string][] = [
  [/EAUTH|535|invalid login|authentication failed|username and password not accepted/i, 'The email account refused our login, so the email could not be sent.'],
  [/ESOCKET|ECONNECTION|greeting never received/i, 'The website could not connect to the email server.'],
  [/invalid recipient|mailbox unavailable|user unknown|550/i, "The customer's email address does not exist or is not accepting mail."],
  [/fetch failed|ECONNREFUSED|ENOTFOUND|network ?error|socket hang up/i, 'The website could not reach another service (network problem).'],
  [/timed? ?out|ETIMEDOUT|deadline/i, 'Another service took too long to answer.'],
  [/duplicate key/i, 'This was already saved. A duplicate was blocked.'],
  [/violates foreign key|violates not-null|violates check/i, 'Some data was missing or did not match, so the save was blocked.'],
  [/JWT expired|session.*expired|not authenticated|unauthori[sz]ed/i, 'The person was logged out or their session had expired.'],
  [/permission denied|row-level security|forbidden/i, 'The website was not allowed to do this (a permissions setting blocked it).'],
  [/rate limit|too many/i, 'Too many attempts in a short time, so they were blocked for a bit. This is a safety feature.'],
  [/cannot read propert|undefined is not|is not a function|TypeError|ReferenceError/i, 'A bug in the website code. Send the technical details to your developer.'],
  [/^HTTP 5\d\d$/i, 'The server hit an unexpected problem.'],
];

export function plainMessage(message: string): string {
  for (const [re, text] of MESSAGE_TRANSLATIONS) if (re.test(message)) return text;
  return message.replace(/^Error:\s*/i, '');
}

const STATUS_WORDS: Record<number, string> = {
  400: 'the information sent was incomplete or wrong',
  404: 'what they were looking for no longer exists',
  409: 'it clashed with something already in progress',
  422: 'the information sent was not valid',
  429: 'there were too many attempts in a short time',
};

export function explainLog(log: LogLike): LogExplanation {
  const p = log.process.toLowerCase();
  const m = log.message.toLowerCase();
  const message = plainMessage(log.message);

  for (const rule of RULES) {
    if (rule.when(log, p, m)) {
      const r = rule.explain(log);
      return { ...r, summary: r.summary || message };
    }
  }

  const name = log.process.replace(/\s*\(browser\)$/i, '');
  const status = log.status ?? (log.code && /^\d{3}$/.test(log.code) ? Number(log.code) : null);

  if (status === 429) {
    return {
      kind: 'routine',
      title: `${name}: too many attempts`,
      summary: 'Someone tried this too many times in a row, so the website paused them for a bit. This is a safety feature.',
      action: 'Nothing to do.',
    };
  }

  // Admin form validations, 4xx and other warnings are routine activity.
  if (log.level === 'warning' || (status != null && status >= 400 && status < 500)) {
    return {
      kind: 'routine',
      title: log.category === 'admin' ? `${name}: not saved` : `${name}: request refused`,
      summary: status && STATUS_WORDS[status] && log.category !== 'admin'
        ? `${message.replace(/\.?$/, '.')} (In short: ${STATUS_WORDS[status]}.)`
        : message,
      action: log.category === 'admin'
        ? 'Nothing broke. The form was missing something. Check the message above and try again.'
        : 'Nothing to do, unless the same person keeps hitting it.',
    };
  }

  return {
    kind: 'problem',
    title: `${name} failed`,
    summary: message,
    action: 'If it keeps happening, copy the technical details and send them to your developer.',
  };
}

export const KIND_META: Record<LogKind, { label: string; short: string; description: string }> = {
  problem: {
    label: 'Needs attention',
    short: 'Problem',
    description: 'Something on the website broke. Someone should look at it.',
  },
  customer: {
    label: 'Customer-side',
    short: 'Customer',
    description: "A customer's bank, network or browser failed. Nothing is broken on the website.",
  },
  routine: {
    label: 'Routine activity',
    short: 'Routine',
    description: 'Normal things like typos, wrong OTPs and incomplete forms. No action needed.',
  },
};

/** Groups repeats of the same thing together (ignores emails, IDs and numbers in the message). */
export function issueKey(log: LogLike): string {
  const normalized = log.message
    .toLowerCase()
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '#')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '#')
    .replace(/\b(pay|order|rfnd)_\w+/g, '#')
    .replace(/\d+/g, '#');
  return `${log.category}|${log.process}|${normalized}`;
}

/** Number of open problems, used by the sidebar badge and dashboard. */
export function countOpenProblems(logs: (LogLike & { resolved?: boolean })[]): number {
  return logs.filter((l) => !l.resolved && explainLog(l).kind === 'problem').length;
}
