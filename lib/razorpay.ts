/**
 * Razorpay configuration loader.
 *
 * Reads keys from environment variables — never from the database. Storing live
 * payment secrets in a database row that the admin client can read is a security
 * breach: anyone with admin DB access could exfiltrate them.
 *
 * Required env vars:
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET   (only for /api/webhooks/razorpay)
 */

export interface RazorpayConfig {
  key_id: string;
  key_secret: string;
}

/** Throws a descriptive error if either env var is missing. */
export function getRazorpayConfig(): RazorpayConfig {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables (Vercel → Project → Settings → Environment Variables).'
    );
  }
  return { key_id, key_secret };
}

/** Returns the webhook secret, or throws if not set. */
export function getRazorpayWebhookSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'RAZORPAY_WEBHOOK_SECRET not configured. Set it in environment variables to verify webhook signatures.'
    );
  }
  return secret;
}

/** Just the public key id — safe to send to client. */
export function getRazorpayPublicKey(): string {
  return getRazorpayConfig().key_id;
}
