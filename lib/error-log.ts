import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Error logging for the admin "Error Logs" page (table: error_logs).
 * The table prunes itself (7 days / newest 500), so log freely — but never secrets.
 * logError() never throws: a broken logger must not break the request it is logging.
 */

export type ErrorCategory = 'auth' | 'otp' | 'email' | 'payment' | 'booking' | 'webhook' | 'admin' | 'system';
export type ErrorLevel = 'error' | 'warning';

export interface LogErrorInput {
  category: ErrorCategory;
  process: string;
  message?: string;
  error?: unknown;
  level?: ErrorLevel;
  code?: string | number | null;
  status?: number;
  request?: Request;
  userId?: string | null;
  userEmail?: string | null;
  bookingId?: string | null;
  details?: Record<string, unknown>;
}

const SECRET_KEY = /password|passwd|^otp$|otp_?code|token|secret|signature|cvv|card_?number|authorization|cookie|api_?key/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const err = input.error as any;
    const message = truncate(input.message || err?.message || (err ? String(err) : 'Unknown error'), 1000);
    const code = input.code ?? err?.code ?? err?.responseCode ?? null;

    console.error(`[ErrorLog] ${input.category} / ${input.process}: ${message}`, code ? `(code ${code})` : '');

    const req = input.request;
    const userAgent = req?.headers.get('user-agent') || null;
    let userId = input.userId ?? null;
    let userEmail = input.userEmail ?? null;
    if (req && !userId && !userEmail) {
      ({ userId, userEmail } = await sessionUser());
    }

    const details: Record<string, unknown> = { ...(input.details || {}) };
    if (err?.stack) details.stack = String(err.stack).split('\n').slice(0, 6).join('\n');

    await createAdminClient().from('error_logs').insert({
      level: input.level || 'error',
      category: input.category,
      process: truncate(input.process, 120),
      message,
      code: code == null ? null : truncate(String(code), 80),
      user_id: userId && UUID.test(userId) ? userId : null,
      user_email: userEmail ? truncate(userEmail.toLowerCase().trim(), 200) : null,
      booking_id: input.bookingId && UUID.test(input.bookingId) ? input.bookingId : null,
      route: req ? new URL(req.url).pathname : null,
      method: req?.method || null,
      status: input.status ?? null,
      ip: req ? clientIp(req) : null,
      user_agent: userAgent ? truncate(userAgent, 400) : null,
      device: userAgent ? describeDevice(userAgent) : null,
      details: Object.keys(details).length ? sanitize(details) : null,
    });
  } catch (loggingError) {
    console.error('[ErrorLog] Failed to write error log:', loggingError);
  }
}

// Request body fields worth showing on a log entry. Everything else (passwords, OTPs...) is ignored.
const SAFE_BODY_FIELDS = [
  'email', 'userEmail', 'bookingId', 'booking_id', 'tripId', 'trip_id', 'status', 'action', 'type', 'event',
  'amount', 'paymentMethod', 'payment_method', 'payment_mode', 'razorpay_order_id', 'razorpay_payment_id', 'couponCode',
];

/**
 * Wrap a route handler: logs thrown errors and every 5xx response (as errors),
 * plus 4xx responses (as warnings) unless `log4xx` is false. 401/403 are skipped
 * unless listed in `alsoLog`, since they are usually just a logged-out user.
 */
export function withErrorLog<C = any>(
  category: ErrorCategory,
  process: string,
  handler: (request: NextRequest, context: C) => Promise<Response> | Response,
  options: { log4xx?: boolean; alsoLog?: number[] } = {}
) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    const requestCopy = request.method === 'GET' ? null : request.clone();
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      const reqBody = await safeBody(requestCopy);
      await logError({
        category,
        process,
        error,
        request,
        status: 500,
        userEmail: typeof reqBody.email === 'string' ? reqBody.email : undefined,
        details: Object.keys(reqBody).length ? { request: reqBody } : undefined,
      });
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    const status = response.status;
    const authStatus = status === 401 || status === 403;
    const shouldLog =
      status >= 500 ||
      (status >= 400 && options.log4xx !== false && (!authStatus || options.alsoLog?.includes(status)));

    if (shouldLog) {
      const body = await response.clone().json().catch(() => null);
      const reqBody = await safeBody(requestCopy);
      await logError({
        category,
        process,
        level: status >= 500 ? 'error' : 'warning',
        message: body?.error || body?.message || `HTTP ${status}`,
        code: status,
        status,
        request,
        userEmail: typeof reqBody.email === 'string' ? reqBody.email : undefined,
        bookingId: typeof (reqBody.bookingId ?? reqBody.booking_id) === 'string'
          ? String(reqBody.bookingId ?? reqBody.booking_id)
          : undefined,
        details: Object.keys(reqBody).length ? { request: reqBody } : undefined,
      });
    }
    return response;
  };
}

async function safeBody(request: Request | null): Promise<Record<string, unknown>> {
  if (!request) return {};
  try {
    const text = await request.text();
    if (!text) return {};
    const json = JSON.parse(text);
    if (!json || typeof json !== 'object') return {};
    const picked: Record<string, unknown> = {};
    for (const key of SAFE_BODY_FIELDS) {
      if (json[key] !== undefined && typeof json[key] !== 'object') picked[key] = json[key];
    }
    return picked;
  } catch {
    return {};
  }
}

async function sessionUser(): Promise<{ userId: string | null; userEmail: string | null }> {
  try {
    const { getSession } = await import('@/lib/auth-helpers');
    const session = await getSession();
    return { userId: session?.user.id ?? null, userEmail: session?.user.email ?? null };
  } catch {
    return { userId: null, userEmail: null };
  }
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || null;
}

/** 'Chrome 130 · Android · Mobile' — good enough to spot device-specific problems. */
export function describeDevice(ua: string): string {
  const browser =
    match(ua, /Edg(?:e|A|iOS)?\/(\d+)/, 'Edge') ||
    match(ua, /OPR\/(\d+)/, 'Opera') ||
    match(ua, /SamsungBrowser\/(\d+)/, 'Samsung Internet') ||
    match(ua, /(?:Chrome|CriOS)\/(\d+)/, 'Chrome') ||
    match(ua, /(?:Firefox|FxiOS)\/(\d+)/, 'Firefox') ||
    match(ua, /Version\/(\d+).*Safari/, 'Safari') ||
    (/node|undici|axios|curl|razorpay/i.test(ua) ? 'Server' : 'Unknown browser');

  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;

  const type = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobi|Android|iPhone/.test(ua) ? 'Mobile' : os ? 'Desktop' : null;
  return [browser, os, type].filter(Boolean).join(' · ');
}

function match(ua: string, re: RegExp, name: string): string | null {
  const m = ua.match(re);
  return m ? `${name} ${m[1]}` : null;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return truncate(value, 1000);
  if (depth > 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
