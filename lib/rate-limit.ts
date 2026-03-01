/**
 * In-memory rate limiter for auth endpoints.
 * For production at scale, consider Redis (e.g. @upstash/ratelimit).
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getKey(identifier: string, prefix: string): string {
  return `${prefix}:${identifier}`;
}

function getIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return (forwarded?.split(',')[0]?.trim() || realIp || 'unknown').slice(0, 64);
}

export function checkRateLimit(
  request: Request,
  prefix: string,
  maxRequests: number
): { ok: true } | { ok: false; retryAfter: number } {
  const key = getKey(getIdentifier(request), prefix);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { ok: true };
}

export const AUTH_LIMITS = {
  signup: 5,
  signin: 10,
  sendOtp: 10,
  verifyOtp: 15,
  verifySignupOtp: 15,
  resendSignupOtp: 5,
  sendPasswordReset: 5,
  resetPassword: 5,
} as const;
